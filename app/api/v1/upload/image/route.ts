/**
 * @module app/api/v1/upload/image/route
 *
 * モバイル API v1 向けの画像アップロードエンドポイント。
 * multipart/form-data でファイル 1 つを受け取り、storage 層（EXIF/GPS 除去込み）で R2 に保存する。
 *
 * セキュリティ:
 *   - Bearer 必須。ゲスト・停止ユーザーは 403 で早期拒否
 *   - マジックバイト検証（宣言 Content-Type を信用せず実バイトで MIME 判定）
 *   - 画像サイズ上限: MAX_IMAGE_SIZE（ファイル検証後にレート制限消費）
 *   - storage 層の stripImageMetadata で EXIF/GPS/IPTC を必ず除去（プライバシー保護）
 *   - 日次上限は fail-closed（R2 課金保護）
 *   - 画像はプレミアム不問（枚数制限は投稿作成時に強制）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser } from '@/lib/api/v1/auth-guard'
import { apiError, apiRateLimited } from '@/lib/api/v1/response'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { checkUserRateLimit, checkDailyLimit } from '@/lib/rate-limit'
import { uploadFile } from '@/lib/storage'
import { validateImageFile } from '@/lib/file-validation'
import { logger } from '@/lib/logger'
import {
  MAX_IMAGE_SIZE,
  ALLOWED_POST_IMAGE_TYPES,
  POST_IMAGE_MIME_EXTENSION_MAP,
  STORAGE_RANDOM_BYTES,
} from '@/lib/constants/limits'
import { STORAGE_FOLDER_POST_IMAGES } from '@/lib/constants/storage'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. 認証（Bearer 必須、ゲスト・停止アカウント拒否）
  const authResult = await requireBearerUser(request, { rejectGuest: true })
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  // 2. multipart/form-data から file を取り出してファイル検証
  // （不正入力でレート制限を消費しないため認証直後に検証）
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const rawFile = formData.get('file')
  if (!(rawFile instanceof File)) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, 'ファイルが選択されていません')
  }
  const file = rawFile

  // サイズ上限チェック（マジックバイト読み込みの前にバイアウト）
  if (file.size > MAX_IMAGE_SIZE) {
    return apiError(
      MOBILE_API_ERROR_CODES.VALIDATION_ERROR,
      400,
      `画像は${MAX_IMAGE_SIZE / 1024 / 1024}MB以下にしてください`,
    )
  }

  // Buffer に変換してマジックバイト検証（宣言 Content-Type を信用しない）
  const buffer = Buffer.from(await file.arrayBuffer())
  const allowedTypes: readonly string[] = ALLOWED_POST_IMAGE_TYPES

  const validation = validateImageFile(buffer, file.type, [...allowedTypes])
  if (!validation.valid) {
    return apiError(
      MOBILE_API_ERROR_CODES.VALIDATION_ERROR,
      400,
      validation.error ?? '許可されていない画像形式です',
    )
  }

  // 3. レート制限（Zod 相当の検証通過後に消費）
  const rateLimitResult = await checkUserRateLimit(userId, 'upload')
  if (!rateLimitResult.success) {
    return apiRateLimited(rateLimitResult)
  }

  // R2 課金保護のため Redis 障害時も fail-closed
  const dailyLimitResult = await checkDailyLimit(userId, 'upload', { failOpen: false })
  if (!dailyLimitResult.allowed) {
    return apiError(MOBILE_API_ERROR_CODES.RATE_LIMITED, 429)
  }

  // 4. ストレージへアップロード（stripImageMetadata が EXIF/GPS/IPTC を除去する）
  try {
    // マジックバイト検出 MIME を優先し、未検出の場合は申告値を使う。
    // validateImageFile が allowlist でガード済みなので安全に絞り込める。
    const rawMime = validation.detectedType ?? file.type
    const isAllowedMime = (v: string): v is keyof typeof POST_IMAGE_MIME_EXTENSION_MAP =>
      (ALLOWED_POST_IMAGE_TYPES as readonly string[]).includes(v)
    const mimeType = isAllowedMime(rawMime) ? rawMime : 'image/jpeg'
    const ext = POST_IMAGE_MIME_EXTENSION_MAP[mimeType]
    const filename = `${Date.now()}-${crypto.randomBytes(STORAGE_RANDOM_BYTES).toString('hex')}${ext}`

    const result = await uploadFile(buffer, filename, mimeType, STORAGE_FOLDER_POST_IMAGES)
    if (!result.success || !result.url) {
      return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
    }

    return NextResponse.json({ url: result.url }, { status: 200 })
  } catch (error) {
    logger.error('v1 image upload error:', error)
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }
}
