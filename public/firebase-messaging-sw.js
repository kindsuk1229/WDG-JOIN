// ⚠️ 서비스워커는 환경변수를 못 읽어서 직접 값을 넣습니다

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD1pyI5B1tHoGqSAl1KVqyLbaeJ4yEF-vM",
  authDomain: "wdga-611e2.firebaseapp.com",
  projectId: "wdga-611e2",
  storageBucket: "wdga-611e2.firebasestorage.app",
  messagingSenderId: "880935774951",
  appId: "1:880935774951:web:5f9d515d127e7c6f779042",
});

const messaging = firebase.messaging();

// 백그라운드 메시지 처리 (앱이 꺼져있거나 백그라운드일 때)
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM] 백그라운드 메시지:', payload);

  const { title, body } = payload.notification || {};

  self.registration.showNotification(title || '우동골 알림', {
    body: body || '새로운 알림이 있습니다.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: payload.data,
  });
});

// 알림 클릭 시 해당 페이지로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});