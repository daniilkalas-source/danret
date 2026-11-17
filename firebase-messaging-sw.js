importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyAjUd7LSuY1FNfl4iJ_8JXpXrfH_4_aGzc",authDomain:"danret-50fe2.firebaseapp.com",projectId:"danret-50fe2",storageBucket:"danret-50fe2.firebasestorage.app",messagingSenderId:"440628050408",appId:"1:440628050408:web:39f85d92e934a4c4748c5d"});
const messaging=firebase.messaging();
// Пуш приходит как data-сообщение: показываем сами + ставим цифру на иконку
self.addEventListener('push',e=>{
  let d={};try{const j=e.data.json();d=j.data||j.notification||j}catch(_){}
  if(!d.title&&!d.body)return;
  const n=parseInt(d.badge||'0',10)||0;
  e.stopImmediatePropagation();
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title||'Danret',{body:d.body||'',tag:d.chat||'danret',icon:'icon-192.png',data:{chat:d.chat||''}}),
    (n&&self.navigator.setAppBadge)?self.navigator.setAppBadge(n).catch(()=>{}):Promise.resolve()
  ]));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{if(l.length)return l[0].focus();return clients.openWindow('./')}));
});
