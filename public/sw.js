// 우동골 Service Worker
// 오프라인 지원 + 캐싱 전략

const CACHE_NAME = 'udonggol-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// Install: 정적 파일 캐싱
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: 오래된 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Firebase 요청은 캐싱하지 않음
  if (event.request.url.includes('firestore') || event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공하면 캐시에 저장
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
