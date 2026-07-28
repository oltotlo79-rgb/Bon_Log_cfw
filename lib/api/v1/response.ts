/**
 * @module lib/api/v1/response
 * モバイル API v1 の統一レスポンスビルダー。
 *
 * 全エラーレスポンスは合意済みの形式:
 *   { "error": { "code": "...", "message": "...", "status": N } }
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import {
  MOBILE_API_ERROR_CODES,
  MOBILE_API_ERROR_MESSAGES,
  type MobileApiErrorCode,
} from '@/lib/constants/errors/mobile-api'
import type { RateLimitResult } from './types'

/**
 * モバイル API v1 の統一エラーレスポンス本体。
 * details はごく一部のエンドポイント（例: 403 TERMS_ACCEPTANCE_REQUIRED の現行規約バージョン）が
 * クライアントに機械可読な追加情報を渡すための optional 拡張。未設定なら JSON に出力されない。
 */
interface ApiErrorBody {
  error: {
    code: MobileApiErrorCode
    message: string
    status: number
    details?: Record<string, string>
  }
}

/**
 * 統一形式のエラー NextResponse を返す。
 * message を省略するとマッピングから自動解決する。
 */
export function apiError(
  code: MobileApiErrorCode,
  status: number,
  message?: string,
): NextResponse<ApiErrorBody> {
  const resolvedMessage = message ?? MOBILE_API_ERROR_MESSAGES[code]
  const body: ApiErrorBody = { error: { code, status, message: resolvedMessage } }
  return NextResponse.json(body, { status })
}

/**
 * details 付きの統一形式エラー NextResponse を返す。
 * details は message の代替ではなく、クライアントが機械的に読み取る追加情報専用
 * （例: 403 TERMS_ACCEPTANCE_REQUIRED に現行規約バージョンを含める）。
 */
export function apiErrorWithDetails(
  code: MobileApiErrorCode,
  status: number,
  details: Record<string, string>,
  message?: string,
): NextResponse<ApiErrorBody> {
  const resolvedMessage = message ?? MOBILE_API_ERROR_MESSAGES[code]
  const body: ApiErrorBody = { error: { code, status, message: resolvedMessage, details } }
  return NextResponse.json(body, { status })
}

/**
 * Zod パース失敗から 400 VALIDATION_ERROR レスポンスを返す。
 * 最初のエラーメッセージを人間可読メッセージとして付与する。
 */
export function apiZodError(error: ZodError): NextResponse<ApiErrorBody> {
  const firstMessage = error.issues[0]?.message
  return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, firstMessage)
}

/**
 * レート制限超過から 429 RATE_LIMITED レスポンスを返す。
 * Retry-After ヘッダーを付与する（モバイルがリトライ間隔を計算できるようにする）。
 */
export function apiRateLimited(rateLimitResult: RateLimitResult): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code: MOBILE_API_ERROR_CODES.RATE_LIMITED,
      status: 429,
      message: MOBILE_API_ERROR_MESSAGES.RATE_LIMITED,
    },
  }
  const retryAfterSeconds = Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
  return NextResponse.json(body, {
    status: 429,
    headers: {
      'Retry-After': String(Math.max(retryAfterSeconds, 1)),
    },
  })
}
