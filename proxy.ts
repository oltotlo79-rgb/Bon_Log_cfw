import NextAuth from 'next-auth'
import * as Sentry from '@sentry/nextjs'
import { authConfig } from '@/lib/auth.config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  NONCE_BYTE_LENGTH,
  HSTS_MAX_AGE_SECONDS,
  MAINTENANCE_CACHE_TTL_MS,
  REFERER_LOG_PREVIEW_LENGTH,
} from '@/lib/constants/limits'
import {
  PROTECTED_PATHS,
  MAINTENANCE_ALLOWED_PATHS,
  AUTH_ONLY_PATHS,
  WEBHOOK_PATHS,
  ROUTE_ADMIN,
  ROUTE_FEED,
  ROUTE_HOME,
  ROUTE_LOGIN,
  ROUTE_MAINTENANCE,
  ROUTE_AD_FRAME_API,
  NEXT_INTERNAL_PREFIX,
  API_PREFIX,
} from '@/lib/constants/routes'
import { getAppUrl } from '@/lib/env'

const { auth } = NextAuth(authConfig)

/**
 * セキュリティ・運用イベントを Sentry と console に同時送信する。
 *
 * Edge Middleware では `console.warn/error` だけだと本番のオブザーバビリティが
 * Vercel logs に閉じてしまい、PagerDuty 等への連動も難しい。Sentry に投げれば
 * リリース・環境ごとの集計と通知ができる。
 *
 * `@sentry/nextjs` は `enabled: false`（dev/test 環境）のとき自動で no-op に
 * なるため、本番以外で副作用が生じることはない。
 */
function reportSecurityEvent(
  tag: 'SECURITY' | 'MAINTENANCE',
  message: string,
  level: 'warning' | 'error' | 'fatal',
  extra?: Record<string, unknown>,
): void {
  // ローカルおよび Vercel logs には従来通り出力（人間が grep しやすいよう [TAG] プレフィックス維持）
  const formatted = `[${tag}] ${message}`
  if (level === 'warning') {
    console.warn(formatted)
  } else {
    console.error(formatted)
  }

  // Sentry には構造化された形で送る。タグで filter できるよう category も付与。
  try {
    Sentry.captureMessage(formatted, {
      level,
      tags: { category: tag.toLowerCase() },
      extra,
    })
  } catch {
    // Sentry の captureMessage が何らかの理由で失敗してもリクエスト処理は続行する。
  }
}

/**
 * Edge Runtime互換のタイミング安全な文字列比較
 *
 * 長さが異なる場合も早期リターンせず常に全バイトを比較することで、
 * タイミング攻撃による文字列長の推測を防ぐ。
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)
  const maxLen = Math.max(aBytes.length, bBytes.length)
  // Pad both arrays to the same length to avoid early exit on length difference
  const aPadded = new Uint8Array(maxLen)
  const bPadded = new Uint8Array(maxLen)
  aPadded.set(aBytes)
  bPadded.set(bBytes)
  let result = 0
  for (let i = 0; i < maxLen; i++) {
    // padded だが TS は Uint8Array index を number | undefined と推論する。
    // 範囲内アクセスなので nullish 演算子で 0 にフォールバック (XOR 値に影響しない)。
    result |= (aPadded[i] ?? 0) ^ (bPadded[i] ?? 0)
  }
  // Also check lengths to prevent accepting padded matches
  return result === 0 && aBytes.length === bBytes.length
}

/**
 * CSP の `strict-dynamic` インライン script 許可用 nonce を生成する。
 * Edge Runtime 互換のため Web Crypto API を使う (Node の crypto.randomBytes は不可)。
 */
function generateNonce(): string {
  const array = new Uint8Array(NONCE_BYTE_LENGTH)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
}

/**
 * Basic 認証チャレンジ用 401 レスポンス。
 * RFC 7617 準拠の `WWW-Authenticate` ヘッダー付き。
 */
const BASIC_AUTH_REALM = 'Basic realm="Secure Area"'

function basicAuthChallenge(body: string): NextResponse {
  return new NextResponse(body, {
    status: 401,
    headers: { 'WWW-Authenticate': BASIC_AUTH_REALM },
  })
}

/**
 * Origin 検証で使う 403 JSON レスポンス。
 * Server Action / API クライアントが扱いやすいよう `application/json` を明示する。
 */
