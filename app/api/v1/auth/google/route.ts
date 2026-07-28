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
 *   3. User も存在しなければ、termsAccepted === true かつ termsVersion === CURRENT_TERMS_VERSION の
 *      場合のみ新規作成する（不足・不一致は User/Account/token を一切作らず TERMS_ACCEPTANCE_REQUIRED）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import { Prisma } from '@prisma/client'
import {
  apiError,
  apiZodError,
} from '@/lib/api/v1'
import { issueTokenPair } from '@/lib/api/v1/token-pair'
import { googleRequestSchema } from '@/lib/api/v1/schemas'
import { prisma } from '@/lib/db'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { CURRENT_TERMS_VERSION } from '@/lib/constants/terms-version'

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
  const { idToken, termsAccepted, termsVersion } = parsed.data

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
  const resolveResult = await resolveGoogleUser({
    sub,
    email,
    name,
    termsAccepted,
    termsVersion,
  })
  if (!resolveResult.ok) {
    return apiError(MOBILE_API_ERROR_CODES.TERMS_ACCEPTANCE_REQUIRED, 403)
  }
  const userId = resolveResult.userId

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

type ResolveGoogleUserResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'terms_required' }

/**
 * Google sub / email から User ID を解決する。
 * Web の PrismaAdapter + createUser イベントの挙動を再現する。
 *
 * 未知 User の新規作成は termsAccepted === true かつ termsVersion === CURRENT_TERMS_VERSION の
 * 場合のみ行う（条件を満たさない場合は何も作成せず terms_required を返す）。
 * User 作成時は Account 作成・termsAcceptedAt/termsVersion の保存を単一の
 * `prisma.user.create`（ネスト書き込み）内で行い、同一トランザクションとして扱う。
 */
async function resolveGoogleUser(params: {
  sub: string
  email: string
  name: string | undefined
  termsAccepted: true | undefined
  termsVersion: string | undefined
}): Promise<ResolveGoogleUserResult> {
  const { sub, email, name, termsAccepted, termsVersion } = params
  const normalizedEmail = email.toLowerCase().trim()

  // 既存 Account(google, sub) を検索
  const existingAccount = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'google', providerAccountId: sub } },
    select: { userId: true },
  })

  if (existingAccount) {
    return { ok: true, userId: existingAccount.userId }
  }

  // Account が無い: email でユーザーを検索してリンク
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })

  if (existingUser) {
    return { ok: true, userId: await linkGoogleAccount(existingUser.id, sub) }
  }

  // User も存在しない: 現行版の規約同意が明示されている場合のみ新規作成する
  const hasValidConsent = termsAccepted === true && termsVersion === CURRENT_TERMS_VERSION
  if (!hasValidConsent) {
    return { ok: false, reason: 'terms_required' }
  }

  const now = new Date()
  try {
    // Web の createUser イベントと同等に nickname + emailVerified を補完しつつ、
    // Account 作成と termsAcceptedAt/termsVersion の保存を同一ネスト書き込みで行う。
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        nickname: name ?? normalizedEmail.split('@')[0] ?? normalizedEmail,
        emailVerified: now,
        termsAcceptedAt: now,
        termsVersion,
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
    return { ok: true, userId: newUser.id }
  } catch (error) {
    // 並行リクエストが先に同一 User/Account を作成した場合の TOCTOU 対処。
    // 孤立 User を残さないため、作成は諦めて既存の Account/User を再解決する。
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raceAccount = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: sub } },
        select: { userId: true },
      })
      if (raceAccount) {
        return { ok: true, userId: raceAccount.userId }
      }

      const raceUser = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      })
      if (raceUser) {
        return { ok: true, userId: await linkGoogleAccount(raceUser.id, sub) }
      }
    }
    throw error
  }
}

/**
 * 既存 User に Google Account をリンクする。
 * 並行リクエストが同一 Account を先にリンク済みの場合は再解決して userId を返す
 * （二重リンク自体は unique 制約違反になるだけで、User には影響しない）。
 */
async function linkGoogleAccount(userId: string, sub: string): Promise<string> {
  try {
    await prisma.account.create({
      data: {
        userId,
        type: 'oauth',
        provider: 'google',
        providerAccountId: sub,
      },
    })
    return userId
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider: 'google', providerAccountId: sub } },
        select: { userId: true },
      })
      if (existing) {
        return existing.userId
      }
    }
    throw error
  }
}
