/**
 * @module lib/api/v1/auth-guard
 * モバイル API v1 向け Bearer 認証ガード。
 *
 * route handler の先頭で呼び出し、認証・認可の fail-closed を担保する。
 * proxy.ts の保護対象外である /api/v1/* の認可責任はこの handler 内に集約される
 * (.claude/rules/nextjs-api-routes.md 参照)。
 */

import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAccessToken } from './jwt'
import { apiError } from './response'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import type { BearerAuthResult } from './types'

export interface BearerAuthOptions {
  /**
   * true の場合、ゲストアカウントを 403 GUEST_NOT_ALLOWED で拒否する。
   * 投稿・コメント等の書き込み系エンドポイントで有効化する。
   */
  rejectGuest?: boolean
}

/**
 * Authorization: Bearer <token> ヘッダーを検証し、有効なユーザー情報を返す。
 *
 * 1. Bearer ヘッダー取得（無ければ 401 AUTH_REQUIRED）
 * 2. JWT 検証（署名不正→401 AUTH_INVALID_TOKEN、期限切れ→401 AUTH_TOKEN_EXPIRED）
 * 3. Prisma でユーザーを取得し isSuspended を確認（403 ACCOUNT_SUSPENDED、不存在は 401）
 * 4. オプション: ゲストアカウント拒否（403 GUEST_NOT_ALLOWED）
 */
export async function requireBearerUser(
  request: NextRequest,
  options: BearerAuthOptions = {},
): Promise<BearerAuthResult> {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)
  if (!token) {
    return {
      ok: false,
      response: apiError(MOBILE_API_ERROR_CODES.AUTH_REQUIRED, 401),
    }
  }

  const verifyResult = await verifyAccessToken(token)

  if (!verifyResult.ok) {
    if (verifyResult.reason === 'misconfigured') {
      return {
        ok: false,
        response: apiError(MOBILE_API_ERROR_CODES.SERVER_MISCONFIGURED, 503),
      }
    }
    if (verifyResult.reason === 'expired') {
      return {
        ok: false,
        response: apiError(MOBILE_API_ERROR_CODES.AUTH_TOKEN_EXPIRED, 401),
      }
    }
    return {
      ok: false,
      response: apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_TOKEN, 401),
    }
  }

  const userId = verifyResult.claims.sub

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isSuspended: true, email: true },
  })

  if (!user) {
    return {
      ok: false,
      response: apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_TOKEN, 401),
    }
  }

  if (user.isSuspended) {
    return {
      ok: false,
      response: apiError(MOBILE_API_ERROR_CODES.ACCOUNT_SUSPENDED, 403),
    }
  }

  if (options.rejectGuest && user.email === GUEST_EMAIL) {
    return {
      ok: false,
      response: apiError(MOBILE_API_ERROR_CODES.GUEST_NOT_ALLOWED, 403),
    }
  }

  return { ok: true, userId: user.id }
}

/**
 * Authorization ヘッダーから Bearer トークン文字列を取り出す型ガード的ヘルパー。
 * "Bearer " プレフィクスが無い場合・空の場合は null を返す。
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  return token.length > 0 ? token : null
}