function forbiddenJson(error: string): NextResponse {
  return new NextResponse(JSON.stringify({ error }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Basic認証のチェック
function checkBasicAuth(request: NextRequest): NextResponse | null {
  const enabled = process.env.BASIC_AUTH_ENABLED === 'true'
  const basicAuthUser = process.env.BASIC_AUTH_USER
  const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD

  // ENABLED フラグが false ならスキップ（明示的無効化）
  if (!enabled) return null

  // ENABLED=true だが認証情報が欠けている場合は fail-closed で 503 を返す。
  // 旧実装は fail-open で通過させていたが、誤設定時に認証自体をバイパスする
  // 重大なセキュリティリスクがあったため、サービス拒否側に倒す。
  if (!basicAuthUser || !basicAuthPassword) {
    // 認証情報の欠落は重大な誤設定なので fatal で送信し、即時にアラートを発火させる。
    reportSecurityEvent(
      'SECURITY',
      'BASIC_AUTH_ENABLED=true だが BASIC_AUTH_USER/PASSWORD が未設定のため、認証をバイパスせず 503 を返します',
      'fatal',
    )
    return new NextResponse('Service temporarily unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return basicAuthChallenge('Authentication required')
  }

  const [scheme, encoded] = authHeader.split(' ')
  if (scheme !== 'Basic' || !encoded) {
    return basicAuthChallenge('Authentication required')
  }

  // Base64デコード
  const decoded = atob(encoded)
  const colonIndex = decoded.indexOf(':')
  if (colonIndex === -1) {
    return basicAuthChallenge('Invalid credentials')
  }
  const user = decoded.slice(0, colonIndex)
  const password = decoded.slice(colonIndex + 1)

  // タイミング安全な比較（長さが異なっても常に全バイトを比較する）
  const userMatch = timingSafeEqual(user, basicAuthUser)
  const passwordMatch = timingSafeEqual(password, basicAuthPassword)

  if (!userMatch || !passwordMatch) {
    return basicAuthChallenge('Invalid credentials')
  }

  // 認証成功
  return null
}

/**
 * 許可されたオリジンを取得
 */
function getAllowedOrigins(): string[] {
  const appUrl = getAppUrl()
  const additionalOrigins = process.env.ALLOWED_ORIGINS?.split(',') || []

  try {
    const appOrigin = new URL(appUrl).origin
    return [appOrigin, ...additionalOrigins].filter(Boolean)
  } catch {
    return ['http://localhost:3000', ...additionalOrigins].filter(Boolean)
  }
}

/**
 * Originヘッダーを検証（Server Actions用）
 *
 * POSTリクエストに対してOriginヘッダーを検証し、
 * クロスオリジンからの不正なリクエストをブロック
 */
function validateOriginHeader(request: NextRequest): NextResponse | null {
  // POSTリクエスト以外はスキップ
  if (request.method !== 'POST') {
    return null
  }

  // APIルートでのOrigin検証（Server Actions含む）
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Server Actions（next-actionヘッダー付きPOST）でOriginがない場合は拒否
  const isServerAction = request.headers.get('next-action') !== null
  if (isServerAction && !origin) {
    // Server Action にプレーンテキストで返してきた経緯を維持（旧実装互換）
    return new NextResponse('Forbidden: Missing Origin header', { status: 403 })
  }

  // Originヘッダーがある場合は検証
  if (origin) {
    const allowedOrigins = getAllowedOrigins()
    if (!allowedOrigins.includes(origin)) {
      reportSecurityEvent('SECURITY', `Blocked request from unauthorized origin: ${origin}`, 'warning', {
        origin,
        method: request.method,
        path: request.nextUrl.pathname,
      })
      return forbiddenJson('Unauthorized origin')
    }
  }

  // Origin が無い場合の Referer バックアップ検証。
  //
  // Referer がパースできない場合:
  //   旧実装では try/catch で握りつぶして通過させていたが、これは CSRF 攻撃の
  //   穴になり得る（Origin なし + 不正 Referer = 検証スキップ）。正規ブラウザは
  //   Referer を送るなら完全な URL を送るか、さもなくば送信自体を省略するため、
  //   パース不能な Referer は不正クライアントとみなして拒否する。
  if (!origin && referer) {
    let refererOrigin: string
    try {
      refererOrigin = new URL(referer).origin
    } catch {
      // ログ量を抑えるため先頭 100 文字のみ。トークン等の漏洩リスクを低減する。
      reportSecurityEvent(
        'SECURITY',
        `Blocked request with malformed Referer: ${referer.slice(0, REFERER_LOG_PREVIEW_LENGTH)}`,
        'warning',
        { method: request.method, path: request.nextUrl.pathname },
      )
      return forbiddenJson('Invalid Referer header')
    }

    const allowedOrigins = getAllowedOrigins()
    if (!allowedOrigins.includes(refererOrigin)) {
      reportSecurityEvent('SECURITY', `Blocked request from unauthorized referer: ${refererOrigin}`, 'warning', {
        refererOrigin,
        method: request.method,
        path: request.nextUrl.pathname,
      })
      return forbiddenJson('Unauthorized origin')
    }
  }

  return null
}

/**
 * CSP ヘッダー文字列を組み立てる。
 *
 * Why extract: Next.js (App Router) はリクエストヘッダーの `Content-Security-Policy` を
 * 検出すると SSR 時に内部で生成する `<script>` タグへ自動で `nonce` 属性を付与する。
 * このため response だけでなく request にも同一の CSP を載せる必要がある。
 * 同じ文字列を 2 箇所に渡せるよう生成ロジックを関数化する。
 *
 * @param nonce - リクエスト毎に生成された CSP nonce
 * @returns CSP ヘッダー値 (`directive1; directive2; ...`)
 */
function buildCspHeader(nonce: string): string {
  // CSP: nonce + strict-dynamic 厳格モード。
  // `'unsafe-inline'` を除外する理由: CSP Level 3 (Chrome 52+/Firefox 76+/Safari 15.4+) では
  // strict-dynamic があれば実質無視されるが、Level 1/2 ブラウザでは生インラインスクリプトが通って
  // しまうため、XSS 耐性を優先して付けない。dev のみ HMR のため `'unsafe-eval'` を許可。
  // 参考: https://web.dev/articles/strict-csp
  const nonceDirective = `'nonce-${nonce}'`
  const cspReportUri = process.env.NEXT_PUBLIC_CSP_REPORT_URI
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' ${nonceDirective} 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval' 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.r2.dev https://images.unsplash.com https://*.tile.openstreetmap.org https://*.googlesyndication.com https://*.google.com https://*.google.co.jp https://*.doubleclick.net https://*.gstatic.com https://*.adtrafficquality.google https://*.shinobi.jp https://cnobi.jp https://*.cnobi.jp https://*.im-apps.net",
    "media-src 'self' blob: https://*.r2.dev",
    "connect-src 'self' https://*.r2.dev https://*.r2.cloudflarestorage.com https://nominatim.openstreetmap.org https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.google-analytics.com https://*.adtrafficquality.google https://*.shinobi.jp https://cnobi.jp https://*.cnobi.jp https://*.im-apps.net https://*.criteo.com",
    "frame-src 'self' https://*.doubleclick.net https://*.google.com https://*.googlesyndication.com https://*.adtrafficquality.google https://*.shinobi.jp https://cnobi.jp https://*.cnobi.jp https://*.criteo.com https://gum.criteo.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
    cspReportUri ? `report-uri ${cspReportUri}` : '',
  ].filter(Boolean)
  return cspDirectives.join('; ')
}

/**
 * nonce と CSP をリクエストヘッダーに載せた `NextResponse.next()` を返す。
 *
 * Why both `x-nonce` and `Content-Security-Policy` on request headers:
 *   Next.js (App Router) は request headers の `Content-Security-Policy` を検出すると
 *   SSR で生成する `<script>` タグへ自動的に `nonce` 属性を付与する
 *   (https://nextjs.org/docs/app/guides/content-security-policy)。
 *   これがないと strict CSP (`'strict-dynamic'`, `'unsafe-inline'` なし) では
 *   ハイドレーションスクリプトが全てブロックされ、クライアント側コンポーネントが
 *   SSR placeholder のまま動作しない (例: 画像のクロスフェード再生が始まらない)。
 *
 *   `x-nonce` は Server Components から nonce を参照する箇所用 (App Router 慣習)。
 *   両方を載せることで「SSR が自動付与」と「コードから明示参照」の両経路をカバーする。
 */
function nextWithNonce(request: NextRequest, nonce: string, cspHeader: string): NextResponse {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

/**
 * セキュリティヘッダーを追加する関数
 *
 * @param response - NextResponseオブジェクト
 * @param cspHeader - 事前に組み立てた CSP ヘッダー値 (request headers と同一)
 * @returns セキュリティヘッダーが追加されたNextResponse
 */
function addSecurityHeaders(response: NextResponse, cspHeader: string): NextResponse {
  // XSS保護
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // コンテンツタイプスニッフィング防止
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // クリックジャッキング防止
  response.headers.set('X-Frame-Options', 'DENY')

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
  )

  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  // CSP は buildCspHeader で組み立て済み (request headers と完全同一)。
  response.headers.set('Content-Security-Policy', cspHeader)

  // nonce is passed to Server Components via request headers (x-nonce on requestHeaders),
  // not exposed in the response to avoid leaking it to the client.

  // HTTPS強制（本番環境のみ）
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains; preload`
    )
  }

  return response
}

/**
 * 認証・運用状態に依存するリダイレクトを HTTP キャッシュさせない形で返す。
 *
 * Why: proxy はログイン Cookie の有無で `/` → `/feed`、protected → `/login` 等の
 * リダイレクトを返す。この 307 がブラウザ HTTP キャッシュに保存されると、
 * 後でログアウトして full-page navigation (`<a href="/">`) で `/` を踏んでも、
 * キャッシュ済みリダイレクトが Cookie を再評価せず `/feed` へ飛ばしてしまう。
 * (Next.js の Router Cache とは別レイヤ。`<a>` 化で Router Cache は回避済みだが
 *  HTTP cache 起因の同症状が残るため、ここで `no-store` を付けて根治する。)
 */
function redirectNoStore(url: URL, cspHeader: string): NextResponse {
  const response = addSecurityHeaders(NextResponse.redirect(url), cspHeader)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

/**
 * メンテナンス状態のインメモリキャッシュ
 *
 * Edge Middleware は全リクエストで実行されるため、
 * 毎回 Redis に問い合わせると不要なレイテンシが加算される。
 * 短い TTL（{@link MAINTENANCE_CACHE_TTL_MS}）のインメモリキャッシュで Redis 呼び出しを大幅に削減する。
 * メンテナンスモード切替は即時性が不要（最大TTL分の遅延は許容範囲）。
 */
let maintenanceCache: { value: boolean; expires: number } | null = null

/**
 * Upstash Redis REST APIでメンテナンス状態を取得（Edge互換）
 * 自己HTTPリクエストを避けるため、Redisに直接アクセスする。
 * インメモリキャッシュにより、30秒間は Redis へのリクエストを省略する。
 */
async function getMaintenanceStatus(): Promise<boolean> {
  // キャッシュが有効ならRedisをスキップ
  const now = Date.now()
  if (maintenanceCache && maintenanceCache.expires > now) {
    return maintenanceCache.value
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!redisUrl || !redisToken) return false

  try {
    const response = await fetch(`${redisUrl}/get/maintenance_mode_enabled`, {
      headers: { Authorization: `Bearer ${redisToken}` },
      cache: 'no-store',
    })
    if (!response.ok) {
      maintenanceCache = { value: false, expires: now + MAINTENANCE_CACHE_TTL_MS }
      return false
    }
    const data = await response.json()
    const result = data.result === 'true' || data.result === '1'
    maintenanceCache = { value: result, expires: now + MAINTENANCE_CACHE_TTL_MS }
    return result
  } catch {
    // エラー時もキャッシュして連続的なリクエストを防止
    maintenanceCache = { value: false, expires: now + MAINTENANCE_CACHE_TTL_MS }
    return false
  }
}

/**
 * パスがメンテナンス中でもアクセス可能かチェック
 */
function isMaintenanceAllowedPath(pathname: string): boolean {
  return MAINTENANCE_ALLOWED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  )
}

export default auth(async (req) => {
  const { nextUrl } = req

  // apex (www なし) ドメインへのアクセスは canonical な www へ 308 リダイレクトする。
  // canonical host は NEXT_PUBLIC_APP_URL 由来 (例: www.bon-log.com)。apex で配信すると
  // ページの origin が apex になり、Server Actions / Sentry tunnel の Origin・Referer 検証
  // (allowedOrigins は www のみ) で弾かれる。canonical / sitemap / CSP も www 前提のため、
  // CSRF・SEO 両面で host を 1 つに集約する。fly は Host を転送するためヘッダから判定する
  // (Next standalone の request.url は内部バインド 0.0.0.0 を指すため URL からは判定不可)。
  let canonicalHost = ''
  try {
    canonicalHost = new URL(getAppUrl()).host
  } catch {
    canonicalHost = ''
  }
  if (canonicalHost.startsWith('www.')) {
    const apexHost = canonicalHost.slice(4)
    const rawHost = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
    const reqHostname = rawHost.split(',')[0]?.trim().split(':')[0] ?? ''
    if (reqHostname === apexHost) {
      return NextResponse.redirect(
        new URL(`https://${canonicalHost}${nextUrl.pathname}${nextUrl.search}`),
        308,
      )
    }
  }

  // CSP nonce を生成（各リクエストで一意の値）
  const nonce = generateNonce()
  // CSP ヘッダーは request / response 双方に同一値を載せる。
  // Why: Next.js (App Router) は request headers の `Content-Security-Policy` を検出して
  // SSR で生成する `<script>` タグへ自動で `nonce` 属性を付与する。
  // 公式ガイド: https://nextjs.org/docs/app/guides/content-security-policy
  const cspHeader = buildCspHeader(nonce)

  // Server Actions（POSTリクエスト）のOrigin検証
  // ただし、外部Webhook用のAPIは除外
  const isWebhook = WEBHOOK_PATHS.some((path) => nextUrl.pathname.startsWith(path))

  if (!isWebhook) {
    const originError = validateOriginHeader(req)
    if (originError) {
      return originError
    }
  }

  // 広告iframeルートはCSPを適用しない（APIルート側で独自CSPを設定）
  if (nextUrl.pathname === ROUTE_AD_FRAME_API) {
    return NextResponse.next()
  }

  // APIルートはBasic認証をスキップ（Webhook等のため）
  if (nextUrl.pathname.startsWith(API_PREFIX)) {
    return addSecurityHeaders(nextWithNonce(req, nonce, cspHeader), cspHeader)
  }

  // Server Actions（Next-Actionヘッダー付きPOST）がメンテナンス許可パスから
  // 呼ばれた場合はBasic認証・メンテナンスチェックをスキップ
  // これによりログインページ等のServer Actionsがメンテナンス中も動作する
  const isServerAction = req.method === 'POST' && req.headers.get('next-action')
  if (isServerAction && isMaintenanceAllowedPath(nextUrl.pathname)) {
    return addSecurityHeaders(nextWithNonce(req, nonce, cspHeader), cspHeader)
  }

  // Basic認証チェック
  const basicAuthResponse = checkBasicAuth(req)
  if (basicAuthResponse) {
    return basicAuthResponse
  }

  const isLoggedIn = !!req.auth

  // メンテナンスモードのチェック（Upstash Redis REST APIでEdge互換）
  // 静的ファイル、メンテナンスページ、許可パスはスキップ
  if (
    !nextUrl.pathname.startsWith(NEXT_INTERNAL_PREFIX) &&
    !nextUrl.pathname.startsWith(API_PREFIX) &&
    nextUrl.pathname !== ROUTE_MAINTENANCE &&
    !isMaintenanceAllowedPath(nextUrl.pathname)
  ) {
    try {
      const maintenanceEnabled = await getMaintenanceStatus()

      // メンテナンス中の場合（全ユーザーをメンテナンスページへリダイレクト）
      if (maintenanceEnabled) {
        return redirectNoStore(new URL(ROUTE_MAINTENANCE, nextUrl), cspHeader)
      }
    } catch (error) {
      // メンテナンスチェックに失敗しても続行。本番でも障害検知のため意図的に出力（詳細はメッセージのみ、スタックは出さない）。
      // 運用監視用のタグとして [MAINTENANCE] を付ける（[SECURITY] とは別カテゴリ）。
      const message = error instanceof Error ? error.message : String(error)
      reportSecurityEvent('MAINTENANCE', `check failed: ${message}`, 'error', {
        path: nextUrl.pathname,
      })
    }
  }

  const isProtected = PROTECTED_PATHS.some((path) =>
    nextUrl.pathname === path || nextUrl.pathname.startsWith(path + '/')
  )

  if (isProtected && !isLoggedIn) {
    const redirectUrl = new URL(ROUTE_LOGIN, nextUrl)
    redirectUrl.searchParams.set('callbackUrl', nextUrl.pathname)
    return redirectNoStore(redirectUrl, cspHeader)
  }

  // Admin route protection - check role
  const isAdminPath =
    nextUrl.pathname === ROUTE_ADMIN ||
    nextUrl.pathname.startsWith(`${ROUTE_ADMIN}/`)
  if (isAdminPath && isLoggedIn && !req.auth?.user?.isAdmin) {
    return redirectNoStore(new URL(ROUTE_FEED, nextUrl), cspHeader)
  }

  const isAuthPage = AUTH_ONLY_PATHS.some((path) =>
    nextUrl.pathname.startsWith(path)
  )
  const isTopPage = nextUrl.pathname === ROUTE_HOME

  if ((isAuthPage || isTopPage) && isLoggedIn) {
    return redirectNoStore(new URL(ROUTE_FEED, nextUrl), cspHeader)
  }

  // セキュリティヘッダーを追加してレスポンスを返す
  return addSecurityHeaders(nextWithNonce(req, nonce, cspHeader), cspHeader)
})

export const config = {
  // Next.js 公式の metadata file convention (sitemap.xml / robots.txt / favicon.ico /
  // site.webmanifest) と静的アセット (_next/* と画像拡張子) を proxy 対象から除外する。
  // CSP / Basic auth / maintenance redirect が SEO crawler の routes に影響しないようにするため。
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|site\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
