/**
 * @module app/api/v1/auth/google
 * POST /api/v1/auth/google — Google ID トークン認証
 *
 * jose の createRemoteJWKSet で Google JWKS を検証する（追加依存不要）。
 * Web の NextAuth Google 連携と整合させ、Account モデル経由でユーザーを解決する。
 *
 * ユーザー解決フロー:
 *   1. Account(provider='google', providerAccountId=sub) を検索
 *   2. なければ email で User を検索し Account を作成してリンク（allowDangerousEmailAccountLinking と同等）
 *   3. User も存在しなければ新規作成（nickname / emailVerified を Web の createUser イベントと同等に補完）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import {
  apiError,
  apiZodError,
} from '@/lib/api/v1'
import { issueTokenPair } from '@/lib/api/v1/token-pair'
import { googleRequestSchema } from '@/lib/api/v1/schemas'
import { prisma } from '@/lib/db'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'

const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUER_1 = 'accounts.google.com'
const GOOGLE_ISSUER_2 = 'https://accounts.google.com'

/**
 * Google ID トークンの最小クレーム形状。
 * email_verified が true のものだけ受け入れる（Web の signIn コールバックと同等）。
 */
const googleClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.literal(true),
  name: z.string().optional(),
  picture: z.string().optional(),
})

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = googleRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }
  const { idToken } = parsed.data

  // 2. Google ID トークン検証（jose + JWKS）
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    return apiError(MOBILE_API_ERROR_CODES.SERVER_MISCONFIGURED, 503)
  }

  let rawClaims: unknown
  try {
    const JWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URI))
    const { payload } = await jwtVerify(idToken, JWKS, {
      audience: clientId,
      issuer: [GOOGLE_ISSUER_1, GOOGLE_ISSUER_2],
    })
    rawClaims = payload
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_TOKEN, 401)
  }

  // 3. クレーム形状検証（email_verified === true を必須化）
  const claimsParsed = googleClaimsSchema.safeParse(rawClaims)
  if (!claimsParsed.success) {
    return apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_TOKEN, 401)
  }
  const { sub, email, name } = claimsParsed.data

  // 4. ユーザー解決（Account → email → 新規作成）
  const userId = await resolveGoogleUser({ sub, email, name })

  // 5. 停止チェック
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuspended: true },
  })

  if (!user || user.isSuspended) {
    return apiError(MOBILE_API_ERROR_CODES.ACCOUNT_SUSPENDED, 403)
  }

  // 6. トークンペア発行
  const tokenResult = await issueTokenPair(userId)
  if (!tokenResult.ok) {
    return apiError(MOBILE_API_ERROR_CODES.SERVER_MISCONFIGURED, 503)
  }

  return NextResponse.json(tokenResult.tokenPair, { status: 200 })
}

/**
 * Google sub / email から User ID を解決する。
 * Web の PrismaAdapter + createUser イベントの挙動を再現する。
 */
async function resolveGoogleUser(params: {
  sub: string
  email: string
  name: string | undefined
}): Promise<string> {
  const { sub, email, name } = params
  const normalizedEmail = email.toLowerCase().trim()

  // 既存 Account(google, sub) を検索
  const existingAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'google', providerAccountId: sub } },
    select: { userId: true },
  })

  if (existingAccount) {
    return existingAccount.userId
  }

  // Account が無い: email でユーザーを検索してリンク
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })

  if (existingUser) {
    await prisma.account.create({
      data: {
        userId: existingUser.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: sub,
      },
    })
    return existingUser.id
  }

  // User も存在しない: 新規作成（Web の createUser イベントと同等に nickname + emailVerified を補完）
  const newUser = await prisma.user.create({
    data: {
      email: normalizedEmail,
      nickname: name ?? normalizedEmail.split('@')[0] ?? normalizedEmail,
      emailVerified: new Date(),
      accounts: {
        create: {
          type: 'oauth',
          provider: 'google',
          providerAccountId: sub,
        },
      },
    },
    select: { id: true },
  })

  return newUser.id
}
