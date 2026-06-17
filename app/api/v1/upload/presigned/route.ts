/**
 * @module app/api/v1/upload/presigned/route
 *
 * モバイル API v1 向けの動画 presigned PUT URL 生成エンドポイント。
 * 既存の /api/upload/presigned（Cookie 認証版）と同じロジックで、
 * 認証のみ Bearer JWT に切り替えた版。既存ルートは無編集。
 *
 * セキュリティ:
 *   - Bearer 必須。ゲスト・停止ユーザーは 403 で早期拒否
 *   - 動画アップロードはプレミアム会員限定
 *   - Zod で contentType / fileSize / folder を runtime 検証
 *   - presigned URL の Content-Length 署名でサイズ迂回を防止
 *   - 日次上限は fail-closed（R2 課金保護）
 */

import crypto from 'crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser } from '@/lib/api/v1/auth-guard'
import { apiError, apiRateLimited } from '@/lib/api/v1/response'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { presignedUploadRequestSchema } from '@/lib/api/v1/schemas/request'
import { isPremiumUser } from '@/lib/premium'
import { checkUserRateLimit, checkDailyLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  PRESIGNED_URL_EXPIRY_SECONDS,
  STORAGE_RANDOM_BYTES,
  UPLOAD_MIME_EXTENSION_MAP,
} from '@/lib/constants/limits'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. 認証（Bearer 必須、ゲスト・停止アカウント拒否）
  const authResult = await requireBearerUser(request, { rejectGuest: true })
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  // 2. プレミアム会員チェック（動画はプレミアム限定）
  const isPremium = await isPremiumUser(userId)
  if (!isPremium) {
    return apiError(MOBILE_API_ERROR_CODES.PREMIUM_REQUIRED, 403)
  }

  // 3. Zod バリデーション（不正入力でレート制限を消費しないため認証直後）
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = presignedUploadRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, parsed.error.issues[0]?.message)
  }
  const { contentType, fileSize, folder } = parsed.data

  // 4. レート制限（Zod 通過後に消費）
  const rateLimitResult = await checkUserRateLimit(userId, 'upload')
  if (!rateLimitResult.success) {
    return apiRateLimited(rateLimitResult)
  }

  // R2 課金保護のため Redis 障害時も fail-closed
  const dailyLimitResult = await checkDailyLimit(userId, 'upload', { failOpen: false })
  if (!dailyLimitResult.allowed) {
    return apiError(MOBILE_API_ERROR_CODES.RATE_LIMITED, 429)
  }

  // 5. 署名付き URL 生成
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME ?? 'uploads'
  const publicUrl = process.env.R2_PUBLIC_URL

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return apiError(MOBILE_API_ERROR_CODES.SERVER_MISCONFIGURED, 503)
  }

  try {
    const ext = UPLOAD_MIME_EXTENSION_MAP[contentType]
    const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(STORAGE_RANDOM_BYTES).toString('hex')}${ext}`

    const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
    // signedContentLength を渡して PUT 時の Content-Length を署名対象に含める。
    // URL 取得後の任意サイズ payload 迂回を防ぐ。
    const uploadUrl = createPresignedPutUrl(
      { endpoint: `https://${accountId}.r2.cloudflarestorage.com`, region: 'auto', accessKeyId, secretAccessKey, bucket },
      uniqueName,
      contentType,
      PRESIGNED_URL_EXPIRY_SECONDS,
      fileSize,
    )

    const fileUrl = publicUrl
      ? `${publicUrl}/${uniqueName}`
      : `https://${bucket}.${accountId}.r2.dev/${uniqueName}`

    return NextResponse.json({
      uploadUrl,
      fileUrl,
      key: uniqueName,
      contentLength: fileSize,
    })
  } catch (error) {
    logger.error('v1 presigned URL generation error:', error)
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }
}
