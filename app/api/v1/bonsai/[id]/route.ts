/**
 * @module app/api/v1/bonsai/[id]
 * GET    /api/v1/bonsai/{id} — 盆栽詳細取得
 * PATCH  /api/v1/bonsai/{id} — 盆栽更新
 * DELETE /api/v1/bonsai/{id} — 盆栽削除
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { z } from 'zod'
import {
  getBonsaiV1,
  updateBonsaiV1,
  deleteBonsaiV1,
  updateBonsaiV1Schema,
} from '@/lib/services/bonsai-service'

const idSchema = z.object({ id: z.string().min(1).max(64) })

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsed = idSchema.safeParse({ id })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 盆栽詳細取得
  const result = await getBonsaiV1(auth.userId, parsed.data.id)
  if (!result.ok) {
    const code =
      result.status === 404 ? MOBILE_API_ERROR_CODES.NOT_FOUND : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json(result.bonsai)
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = idSchema.safeParse({ id })
  if (!parsedId.success) return apiZodError(parsedId.error)

  // 3. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = updateBonsaiV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'update_bonsai')
  if (!rl.success) return apiRateLimited(rl)

  // 5. 盆栽更新
  const result = await updateBonsaiV1(auth.userId, parsedId.data.id, parsed.data)
  if (!result.ok) {
    const code =
      result.status === 404
        ? MOBILE_API_ERROR_CODES.NOT_FOUND
        : result.status === 400
          ? MOBILE_API_ERROR_CODES.VALIDATION_ERROR
          : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json(result.bonsai)
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsed = idSchema.safeParse({ id })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'delete_bonsai')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 盆栽削除
  const result = await deleteBonsaiV1(auth.userId, parsed.data.id)
  if (!result.ok) {
    const code =
      result.status === 404 ? MOBILE_API_ERROR_CODES.NOT_FOUND : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json({ success: true as const })
}
