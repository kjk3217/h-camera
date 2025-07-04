/* PWA Service Worker v4 */
const V='v4'; const STATIC=`static-${V}`; const IMG=`img-${V}`;
const APP=['/','/index.html','/capture.html','/offline.html',
           '/style.css','/app.js','/capture.js',
           '/manifest.json','/logo-image.png',
           '/icon-192.png','/icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(STATIC).then(c=>c.addAll(APP)));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>![STATIC,IMG].includes(k)).map(k=>caches.delete(k))
  )));
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  const isImg=e.request.destination==='image'||/\.(png|jpe?g|gif|svg|webp)$/.test(url.pathname);

  if(isImg){
    e.respondWith(cacheFirst(e.request,IMG,'/icon-192.png')); return;
  }
  if(e.request.mode==='navigate'){
    e.respondWith(
      fetch(e.request)
        .then(r=>staleWhileRevalidate(e.request,r,STATIC))
        .catch(()=>caches.match('/offline.html'))
    ); return;
  }
  e.respondWith(cacheFirst(e.request,STATIC));
});

async function cacheFirst(req,cacheName,fallback){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(req);
  if(cached) return cached;
  try{
    const fresh=await fetch(req);
    cache.put(req,fresh.clone());
    return fresh;
  }catch{
    return fallback?caches.match(fallback):Response.error();
  }
}
async function staleWhileRevalidate(req,res,cacheName){
  const cache=await caches.open(cacheName);
  cache.put(req,res.clone());
  return res;
}
