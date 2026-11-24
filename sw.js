// Service Worker (PWA) — 오프라인에서도 열리게 해주되, 온라인일 땐 항상 최신 내용을 우선 가져옴
const CACHE_NAME = 'insurance-calc-v3';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json'
];

// 설치 — 새 서비스워커가 설치되면 바로 활성화 대기열로 넘어가게 함(skipWaiting)
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// 활성화 — 예전 버전 캐시는 지우고, 열려있는 화면에도 바로 새 서비스워커가 적용되게 함(clients.claim)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// 요청 처리 — 네트워크(최신 내용)를 먼저 시도하고, 성공하면 캐시도 갱신함.
// 오프라인이라 네트워크 요청이 실패할 때만 캐시된 이전 내용을 보여줌
// cache:'no-cache' — 브라우저가 10분간 들고 있는 파일(GitHub Pages max-age=600)을 그대로 쓰지 말고
// 서버에 바뀌었는지 꼭 물어봄(안 바뀌었으면 304로 짧게 끝남). 아이폰 홈 화면 앱이 예전 화면을 붙잡던 문제 대응
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const fresh = req.mode === 'navigate'
    ? new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(req, { cache: 'no-cache' });
  event.respondWith(
    fetch(fresh)
      .then(response => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(req))
  );
});
