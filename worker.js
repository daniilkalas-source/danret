// Danret: подтверждение номера через Telegram-бота (Cloudflare Worker)
// Секреты (Settings → Variables and Secrets): BOT_TOKEN, WEBHOOK_SECRET, FB_SA (весь JSON ключа сервисного аккаунта)
// Переменная: BOT_USERNAME (имя бота без @).  KV-привязка: KV
const ALLOW = 'https://daniilkalas-source.github.io';
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...h } });
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');
const b64u = u8 => btoa(String.fromCharCode(...u8)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const enc = s => b64u(new TextEncoder().encode(s));

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    const cors = { 'Access-Control-Allow-Origin': ALLOW, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (u.pathname === '/telegram') return await tgHook(req, env);
      if (req.method !== 'POST') return J({ error: 'method' }, 405, cors);
      if (req.headers.get('Origin') !== ALLOW) return J({ error: 'origin' }, 403, cors);
      const b = await req.json().catch(() => ({}));
      const ip = req.headers.get('CF-Connecting-IP') || 'x';
      let r;
      if (u.pathname === '/api/start') r = await start(env, ip);
      else if (u.pathname === '/api/status') r = await status(env, b);
      else if (u.pathname === '/api/register') r = await register(env, b, ip);
      else r = { s: 404, o: { error: 'nf' } };
      return J(r.o, r.s || 200, cors);
    } catch (e) { return J({ error: 'server' }, 500, cors); }
  }
};

async function rl(env, key, max, ttl) {
  const k = 'rl:' + key, n = +(await env.KV.get(k) || 0);
  if (n >= max) return false;
  await env.KV.put(k, String(n + 1), { expirationTtl: ttl });
  return true;
}
const sidOk = s => typeof s === 'string' && /^[a-f0-9]{32}$/.test(s);
const phHash = async (env, ph) => {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.WEBHOOK_SECRET + ':' + ph));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
};

async function start(env, ip) {
  if (!(await rl(env, 'st:' + ip, 10, 3600))) return { s: 429, o: { error: 'limit' } };
  const sid = hex(16);
  await env.KV.put('s:' + sid, JSON.stringify({ st: 'wait' }), { expirationTtl: 900 });
  return { o: { sid, url: `https://t.me/${env.BOT_USERNAME}?start=${sid}` } };
}

async function status(env, b) {
  if (!sidOk(b.sid)) return { o: { st: 'expired' } };
  const s = await env.KV.get('s:' + b.sid, 'json');
  if (!s) return { o: { st: 'expired' } };
  if (s.st === 'ok') return { o: { st: 'ok', ph: '+7 ••• ••• •• ' + s.ph.slice(-2) } };
  return { o: { st: s.st } };
}

async function register(env, b, ip) {
  if (!(await rl(env, 'rg:' + ip, 10, 3600))) return { s: 429, o: { error: 'limit' } };
  if (!sidOk(b.sid)) return { s: 400, o: { error: 'expired' } };
  const s = await env.KV.get('s:' + b.sid, 'json');
  if (!s || s.st !== 'ok') return { s: 400, o: { error: 'expired' } };
  const un = String(b.username || '').trim().replace(/^@/, '').toLowerCase(), pw = String(b.password || '');
  if (!/^[a-z0-9_]{3,24}$/.test(un)) return { s: 400, o: { error: 'bad_username' } };
  if (pw.length < 6 || pw.length > 100) return { s: 400, o: { error: 'bad_password' } };
  const h = await phHash(env, s.ph);
  if (await env.KV.get('p:' + h)) { await env.KV.delete('s:' + b.sid); return { s: 400, o: { error: 'phone_used' } }; }
  await env.KV.put('p:' + h, 'pending');
  const tok = await token(env), pid = JSON.parse(env.FB_SA).project_id;
  const hd = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${pid}/accounts`, { method: 'POST', headers: hd, body: JSON.stringify({ email: un + '@danret.app', password: pw }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    await env.KV.delete('p:' + h);
    const m = (j.error && j.error.message) || '';
    return { s: 400, o: { error: m.includes('EMAIL_EXISTS') ? 'taken' : 'create_failed' } };
  }
  // метка «номер подтверждён» в аккаунте (для правил базы)
  await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${pid}/accounts:update`, { method: 'POST', headers: hd, body: JSON.stringify({ localId: j.localId, customAttributes: JSON.stringify({ tv: true }) }) }).catch(() => {});
  await env.KV.put('p:' + h, j.localId);
  await env.KV.delete('s:' + b.sid);
  return { o: { ok: true, phone: '+' + s.ph } };
}

