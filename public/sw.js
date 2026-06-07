/* eslint-disable no-console */
/**
 * Service Worker - BON-LOG
 *
 * Why cache policy: 認証済み HTML / API レスポンスを共有 Cache Storage に置くと、
 * ログアウト後 / アカウント切替 / 同一端末の別ユーザーが stale な private content を
 * 見られるリスクがある。protected route と /api/* は原則 network-only にし、
 * `Cache-Control: no-store|private` や `Set-Cookie` を含む応答は明示的に cache を回避する。
 */

const CACHE_VERSION = 'v5'
const STATIC_CACHE = `bon-log-static-${CACHE_VERSION}`
const IMAGE_CACHE = `bon-log-images-${CACHE_VERSION}`

// precache は **未認証**で安定して取得できる public asset に限定する。
// `/` は proxy がログイン状態によって `/feed` リダイレクトを返すため対象外。
const PRECACHE_ASSETS = [
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
  '/site.webmanifest',
]

/**
 * 認証済み or private な URL パターン。これらは絶対に cache せず常に network 直結。
 * 抜けがあるとログアウト後に private データが表示される回帰を引き起こすため、
 * protected route は `lib/constants/routes.ts` の PROTECTED_PATHS と同期させる。
 */
const NETWORK_ONLY_PATTERNS = [
  /^\/api\//,            // 全 API。public でも cache すると認証ヘッダによって応答が変わるので統一して network。
  /^\/feed(\/|$)/,
  /^\/messages(\/|$)/,
  /^\/notifications(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/admin(\/|$)/,
  /^\/bonsai(\/|$)/,
  /^\/drafts(\/|$)/,
  /^\/analytics(\/|$)/,
  /^\/posts\/scheduled(\/|$)/,
  /^\/monitoring/,
  /^\/_next\/webpack-hmr/,
]

// 静的アセット (long-lived hashed asset / フォント等)。
const STATIC_PATTERNS = [
  /\/_next\/static\//,
  /\.(?:js|css|woff2?)$/,
]

// 画像 (R2 / Supabase Storage を含む CDN 上の immutable asset)。
const IMAGE_PATTERNS = [
  /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/,
  /\.r2\.dev\//,
  /\.supabase\.co\//,
]

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...')

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Precache failed:', error)
      })
  )
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...')

  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) =>
              cacheName.startsWith('bon-log-') &&
              cacheName !== STATIC_CACHE &&
              cacheName !== IMAGE_CACHE,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // 同一オリジン以外は CDN ホスト以外スルー。
  if (
    !url.origin.includes(self.location.origin) &&
    !url.href.match(/\.r2\.dev\//) &&
    !url.href.match(/\.supabase\.co\//)
  ) {
    return
  }

  // GET 以外は cache に乗せない。
  if (request.method !== 'GET') {
    return
  }

  // RSC (App Router のクライアント遷移データ) は介入せずネットワーク直結にする。
  // SW の respondWith が失敗すると router.push が RSC を取得できず遷移が固まる
  // (登録成功後に verify-email-sent へ遷移できず「登録中…」のまま) ため。
  if (
    request.headers.get('RSC') === '1' ||
    request.headers.get('Accept')?.includes('text/x-component') ||
    url.search.includes('_rsc=')
  ) {
    return
  }

  // protected route / API / monitoring は network-only。
  if (NETWORK_ONLY_PATTERNS.some((p) => p.test(url.pathname))) {
    return
  }

  if (IMAGE_PATTERNS.some((p) => p.test(url.href))) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE))
    return
  }

  if (STATIC_PATTERNS.some((p) => p.test(url.pathname))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // 残りは public HTML 想定。ただし **ドキュメントナビゲーション** (request.mode === 'navigate')
  // のみ介入する。RSC (router.refresh / router.push)・プリフェッチ・その他クライアント fetch まで
  // respondWith すると、fetch 失敗時に FetchEvent が network error 化し、呼び出し側の処理が固まる
  // (例: コメント送信後の router.refresh() が完了せず useTransition の isPending が「送信中…」のまま)。
  // 非ナビゲーションは介入せずブラウザ/Next のネイティブ処理に委ねる。
  if (request.mode === 'navigate') {
    event.respondWith(networkOnlyWithOfflineFallback(request))
  }
})

