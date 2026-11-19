self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (e) { try { p = { data: { body: event.data.text() } }; } catch (_) {} }
  const n = p.notification || {};
  const d = p.data || {};
  const title = n.title || d.title || 'danret';
  const opts = {
    body: n.body || d.body || d.text || 'Новое сообщение',
    icon: n.icon || d.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || d.chatId || n.tag || undefined,
    renotify: !!(d.tag || d.chatId || n.tag),
    data: d
  };
  event.waitUntil((async () => {
    await self.registration.showNotification(title, opts);
    try {
      const list = await self.registration.getNotifications();
      if (self.navigator && self.navigator.setAppBadge) await self.navigator.setAppBadge(list.length);
    } catch (e) {}
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  })());
});
