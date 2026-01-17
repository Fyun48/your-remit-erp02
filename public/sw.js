// Service Worker for ERP PWA
const CACHE_NAME = 'erp-cache-v1'

// 需要預先快取的資源
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/manifest.json',
]

// 安裝事件 - 預先快取資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache')
      return cache.addAll(PRECACHE_ASSETS)
    })
  )
  // 強制新的 Service Worker 立即生效
  self.skipWaiting()
})

// 啟動事件 - 清理舊快取
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  // 立即控制所有頁面
  self.clients.claim()
})

// 攔截請求 - 網路優先策略
self.addEventListener('fetch', (event) => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return

  // 跳過 API 請求和 tRPC 請求（這些需要即時資料）
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 如果網路請求成功，快取並返回
        if (response && response.status === 200) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone)
          })
        }
        return response
      })
      .catch(() => {
        // 網路失敗時，嘗試從快取返回
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse
          }
          // 如果沒有快取，返回離線頁面（如果有的話）
          if (event.request.mode === 'navigate') {
            return caches.match('/dashboard')
          }
        })
      })
  )
})

// 接收來自主頁面的訊息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
