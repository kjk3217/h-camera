const CACHE_VERSION = 'v1';
const CACHE_NAME = `food-analysis-${CACHE_VERSION}`;
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

const staticAssets = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// 서비스 워커 설치
self.addEventListener('install', event => {
    console.log('서비스 워커 설치 중...');
    event.waitUntil(
        caches.open(STATIC_CACHE).then(cache => {
            return cache.addAll(staticAssets);
        }).then(() => {
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
                cacheNames
                    .filter(cacheName => {
                        return cacheName.startsWith('food-analysis-') || 
                               cacheName.startsWith('static-') || 
                               cacheName.startsWith('images-') || 
                               cacheName.startsWith('api-');
                    })
                    .filter(cacheName => {
                        return !cacheName.endsWith(CACHE_VERSION);
                    })
                    .map(cacheName => {
                        console.log('오래된 캐시 삭제:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// 네트워크 요청 처리
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // API 요청은 네트워크 우선
    if (url.hostname.includes('googleapis.com')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const responseToCache = response.clone();
                        caches.open(API_CACHE).then(cache => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
        return;
    }

    // 이미지 요청 처리
    if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
        event.respondWith(cacheImages(request));
        return;
    }

    // 나머지 요청은 캐시 우선
    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) {
                // 백그라운드에서 업데이트
                fetch(request).then(response => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const responseToCache = response.clone();
                        caches.open(STATIC_CACHE).then(cache => {
                            cache.put(request, responseToCache);
                        });
                    }
                });
                return cachedResponse;
            }

            return fetch(request).then(response => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                const responseToCache = response.clone();
                caches.open(STATIC_CACHE).then(cache => {
                    cache.put(request, responseToCache);
                });

                return response;
            });
        }).catch(() => {
            // 오프라인 폴백
            if (request.destination === 'document') {
                return caches.match('./index.html');
            }
        })
    );
});

// 이미지 캐싱 함수
async function cacheImages(request) {
    const cache = await caches.open(IMAGE_CACHE);
    const cachedImage = await cache.match(request);
    
    if (cachedImage) {
        return cachedImage;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('이미지 로드 실패:', error);
        
        // 기본 이미지가 있다면 반환
        const fallbackImage = await cache.match('./logo-image.png');
        if (fallbackImage) {
            return fallbackImage;
        }
        
        return new Response('', {
            status: 404,
            statusText: 'Not Found'
        });
    }
}

// 캐시 크기 관리
async function trimCache(cacheName, maxItems) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxItems) {
        const keysToDelete = keys.slice(0, keys.length - maxItems);
        await Promise.all(keysToDelete.map(key => cache.delete(key)));
        console.log(`${keysToDelete.length}개의 캐시 항목 삭제됨`);
    }
}

// 메시지 리스너
self.addEventListener('message', event => {
    if (event.data.command === 'trimCaches') {
        Promise.all([
            trimCache(IMAGE_CACHE, 50),
            trimCache(API_CACHE, 20)
        ]);
    }
    
    if (event.data.command === 'skipWaiting') {
        self.skipWaiting();
    }
});

// 백그라운드 동기화
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    console.log('백그라운드 동기화 실행');
    // 필요시 서버 동기화 로직 추가
}

// 푸시 알림 (향후 구현용)
self.addEventListener('push', event => {
    if (event.data) {
        const options = {
            body: event.data.text(),
            icon: './icon-192.png',
            badge: './icon-192.png',
            vibrate: [200, 100, 200],
            tag: 'food-analysis-notification'
        };
        
        event.waitUntil(
            self.registration.showNotification('음식 분석 앱', options)
        );
    }
});

// 알림 클릭 처리
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('./')
    );
});