/**
 * response が private / 認証付きでないかを判定する。
 * `Cache-Control: no-store | private`、`Set-Cookie`、`Authorization`、`Vary: Cookie` 等を含む場合は
 * private と判断し cache put を拒否する (誤って公開キャッシュに入るのを防ぐ最終ガード)。
 */
function isPrivateResponse(response) {
  if (!response || !response.ok) return true
  if (response.type === 'opaque' || response.type === 'opaqueredirect') return true

  const cacheControl = (response.headers.get('Cache-Control') || '').toLowerCase()
  if (cacheControl.includes('no-store') || cacheControl.includes('private')) return true

  if (response.headers.get('Set-Cookie')) return true

  const vary = (response.headers.get('Vary') || '').toLowerCase()
  if (vary.includes('cookie') || vary.includes('authorization')) return true

  return false
}

async function safeCachePut(cacheName, request, response) {
  if (isPrivateResponse(response)) return
  try {
    const cache = await caches.open(cacheName)
    await cache.put(request, response)
  } catch (error) {
    console.warn('[SW] cache.put failed:', error)
  }
}

/** static asset 用: cache 優先、なければ network → cache 保存。 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) return cachedResponse

  try {
    const networkResponse = await fetch(request)
    await safeCachePut(cacheName, request, networkResponse.clone())
    return networkResponse
  } catch (error) {
    console.error('[SW] Cache First fetch failed:', error)
    return new Response('Offline', { status: 503 })
  }
}

/**
 * HTML 用: 常に network 直結し、応答が public ならバックグラウンドで cache。
 * オフライン時のみ公開オフラインページにフォールバックする。
 */
async function networkOnlyWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request)
    // public 文書だけ最小限の cache に乗せる (`isPrivateResponse` で弾く)。
    // ただし HTML のキャッシュ蘇生は ユーザー切替時の事故源になりやすいため、
    // 明示的に `Cache-Control: public, max-age=…` を持つ応答のみ受け入れる方針とする。
    const cacheControl = (networkResponse.headers.get('Cache-Control') || '').toLowerCase()
    if (cacheControl.includes('public')) {
      await safeCachePut(STATIC_CACHE, request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    // HTML ドキュメントナビゲーションのみ offline ページにフォールバックする。
    // RSC(text/x-component) や Next が abort した fetch に 503 "Offline" を捏造すると、
    // App Router がそれを RSC と解釈できず遷移が固まる(登録成功後の router.push 等)。
    // 非 HTML はエラーをそのまま伝播させ、Next の通常処理(ハードナビゲーション等)に委ねる。
    if (request.headers.get('accept')?.includes('text/html')) {
      console.log('[SW] network failure; serving offline fallback')
      const offlinePage = await caches.match('/offline.html')
      if (offlinePage) {
        return offlinePage
      }
    }

    throw error
  }
}

/** 画像用: cache を即返し、バックグラウンドで public 画像のみ更新。 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)

  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      await safeCachePut(cacheName, request, networkResponse.clone())
      return networkResponse
    })
    .catch((_error) => {
      console.log('[SW] image network fetch failed')
      return null
    })

  return cachedResponse || fetchPromise
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json()
    const options = {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'bon-log-notification',
      data: data.data || {},
    }

    event.waitUntil(
      self.registration.showNotification(data.title || 'BON-LOG', options),
    )
  } catch (error) {
    console.error('[SW] Push notification error:', error)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url)
        }
      }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

console.log('[SW] Service Worker loaded')