async function say(env, chat, text, extra) {
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chat, text, ...(extra || {}) }) }).catch(() => {});
}

async function tgHook(req, env) {
  if (req.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) return new Response('no', { status: 403 });
  const up = await req.json().catch(() => null), m = up && up.message, OK = new Response('ok');
  if (!m || !m.from || !m.chat || m.chat.type !== 'private') return OK;
  const chat = m.chat.id, from = m.from.id;
  if (m.text && m.text.startsWith('/start')) {
    const sid = (m.text.split(' ')[1] || '').trim();
    const s = sidOk(sid) ? await env.KV.get('s:' + sid, 'json') : null;
    if (!s || s.st !== 'wait') { await say(env, chat, 'Откройте Danret и нажмите «Подтвердить через Telegram», тогда ссылка сработает.'); return OK; }
    await env.KV.put('t:' + from, sid, { expirationTtl: 900 });
    await say(env, chat, 'Нажмите кнопку ниже, чтобы подтвердить номер для Danret.', { reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true } });
    return OK;
  }
  if (m.contact) {
    if (m.contact.user_id !== from) { await say(env, chat, 'Нужен ваш собственный номер: нажмите кнопку «Поделиться номером».'); return OK; }
    const sid = await env.KV.get('t:' + from), s = sid ? await env.KV.get('s:' + sid, 'json') : null;
    if (!s || s.st !== 'wait') { await say(env, chat, 'Время вышло. Вернитесь в Danret и нажмите кнопку подтверждения ещё раз.', { reply_markup: { remove_keyboard: true } }); return OK; }
    const ph = String(m.contact.phone_number || '').replace(/\D/g, '');
    if (!/^7\d{10}$/.test(ph)) { await say(env, chat, 'Пока принимаются только российские номера (+7).', { reply_markup: { remove_keyboard: true } }); return OK; }
    if (await env.KV.get('p:' + await phHash(env, ph))) {
      s.st = 'used'; await env.KV.put('s:' + sid, JSON.stringify(s), { expirationTtl: 300 });
      await say(env, chat, 'Этот номер уже зарегистрирован в Danret. Войдите по логину и паролю.', { reply_markup: { remove_keyboard: true } }); return OK;
    }
    s.st = 'ok'; s.ph = ph;
    await env.KV.put('s:' + sid, JSON.stringify(s), { expirationTtl: 900 });
    await env.KV.delete('t:' + from);
    await say(env, chat, '✅ Номер подтверждён! Вернитесь в Danret.', { reply_markup: { remove_keyboard: true } });
    return OK;
  }
  await say(env, chat, 'Чтобы подтвердить номер, нажмите «Подтвердить через Telegram» в Danret.');
  return OK;
}

let TOK = { t: '', e: 0 };
async function token(env) {
  if (TOK.e > Date.now() + 60000) return TOK.t;
  const sa = JSON.parse(env.FB_SA), now = Math.floor(Date.now() / 1000);
  const head = enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = enc(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + claim)));
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + b64u(sig) }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('token');
  TOK = { t: j.access_token, e: Date.now() + (j.expires_in || 3600) * 1000 };
  return TOK.t;
}
