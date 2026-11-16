importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyAjUd7LSuY1FNfl4iJ_8JXpXrfH_4_aGzc",authDomain:"danret-50fe2.firebaseapp.com",projectId:"danret-50fe2",storageBucket:"danret-50fe2.firebasestorage.app",messagingSenderId:"440628050408",appId:"1:440628050408:web:39f85d92e934a4c4748c5d"});
const messaging=firebase.messaging();

// Пуш-уведомления в фоне (если сервер шлёт только data без notification)
messaging.onBackgroundMessage(p=>{
  if(p.notification)return;
  const d=p.data||{};
  self.registration.showNotification(d.title||'Danret',{body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',tag:d.tag||undefined});
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
    for(const c of l){if('focus' in c)return c.focus()}
    return clients.openWindow('./');
  }));
});

// Офлайн-оболочка: сначала сеть, при отсутствии интернета — копия из кэша
const CACHE='danret-v1',SHELL=['./','index.html','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp));return res}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
});
