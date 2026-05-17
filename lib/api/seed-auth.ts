/**
 * 管理 API (seed / migration) の認可ヘルパー。
 *
 * Why: `/api/admin/seed` `/api/admin/seed-pesticide` `/api/admin/apply-migration`
 * の 3 routes が同じ Bearer + IP allowlist + エラー応答パターンを使うため、
 * 検証ロジックの重複を防ぎ、本番環境の必須要件 (IP allowlist 強制 / stack trace 非返却)
 * をシングルソース化する。
 *
 * @module lib/api/seed-auth
 */

import 'server-only'
import { randomUUID, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { API_ERR_UNAUTHORIZED, API_ERR_FORBIDDEN } from '@/lib/constants/errors'
import { getClientIpFromRequest } from '@/lib/utils/client-ip'

/** seedErrorResponse がサーバーログ向けに保持するスタックトレース先頭行数。 */
const ERROR_STACK_HEAD_LINES = 5

/** タイミング攻撃を防ぐ安全な文字列比較 (長さリークなし)。 */
function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf-8')
  const bBuf = Buffer.from(b, 'utf-8')
  const maxLen = Math.max(aBuf.length, bBuf.length)
  const aPadded = Buffer.alloc(maxLen)
  const bPadded = Buffer.alloc(maxLen)
  aBuf.copy(aPadded)
  bBuf.copy(bPadded)
  return timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
}

const trimEnv = (s: string | undefined) => s?.trim() ?? ''

/**
 * seed API (`/api/admin/seed`、`/api/admin/seed-pesticide`) の Bearer secret 検証。
 *
 * Why dedicated: 旧実装は `CRON_SECRET` / `VERCEL_CRON_SECRET` も受け付けていたため、
 * 1 つの cron secret 漏洩で TRUNCATE 系 seed エンドポイントが叩かれる経路があった。
 * seed (DB 全削除を含む) の信頼境界は cron 用途と分離するべきため、`SEED_PESTICIDE_SECRET`
 * 専用に絞り、未設定なら常に false を返す (fail-closed)。
 */
function validateSecret(request: NextRequest): boolean {
  const token = extractBearerToken(request)
  if (!token) return false
  const dedicated = trimEnv(process.env.SEED_PESTICIDE_SECRET)
  if (dedicated === '') return false
  return safeCompare(token, dedicated)
}

/**
 * Migration API 専用の secret 検証。
 *
 * Why: DDL を実行する endpoint と seed/cron 用途の secret は信頼境界を分離する必要がある。
 * seed/cron secret が漏れても DDL が動かないように、`ADMIN_MIGRATION_SECRET` だけを許可する。
 * 未設定の場合は endpoint を実質無効化するため常に false を返す (fail-closed)。
 */
function validateMigrationSecret(request: NextRequest): boolean {
  const token = extractBearerToken(request)
  if (!token) return false
  const dedicated = trimEnv(process.env.ADMIN_MIGRATION_SECRET)
  if (dedicated === '') return false
  return safeCompare(token, dedicated)
}

function parseAllowedIps(): string[] {
  return (
    process.env.SEED_ALLOWED_IPS?.split(',')
      .map((ip) => ip.trim())
      .filter(Boolean) ?? []
  )
}

/**
 * Admin API のリクエストからクライアント IP を取得する。
 *
 * `lib/utils/client-ip.ts` の安全な実装に委譲する。ヘッダー欠落時は `'unknown'` を返し、
 * allowlist にマッチしないことで結果的に拒否される (= 旧 null 返却と等価)。
 */
export function getClientIp(request: NextRequest): string {
  return getClientIpFromRequest(request)
}

function checkIpAllowlist(request: NextRequest): NextResponse | null {
  const allowedIps = parseAllowedIps()
  const isProduction = process.env.NODE_ENV === 'production'

  if (isProduction && allowedIps.length === 0) {
    logger.error('[Admin] SEED_ALLOWED_IPS is not configured in production')
    return NextResponse.json({ error: API_ERR_FORBIDDEN }, { status: 403 })
  }

  if (allowedIps.length > 0) {
    const clientIp = getClientIp(request)
    if (!allowedIps.includes(clientIp)) {
      return NextResponse.json({ error: API_ERR_FORBIDDEN }, { status: 403 })
    }
  }

  return null
}

/**
 * Bearer + IP allowlist の両方を検証する。
 *
 * - production では `SEED_ALLOWED_IPS` が未設定の場合 403 を返す (fail-closed)。
 * - 非 production では allowlist が空でも通過させる (ローカル / preview 環境用)。
 *
 * 認可に失敗した場合は `NextResponse` を返し、成功した場合は `null` を返す。
 * 呼び出し側は `null` をチェックして処理を続行する。
 */
export function authorizeSeedRequest(request: NextRequest): NextResponse | null {
  if (!validateSecret(request)) {
    return NextResponse.json({ error: API_ERR_UNAUTHORIZED }, { status: 401 })
  }
  return checkIpAllowlist(request)
}

/**
 * DDL 実行 (migration) API 専用の認可。
 *
 * Bearer は `ADMIN_MIGRATION_SECRET` 専用 (seed/cron secret は受け付けない)。
 * 未設定なら常に 401 を返し、endpoint を実質無効化する (fail-closed)。
 * IP allowlist は seed と共通の `SEED_ALLOWED_IPS` を使う。
 */
export function authorizeMigrationRequest(request: NextRequest): NextResponse | null {
  if (!validateMigrationSecret(request)) {
    return NextResponse.json({ error: API_ERR_UNAUTHORIZED }, { status: 401 })
  }
  return checkIpAllowlist(request)
}

/**
 * 管理 API のサーバーエラー応答を整形する。
 *
 * - 本番: クライアントには汎用メッセージ + requestId のみ返す。詳細はサーバーログに残す。
 * - 非 production: デバッグを容易にするため `message` / `stackHead` も返す。
 *
 * `extra` には domain / migration 名など、応答に含めたい追加フィールドを渡す。
 */
export function seedErrorResponse(
  context: string,
  error: unknown,
  extra: Record<string, unknown> = {},
): NextResponse {
  const requestId = randomUUID()
  const message = error instanceof Error ? error.message : String(error)
  const stackHead =
    error instanceof Error && error.stack
      ? error.stack.split('\n').slice(0, ERROR_STACK_HEAD_LINES).join('\n')
      : undefined

  logger.error(`[Admin] ${context} failed`, { requestId, message, stackHead, ...extra })

  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: `${context} failed`, requestId, ...extra },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { error: `${context} failed`, requestId, message, stackHead, ...extra },
    { status: 500 },
  )
}
