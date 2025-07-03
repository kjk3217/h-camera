// 서비스 워커 버전
const CACHE_NAME = 'diabetes-app-v1.0.0';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 서비스 워커 설치
self.addEventListener('install', event => {
  console.log('서비스 워커 설치 중...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('파일 캐싱 중...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('서비스 워커 설치 완료');
        // 새 서비스 워커를 즉시 활성화
        return self.skipWaiting();
      })
  );
});

// 서비스 워커 활성화
self.addEventListener('activate', event => {
  console.log('서비스 워커 활성화 중...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // 이전 버전의 캐시 삭제
          if (cacheName !== CACHE_NAME) {
            console.log('이전 캐시 삭제:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('서비스 워커 활성화 완료');
      // 모든 클라이언트에서 새 서비스 워커 사용
      return self.clients.claim();
    })
  );
});

// 네트워크 요청 가로채기
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Gemini API 요청은 캐시하지 않음
  if (url.hostname === 'generativelanguage.googleapis.com') {
    event.respondWith(
      fetch(request).catch(() => {
        // API 요청 실패 시 오프라인 메시지 반환
        return new Response(
          JSON.stringify({
            error: '인터넷 연결이 필요합니다',
            offline: true
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }
  
  // 기본 캐시 전략: Cache First (캐시 우선)
  event.respondWith(
    caches.match(request)
      .then(response => {
        // 캐시에 있으면 캐시에서 반환
        if (response) {
          return response;
        }
        
        // 캐시에 없으면 네트워크에서 가져오기
        return fetch(request).then(response => {
          // 유효한 응답이 아니면 그대로 반환
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // 응답을 복사하여 캐시에 저장
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(request, responseToCache);
            });
          
          return response;
        });
      })
      .catch(() => {
        // 네트워크 오류 시 오프라인 페이지 반환
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
      })
  );
});

// 백그라운드 동기화 (선택사항)
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('백그라운드 동기화 실행');
    event.waitUntil(doBackgroundSync());
  }
});

// 푸시 알림 처리 (선택사항)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey
      },
      actions: [
        {
          action: 'explore',
          title: '확인하기',
          icon: './icon-192.png'
        },
        {
          action: 'close',
          title: '닫기',
          icon: './icon-192.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    // 앱 열기
    event.waitUntil(
      clients.openWindow('./')
    );
  } else if (event.action === 'close') {
    // 알림만 닫기
    event.notification.close();
  }
});

// 백그라운드 동기화 함수
async function doBackgroundSync() {
  try {
    // 저장된 분석 데이터 동기화
    const analysisData = await getStoredAnalysisData();
    if (analysisData.length > 0) {
      // 서버에 데이터 전송 로직
      console.log('분석 데이터 동기화 완료');
    }
  } catch (error) {
    console.error('백그라운드 동기화 실패:', error);
  }
}

// 저장된 분석 데이터 가져오기
async function getStoredAnalysisData() {
  // IndexedDB 또는 다른 저장소에서 데이터 가져오기
  return [];
}

// 서비스 워커 업데이트 알림
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 오류 처리
self.addEventListener('error', event => {
  console.error('서비스 워커 오류:', event.error);
});

// 처리되지 않은 Promise 거부 처리
self.addEventListener('unhandledrejection', event => {
  console.error('처리되지 않은 Promise 거부:', event.reason);
  event.preventDefault();
});

console.log('서비스 워커 로드 완료');