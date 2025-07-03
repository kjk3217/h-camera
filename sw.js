// 서비스 워커 - 음식 분석 앱 v1.0.0
const CACHE_NAME = 'food-analysis-app-v1.0.0';
const APP_SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json'
];

const IMAGE_FILES = [
  './icon-192.png',
  './icon-512.png',
  './main-logo.png'
];

const ALL_CACHE_FILES = [...APP_SHELL_FILES, ...IMAGE_FILES];

// 서비스 워커 설치
self.addEventListener('install', event => {
  console.log('🔧 서비스 워커 설치 시작...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 앱 셸 캐싱 중...');
        return cache.addAll(ALL_CACHE_FILES);
      })
      .then(() => {
        console.log('✅ 서비스 워커 설치 완료');
        // 새 서비스 워커를 즉시 활성화
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ 서비스 워커 설치 실패:', error);
      })
  );
});

// 서비스 워커 활성화
self.addEventListener('activate', event => {
  console.log('🚀 서비스 워커 활성화 시작...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // 이전 버전의 캐시 삭제
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ 이전 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ 서비스 워커 활성화 완료');
        // 모든 클라이언트에서 새 서비스 워커 사용
        return self.clients.claim();
      })
      .catch(error => {
        console.error('❌ 서비스 워커 활성화 실패:', error);
      })
  );
});

// 네트워크 요청 처리
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Gemini API 요청 처리
  if (url.hostname === 'generativelanguage.googleapis.com') {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // 이미지 요청 처리
  if (request.destination === 'image') {
    event.respondWith(handleImageRequest(request));
    return;
  }
  
  // 앱 셸 요청 처리 (Cache First 전략)
  event.respondWith(handleAppShellRequest(request));
});

// API 요청 처리 (Network First)
async function handleAPIRequest(request) {
  try {
    console.log('🌐 API 요청:', request.url);
    const response = await fetch(request);
    return response;
  } catch (error) {
    console.error('❌ API 요청 실패:', error);
    return new Response(
      JSON.stringify({
        error: '인터넷 연결이 필요합니다',
        offline: true,
        message: '음식 분석을 위해 인터넷에 연결해주세요'
     }),
     {
       status: 503,
       headers: { 
         'Content-Type': 'application/json',
         'Cache-Control': 'no-cache'
       }
     }
   );
 }
}

// 이미지 요청 처리 (Cache First)
async function handleImageRequest(request) {
 try {
   const cachedResponse = await caches.match(request);
   if (cachedResponse) {
     console.log('💾 캐시에서 이미지 반환:', request.url);
     return cachedResponse;
   }
   
   console.log('🌐 네트워크에서 이미지 로드:', request.url);
   const response = await fetch(request);
   
   // 성공한 응답만 캐시
   if (response.ok) {
     const cache = await caches.open(CACHE_NAME);
     cache.put(request, response.clone());
   }
   
   return response;
 } catch (error) {
   console.error('❌ 이미지 로드 실패:', error);
   // 기본 이미지 반환 (선택사항)
   return new Response('', { status: 404 });
 }
}

// 앱 셸 요청 처리 (Cache First)
async function handleAppShellRequest(request) {
 try {
   const cachedResponse = await caches.match(request);
   if (cachedResponse) {
     console.log('💾 캐시에서 반환:', request.url);
     return cachedResponse;
   }
   
   console.log('🌐 네트워크에서 로드:', request.url);
   const response = await fetch(request);
   
   // 성공한 응답만 캐시
   if (response.ok && response.type === 'basic') {
     const cache = await caches.open(CACHE_NAME);
     cache.put(request, response.clone());
   }
   
   return response;
 } catch (error) {
   console.error('❌ 요청 처리 실패:', error);
   
   // HTML 요청 실패 시 메인 페이지 반환
   if (request.destination === 'document') {
     const cachedIndex = await caches.match('./index.html');
     if (cachedIndex) {
       return cachedIndex;
     }
   }
   
   // 오프라인 응답
   return new Response(
     '오프라인 상태입니다. 인터넷에 연결해주세요.',
     {
       status: 503,
       headers: { 'Content-Type': 'text/plain; charset=utf-8' }
     }
   );
 }
}

// 백그라운드 동기화
self.addEventListener('sync', event => {
 console.log('🔄 백그라운드 동기화:', event.tag);
 
 if (event.tag === 'food-analysis-sync') {
   event.waitUntil(syncAnalysisData());
 }
});

// 푸시 알림 처리
self.addEventListener('push', event => {
 console.log('📬 푸시 알림 수신');
 
 if (event.data) {
   const data = event.data.json();
   const options = {
     body: data.body || '음식 분석 결과를 확인하세요',
     icon: './icon-192.png',
     badge: './icon-192.png',
     vibrate: [200, 100, 200],
     data: {
       dateOfArrival: Date.now(),
       primaryKey: data.primaryKey || 'food-analysis'
     },
     actions: [
       {
         action: 'view',
         title: '확인하기',
         icon: './icon-192.png'
       },
       {
         action: 'close',
         title: '닫기',
         icon: './icon-192.png'
       }
     ],
     requireInteraction: true
   };
   
   event.waitUntil(
     self.registration.showNotification(
       data.title || '음식 분석 앱',
       options
     )
   );
 }
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
 console.log('🔔 알림 클릭:', event.action);
 
 event.notification.close();
 
 if (event.action === 'view') {
   event.waitUntil(
     clients.openWindow('./')
   );
 }
});

// 분석 데이터 동기화
async function syncAnalysisData() {
 try {
   console.log('🔄 분석 데이터 동기화 시작');
   
   // 실제 구현에서는 서버와 데이터 동기화
   // 현재는 로컬 데이터만 정리
   
   console.log('✅ 분석 데이터 동기화 완료');
 } catch (error) {
   console.error('❌ 데이터 동기화 실패:', error);
 }
}

// 캐시 크기 관리
async function manageCacheSize() {
 try {
   const cache = await caches.open(CACHE_NAME);
   const keys = await cache.keys();
   
   // 캐시 크기가 100개를 초과하면 오래된 항목 삭제
   if (keys.length > 100) {
     const oldestKeys = keys.slice(0, keys.length - 100);
     await Promise.all(oldestKeys.map(key => cache.delete(key)));
     console.log('🧹 오래된 캐시 항목 삭제 완료');
   }
 } catch (error) {
   console.error('❌ 캐시 관리 실패:', error);
 }
}

// 주기적 캐시 관리
setInterval(manageCacheSize, 24 * 60 * 60 * 1000); // 24시간마다

// 메시지 처리
self.addEventListener('message', event => {
 console.log('📨 메시지 수신:', event.data);
 
 if (event.data && event.data.type === 'SKIP_WAITING') {
   self.skipWaiting();
 }
 
 if (event.data && event.data.type === 'CACHE_UPDATE') {
   event.waitUntil(updateCache());
 }
});

// 캐시 업데이트
async function updateCache() {
 try {
   console.log('🔄 캐시 업데이트 시작');
   const cache = await caches.open(CACHE_NAME);
   await cache.addAll(APP_SHELL_FILES);
   console.log('✅ 캐시 업데이트 완료');
 } catch (error) {
   console.error('❌ 캐시 업데이트 실패:', error);
 }
}

// 오류 처리
self.addEventListener('error', event => {
 console.error('❌ 서비스 워커 오류:', event.error);
});

self.addEventListener('unhandledrejection', event => {
 console.error('❌ 처리되지 않은 Promise 거부:', event.reason);
 event.preventDefault();
});

console.log('🚀 음식 분석 앱 서비스 워커 로드 완료');
