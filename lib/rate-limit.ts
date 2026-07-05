/**
 * Redis ベースのレート制限（固定ウィンドウ方式）
 *
 * - Redis INCR でアトミックにカウント、TTL で自動リセット
 * - Redis障害時はフェイルオープン（認証系は login-tracker.ts でフェイルクローズ）
 * - 機能別プリセット + 日次制限（クラウド課金対策）
 *
 * @module lib/rate-limit
 */

import { getRedisClient } from './redis'
import logger from '@/lib/logger'
import {
  ONE_MINUTE_MS,
  FIFTEEN_MINUTES_MS,
  ONE_HOUR_MS,
  ONE_DAY_MS,
  ONE_DAY_SECONDS,
  ONE_SECOND_MS,
  MIDNIGHT_BUFFER_SECONDS,
  DAILY_UPLOAD_LIMIT,
} from '@/lib/constants/limits'
import { getClientIpFromRequest } from '@/lib/utils/client-ip'
import { getJstDateString, getStartOfToday } from '@/lib/utils'

interface RateLimitOptions {
  windowMs: number
  maxRequests: number
  /** When false, Redis errors cause rate limit denial (fail-closed). Default: true (fail-open). */
  failOpen?: boolean
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

/**
 * E2E テスト環境でのみレート制限を無効化してよいかを判定する。
 *
 * Why: E2E は単一の共有ユーザーで `/feed` 等を多数回ロードするため、`get_timeline`
 * (30/分) などの枠が枯渇し、`getTimeline` がエラー→空 feed になり feed 依存テストが
 * 不安定化する。CI の E2E は `NODE_ENV=production` で動く (env-validation.ts 参照) ため
 * NODE_ENV では本番と区別できない。そこで **明示フラグ + loopback URL** の二条件でのみ
 * 有効化する。実本番 (例: bon-log.com) はフラグが漏れても loopback でないため発火しない。
 * 起動時には `validateEnv()` が「フラグ on かつ非 loopback」を fail-closed で拒否する。
 */
function isRateLimitDisabled(): boolean {
  if (process.env.DISABLE_RATE_LIMIT !== 'true') return false
  try {
    const host = new URL(process.env.NEXT_PUBLIC_APP_URL ?? '').hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]'
  } catch {
    return false
  }
}

/**
 * 指定キーのレート制限をチェック。
 * INCR → EXPIRE のアトミックパターンでTOCTOU競合を回避。
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { windowMs, maxRequests, failOpen = true } = options

  // E2E (loopback + 明示フラグ) のみレート制限をバイパスする。実本番では発火しない。
  if (isRateLimitDisabled()) {
    return { success: true, remaining: maxRequests, resetTime: Date.now() + windowMs }
  }

  const redis = getRedisClient()
  const key = `ratelimit:${identifier}`
  const windowSeconds = Math.ceil(windowMs / 1000)

  try {
    const newCount = await redis.incr(key)

    let ttl: number
    if (newCount === 1) {
      await redis.expire(key, windowSeconds)
      ttl = windowSeconds
    } else {
      ttl = await redis.ttl(key)
      if (ttl < 0) {
        await redis.expire(key, windowSeconds)
        ttl = windowSeconds
      }
    }

    if (newCount > maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetTime: Date.now() + Math.max(ttl, 0) * 1000,
      }
    }

    return {
      success: true,
      remaining: maxRequests - newCount,
      resetTime: Date.now() + Math.max(ttl, 0) * 1000,
    }
  } catch (error) {
    logger.error('Rate limit error:', error)
    // 本番環境では Sentry に送信して Redis 障害を可観測にする。
    // fail-open 時のバイパスを SRE が早期に検知できるようにするため。
    reportRateLimitFailure(error, identifier, failOpen)
    if (failOpen) {
      // フェイルオープン: Redis障害時はリクエストを許可
      return {
        success: true,
        remaining: maxRequests,
        resetTime: Date.now() + windowMs,
      }
    }
    // フェイルクローズ: Redis障害時はリクエストを拒否（認証系など重要な操作向け）
    return {
      success: false,
      remaining: 0,
      resetTime: Date.now() + windowMs,
    }
  }
}

/**
 * Redis 障害を Sentry に送信する（本番環境・サーバーサイドのみ）。
 *
 * - dynamic import によりクライアントバンドルを膨張させない
 * - Sentry 未設定時や送信エラー時は無言で吸収（追加障害を引き起こさない）
 */
