importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:"AIzaSyAjUd7LSuY1FNfl4iJ_8JXpXrfH_4_aGzc",authDomain:"danret-50fe2.firebaseapp.com",projectId:"danret-50fe2",storageBucket:"danret-50fe2.firebasestorage.app",messagingSenderId:"440628050408",appId:"1:440628050408:web:39f85d92e934a4c4748c5d"});
firebase.messaging().onBackgroundMessage(p=>self.registration.showNotification(p.data.title,{body:p.data.body,tag:p.data.cid,data:{cid:p.data.cid}}));
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow('./'))});
