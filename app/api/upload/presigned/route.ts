/**
 * @module app/api/upload/presigned/route
 * Cloudflare R2 への直接アップロード用 presigned PUT URL を生成する。Vercel の 4.5MB
 * payload 制限を回避して大型ファイル (動画) を直送するための endpoint。
 *
 * セキュリティ:
 *   - body は Zod schema で fileSize / contentType / folder を runtime 検証
 *   - presigned URL の signed header に `content-length` を含めることで、
 *     URL 取得後に申告サイズより大きい payload を送る迂回を防ぐ
 *   - フォルダは enum allowlist で path traversal を防止
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import {
  ALLOWED_UPLOAD_FOLDERS,
  ALLOWED_UPLOAD_VIDEO_TYPES,
  MAX_VIDEO_SIZE,
  PRESIGNED_URL_EXPIRY_SECONDS,
  STORAGE_RANDOM_BYTES,
  UPLOAD_MIME_EXTENSION_MAP,
} from '@/lib/constants/limits'
import {
  ERR_AUTH_REQUIRED,
  ERR_DAILY_UPLOAD_LIMIT,
  ERR_PRESIGNED_URL_FAILED,
  ERR_RATE_LIMIT_UPLOAD,
  ERR_STORAGE_NOT_CONFIGURED,
  ERR_UPLOAD_FORMAT_NOT_ALLOWED,
  ERR_UPLOAD_INVALID_FOLDER,
  ERR_UPLOAD_PARAMS_REQUIRED,
  ERR_VIDEO_SIZE_EXCEEDED,
} from '@/lib/constants/errors'
import { logger } from '@/lib/logger'
import { checkUserRateLimit, checkDailyLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * 任意の値が「object かつ指定 key が存在し undefined でない」かを判定する。
 * Zod 失敗時の raw body 検査で `as` キャストを使わず安全に property を取り出す。
 */
function hasOwnDefinedKey(value: unknown, key: string): boolean {
  if (typeof value !== 'object' || value === null) return false
  if (!(key in value)) return false
  return Reflect.get(value, key) !== undefined
}

/**
 * Presigned upload リクエスト schema。
 * 全 field を runtime 型検証することで `fileSize: "abc"` のような bypass を塞ぐ。
 */
const presignedUploadSchema = z.object({
  contentType: z.enum(ALLOWED_UPLOAD_VIDEO_TYPES),
  fileSize: z.number().int().positive().max(MAX_VIDEO_SIZE),
  folder: z.enum(ALLOWED_UPLOAD_FOLDERS).default('posts'),
})

export async function POST(request: NextRequest) {
  try {
    // 1. 認証
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERR_AUTH_REQUIRED }, { status: 401 })
    }

    // 2. 入力検証 (未検証入力で rate / daily limit を消費しないため auth の直後)
    const body: unknown = await request.json()

    const parsed = presignedUploadSchema.safeParse(body)
    if (!parsed.success) {
      // 入力 body に必須フィールドが存在しないケースは ERR_UPLOAD_PARAMS_REQUIRED で
      // 「contentType と fileSize が必要です」を返す (Zod 4 では enum 不一致と
      // undefined の区別が issue code だけでは付きにくいため raw body をチェック)。
      const hasContentType = hasOwnDefinedKey(body, 'contentType')
      const hasFileSize = hasOwnDefinedKey(body, 'fileSize')
      if (!hasContentType || !hasFileSize) {
        return NextResponse.json({ error: ERR_UPLOAD_PARAMS_REQUIRED }, { status: 400 })
      }

      const path = parsed.error.issues[0]?.path[0]
      if (path === 'folder') {
        return NextResponse.json({ error: ERR_UPLOAD_INVALID_FOLDER }, { status: 400 })
      }
      if (path === 'contentType') {
        return NextResponse.json({ error: ERR_UPLOAD_FORMAT_NOT_ALLOWED }, { status: 400 })
      }
      if (path === 'fileSize') {
        return NextResponse.json({ error: ERR_VIDEO_SIZE_EXCEEDED }, { status: 400 })
      }
      return NextResponse.json({ error: ERR_UPLOAD_PARAMS_REQUIRED }, { status: 400 })
    }

    const { contentType, fileSize, folder } = parsed.data

    // 3. レート制限 / 日次上限 (Zod 通過後に消費)
    const rateLimitResult = await checkUserRateLimit(session.user.id, 'upload')
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: ERR_RATE_LIMIT_UPLOAD }, { status: 429 })
    }

    // R2 課金保護のため Redis 障害時も fail-closed
    const dailyLimitResult = await checkDailyLimit(session.user.id, 'upload', {
      failOpen: false,
    })
    if (!dailyLimitResult.allowed) {
      return NextResponse.json(
        { error: ERR_DAILY_UPLOAD_LIMIT(dailyLimitResult.limit) },
        { status: 429 }
      )
    }

    const accountId = process.env.R2_ACCOUNT_ID
    const accessKeyId = process.env.R2_ACCESS_KEY_ID
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
    const bucket = process.env.R2_BUCKET_NAME || 'uploads'
    const publicUrl = process.env.R2_PUBLIC_URL

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return NextResponse.json(
        { error: ERR_STORAGE_NOT_CONFIGURED },
        { status: 500 }
      )
    }

    const ext = UPLOAD_MIME_EXTENSION_MAP[contentType]
    const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(STORAGE_RANDOM_BYTES).toString('hex')}${ext}`

    const { createPresignedPutUrl } = await import('@/lib/storage/s3-sign')
    // signedContentLength を渡して PUT 時の Content-Length を署名対象に含める。
    // URL 取得後の任意サイズ payload 迂回を防ぐ。
    const presignedUrl = createPresignedPutUrl(
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
      presignedUrl,
      fileUrl,
      key: uniqueName,
      // クライアント側で PUT 時に Content-Length をセットするためエコーする
      contentLength: fileSize,
    })
  } catch (error) {
    logger.error('Presigned URL generation error:', error)
    return NextResponse.json(
      { error: ERR_PRESIGNED_URL_FAILED },
      { status: 500 }
    )
  }
}
