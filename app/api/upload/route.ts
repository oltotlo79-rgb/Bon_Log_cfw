/**
 * @module app/api/upload/route
 * 投稿系メディア (image / video) のアップロード Route Handler。
 *
 * 処理順序: auth → file 検証 → rate-limit → daily-limit → storage upload。
 * 不正入力で R2 課金保護用 daily counter / user upload quota を消費しないため、
 * file の type / size / magic byte 検証を rate-limit より前に置く。
 * (lib/actions/post.ts:uploadPostMedia 等の Server Action と挙動を統一)
 */

import { auth } from '@/lib/auth'
import { uploadFile } from '@/lib/storage'
import { NextRequest, NextResponse } from 'next/server'
import { checkUserRateLimit, checkDailyLimit } from '@/lib/rate-limit'
import { generateSafeFileName } from '@/lib/file-validation'
import {
  ERR_AUTH_REQUIRED,
  ERR_RATE_LIMIT_UPLOAD,
  ERR_UPLOAD_FAILED,
  ERR_UPLOAD_SERVER_ERROR,
  ERR_DAILY_UPLOAD_LIMIT,
} from '@/lib/constants/errors'
import { logger } from '@/lib/logger'
import { validateUploadFile } from './_shared/validate-upload-file'
import {
  STORAGE_FOLDER_POST_IMAGES,
  STORAGE_FOLDER_POST_VIDEOS,
} from '@/lib/constants/storage'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. 認証
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: ERR_AUTH_REQUIRED }, { status: 401 })
    }

    // 2. 入力検証 (type / size / magic byte)
    const validation = await validateUploadFile(request, { accept: 'image+video' })
    if (!validation.ok) return validation.response
    const { kind, buffer, file } = validation.data
    const isVideo = kind === 'video'

    // 3. レート制限 (検証通過後にだけ quota を消費)
    const rateLimitResult = await checkUserRateLimit(session.user.id, 'upload')
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: ERR_RATE_LIMIT_UPLOAD }, { status: 429 })
    }

    // 4. 日次制限 (R2 Class A Operations 課金対策)。failOpen: false で障害時は拒否。
    const dailyLimitResult = await checkDailyLimit(session.user.id, 'upload', {
      failOpen: false,
    })
    if (!dailyLimitResult.allowed) {
      return NextResponse.json(
        { error: ERR_DAILY_UPLOAD_LIMIT(dailyLimitResult.limit) },
        { status: 429 },
      )
    }

    // 5. ストレージ upload
    const safeFileName = generateSafeFileName(file.name, file.type)
    const folder = isVideo ? STORAGE_FOLDER_POST_VIDEOS : STORAGE_FOLDER_POST_IMAGES
    const result = await uploadFile(buffer, safeFileName, file.type, folder)

    if (!result.success || !result.url) {
      return NextResponse.json(
        { error: result.error || ERR_UPLOAD_FAILED },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      type: isVideo ? 'video' : 'image',
    })
  } catch (error) {
    logger.error('Media upload error:', error)
    return NextResponse.json({ error: ERR_UPLOAD_SERVER_ERROR }, { status: 500 })
  }
}