async function reportRateLimitFailure(
  error: unknown,
  identifier: string,
  failOpen: boolean
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return
  if (typeof window !== 'undefined') return
  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureException(error, {
      tags: { component: 'rate-limit', failOpen: String(failOpen) },
      extra: { identifier },
      level: 'warning',
    })
  } catch {
    // Sentry の import/送信失敗は無視（追加障害を誘発させない）
  }
}

/**
 * 機能別のレート制限プリセット。
 *
 * security-sensitive な auth / password-reset / upload / 2FA は明示的に
 * `failOpen: false` (Redis 障害時は拒否) にする。一般機能 (timeline / read 等) は
 * デフォルトの fail-open を維持して UX 低下を避ける。
 */
export const RATE_LIMITS = {
  api:            { windowMs: ONE_MINUTE_MS,      maxRequests: 60 },
  login:          { windowMs: FIFTEEN_MINUTES_MS,  maxRequests: 5,  failOpen: false },
  register:       { windowMs: ONE_HOUR_MS,         maxRequests: 3,  failOpen: false },
  passwordReset:  { windowMs: ONE_HOUR_MS,         maxRequests: 3,  failOpen: false },
  upload:         { windowMs: ONE_MINUTE_MS,       maxRequests: 5,  failOpen: false },  // R2課金保護
  search:         { windowMs: ONE_MINUTE_MS,       maxRequests: 20 },
  mention_search: { windowMs: ONE_MINUTE_MS,       maxRequests: 30 },  // @入力サジェスト（debounce 前提）
  comment:        { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  post:           { windowMs: ONE_MINUTE_MS,       maxRequests: 3 },
  engagement:     { windowMs: ONE_MINUTE_MS,       maxRequests: 30 },
  timeline:       { windowMs: ONE_MINUTE_MS,       maxRequests: 30 },
  read:           { windowMs: ONE_MINUTE_MS,       maxRequests: 60 },
  create_shop:    { windowMs: ONE_MINUTE_MS,       maxRequests: 3 },
  update_shop:    { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  create_event:   { windowMs: ONE_MINUTE_MS,       maxRequests: 3 },
  update_event:   { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  create_review:  { windowMs: ONE_MINUTE_MS,       maxRequests: 3 },
  update_review:  { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  create_draft:   { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  update_draft:   { windowMs: ONE_MINUTE_MS,       maxRequests: 10 },  // 自動保存考慮
  publish_draft:  { windowMs: ONE_MINUTE_MS,       maxRequests: 10 },
  delete_draft:   { windowMs: ONE_MINUTE_MS,       maxRequests: 10 },
  block_user:     { windowMs: ONE_MINUTE_MS,       maxRequests: 10 },
  unblock_user:   { windowMs: ONE_MINUTE_MS,       maxRequests: 10 },
  mute_user:      { windowMs: ONE_MINUTE_MS,       maxRequests: 10 },
  unmute_user:    { windowMs: ONE_MINUTE_MS,       maxRequests: 10 },
  create_report:  { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  create_bonsai:  { windowMs: ONE_MINUTE_MS,       maxRequests: 3 },
  update_bonsai:  { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  create_bonsai_record: { windowMs: ONE_MINUTE_MS, maxRequests: 5 },
  // 盆栽手入れログ（カレンダー用・User 全体のメモ）
  care_log_write: { windowMs: ONE_MINUTE_MS,       maxRequests: 10 },
  care_log_read:  { windowMs: ONE_MINUTE_MS,       maxRequests: 60 },
  // 2FA 検証: Redis 障害時はフェイルクローズ（ブルートフォース防護を最優先）
  verify_2fa:     { windowMs: FIFTEEN_MINUTES_MS,  maxRequests: 5, failOpen: false },
  // 2FA セットアップ/有効化/無効化/再生成: 認証ユーザー向け。fail-open で UX を優先
  two_factor_setup: { windowMs: FIFTEEN_MINUTES_MS, maxRequests: 10 },
  toggle_like:    { windowMs: ONE_MINUTE_MS,       maxRequests: 30 },
  contact:        { windowMs: FIFTEEN_MINUTES_MS,  maxRequests: 3,  failOpen: false },   // 未認証のため厳しめ
  delete_shop:    { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  create_shop_change_request: { windowMs: ONE_MINUTE_MS, maxRequests: 3 },
  delete_event:   { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  delete_review:  { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  delete_comment: { windowMs: ONE_MINUTE_MS,       maxRequests: 10 },
  update_comment: { windowMs: ONE_MINUTE_MS,       maxRequests: 15 },
  delete_post:    { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  delete_bonsai:  { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  delete_care_log:{ windowMs: ONE_MINUTE_MS,       maxRequests: 10 },
  send_message:   { windowMs: ONE_MINUTE_MS,       maxRequests: 20 },
  get_timeline:   { windowMs: ONE_MINUTE_MS,       maxRequests: 30 },
  get_recommended:{ windowMs: ONE_MINUTE_MS,       maxRequests: 20 },
  // 管理者一括操作: BULK_*_MAX で 1 コール辺りの件数は制限されているが、
  // 連続実行で事実上の無制限操作を防ぐため分あたり 5 回に制限する。
  admin_bulk:     { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  // Stripe 課金 API 呼び出し: 顧客作成/Checkout/CustomerPortal/即時解約。
  // 1 ユーザーあたり 1 分 5 回を上限とし、誤クリック連打や乱用による Stripe 側コストを抑える。
  stripe_billing: { windowMs: ONE_MINUTE_MS,       maxRequests: 5 },
  // モバイル API v1 リフレッシュトークン更新: IP ベース制限。
  // 15 分で 20 回まで許容（通常のセッション利用では 900 秒 = 15 分に 1 回程度）。
  // fail-closed: Redis 障害時はリフレッシュを遮断しトークン盗難検知の誤回避を防ぐ。
  mobile_refresh: { windowMs: FIFTEEN_MINUTES_MS, maxRequests: 20, failOpen: false },
  // モバイルデバイストークン登録/解除: ログイン直後や再インストール時等の低頻度操作。
  // engagement（30/分）より緩い 10/分 で設定する。
  register_device: { windowMs: ONE_MINUTE_MS, maxRequests: 10 },
  remove_device:   { windowMs: ONE_MINUTE_MS, maxRequests: 10 },
  // 予約投稿（モバイル API v1）: 作成・更新は post に準じて 3/分。
  // 取得・キャンセル・削除は engagement（30/分）を流用する。
  create_scheduled_post: { windowMs: ONE_MINUTE_MS, maxRequests: 3 },
  update_scheduled_post: { windowMs: ONE_MINUTE_MS, maxRequests: 5 },
  // 分析サマリ（モバイル API v1 §3.11）: 読み取り専用だが重い集計クエリを含むため
  // read（60/分）より絞り込み、10/分 とする。プレミアム限定なので実ユーザーは少ない。
  analytics_summary: { windowMs: ONE_MINUTE_MS, maxRequests: 10 },
  // モバイル API v1 確認メール再送: password-reset と同等の security-sensitive 操作。
  // IP ベース 1 時間 3 回、fail-closed（Redis 障害時は拒否してメール乱用を防ぐ）。
  verify_email_resend: { windowMs: ONE_HOUR_MS, maxRequests: 3, failOpen: false },
  // ログイン中ユーザーのパスワード変更: login と同等の security-sensitive 操作。
  // ユーザー ID ベース 15 分に 5 回、fail-closed（Redis 障害時はブルートフォース総当りを遮断）。
  password_change: { windowMs: FIFTEEN_MINUTES_MS, maxRequests: 5, failOpen: false },
  // ログイン中ユーザーのメールアドレス変更リクエスト: password_change と同等の security-sensitive 操作。
  // ユーザー ID ベース 15 分に 5 回、fail-closed（新アドレス宛メール送信の乱用を防ぐ）。
  email_change_request: { windowMs: FIFTEEN_MINUTES_MS, maxRequests: 5, failOpen: false },
  // メールアドレス変更確認（token ベース、未ログインでも実行可能）: IP ベース 1 時間に 10 回、
  // fail-closed（Redis 障害時はトークン総当りを遮断）。
  email_change_confirm: { windowMs: ONE_HOUR_MS, maxRequests: 10, failOpen: false },
  // モバイル API v1 住所ジオコーディング（国土地理院 GSI 呼び出し）: 外部 API 負荷に配慮し
  // search（20/分）より絞った専用バケットとする。
  geocode: { windowMs: ONE_MINUTE_MS, maxRequests: 15 },
} as const

/**
 * IP取得 (Request 互換オブジェクト経由)。
 *
 * 実体は `lib/utils/client-ip.ts` の `getClientIpFromRequest` に委譲。
 * 後方互換のため export は維持する。
 */
export const getClientIp = getClientIpFromRequest

/** IPベースのレート制限チェック（プリセット使用） */
export async function checkRateLimit(
  request: Request,
  limitType: keyof typeof RATE_LIMITS,
  additionalKey?: string
): Promise<RateLimitResult> {
  const ip = getClientIp(request)
  const key = additionalKey ? `${limitType}:${ip}:${additionalKey}` : `${limitType}:${ip}`
  const preset = RATE_LIMITS[limitType]
  return rateLimit(key, {
    windowMs: preset.windowMs,
    maxRequests: preset.maxRequests,
    ...('failOpen' in preset && { failOpen: preset.failOpen }),
  })
}

/** 日次制限: R2 Class A Operations 課金対策 */
export const DAILY_LIMITS = {
  upload: DAILY_UPLOAD_LIMIT,  // デフォルト50回/日
} as const

/**
 * 日次制限チェック（UTC 0時リセット）。
 *
 * `failOpen` の意味:
 *   - true (既定): Redis 障害時はリクエストを許可。UX 重視。
 *   - false: Redis 障害時はリクエストを拒否。R2 課金保護のような
 *     cost-sensitive な経路で `{ failOpen: false }` を渡すと、Redis に到達できない
 *     状況での無制限 upload を遮断できる。
 *
 * 障害時の意思決定が経路ごとに違うため、preset ではなく呼び出し側で明示する。
 */
export async function checkDailyLimit(
  userId: string,
  limitType: keyof typeof DAILY_LIMITS,
  options: { failOpen?: boolean } = {},
): Promise<{ allowed: boolean; count: number; limit: number }> {
  const { failOpen = true } = options
  const redis = getRedisClient()
  const limit = DAILY_LIMITS[limitType]
  // JST 暦日をキーラベルに使う（checkDailyPostLimit と同じ方式）
  const today = getJstDateString()
  const key = `daily:${limitType}:${userId}:${today}`

  try {
    // INCR を先に実行して原子的にカウントアップ（TOCTOU 競合を回避）
    const newCount = await redis.incr(key)

    if (newCount === 1) {
      // 新規キー: JST 翌日 00:00 まで + バッファで期限設定
      const jstTodayStart = getStartOfToday()
      const jstTomorrow = new Date(jstTodayStart.getTime() + ONE_DAY_MS)
      const msUntilMidnight = jstTomorrow.getTime() - Date.now()
      const secondsUntilMidnight = Math.ceil(msUntilMidnight / ONE_SECOND_MS) + MIDNIGHT_BUFFER_SECONDS
      await redis.expire(key, secondsUntilMidnight)
    } else {
      const ttl = await redis.ttl(key)
      if (ttl < 0) {
        await redis.expire(key, ONE_DAY_SECONDS)
      }
    }

    if (newCount > limit) {
      return { allowed: false, count: newCount, limit }
    }

    return { allowed: true, count: newCount, limit }
  } catch (error) {
    logger.error('Daily limit check error:', error)
    return { allowed: failOpen, count: 0, limit }
  }
}

/** ユーザーIDベースのレート制限チェック（認証済みユーザー向け） */
export async function checkUserRateLimit(
  userId: string,
  limitType: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const key = `${limitType}:user:${userId}`
  const preset = RATE_LIMITS[limitType]
  return rateLimit(key, {
    windowMs: preset.windowMs,
    maxRequests: preset.maxRequests,
    ...('failOpen' in preset && { failOpen: preset.failOpen }),
  })
}
