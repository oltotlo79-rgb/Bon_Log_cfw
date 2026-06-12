/**
 * @module lib/api/v1/token-pair
 *
 * モバイル API v1 のトークンペア（アクセストークン + リフレッシュトークン）発行。
 *
 * login / 2fa/verify / refresh / google の 4 エンドポイントから共有する。
 * リフレッシュトークンは crypto.randomBytes で生成し、SHA-256 ハッシュのみ DB 保存。
 *
 * Returns custom shape instead of ActionResult because this is an infrastructure helper
 * used only by API route handlers, not a Server Action for client consumption.
 */

import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { signAccessToken } from './jwt'
import {
  MOBILE_ACCESS_TOKEN_TTL_SECONDS,
  MOBILE_REFRESH_TOKEN_TTL_SECONDS,
  MOBILE_REFRESH_TOKEN_RANDOM_BYTES,
} from '@/lib/constants/limits/mobile-auth'

/**
 * `prisma.refreshToken.create` を持つ最小インターフェース。
 * global PrismaClient とトランザクションクライアント（Prisma.TransactionClient）の
 * 両方が満たすため、union キャストなしに共通で受け取れる。
 */
type RefreshTokenCreator = Pick<Prisma.TransactionClient, 'refreshToken'>

/** トークンペアの共通レスポンス形状（モバイルと合意済み）。 */
export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type IssueTokenPairResult =
  | { ok: true; tokenPair: TokenPair }
  | { ok: false; reason: 'misconfigured' }

/**
 * アクセストークンとリフレッシュトークンのペアを発行し、リフレッシュトークンを DB 保存する。
 *
 * DB 保存はリフレッシュトークンのみ（アクセストークンはステートレス JWT）。
 * 生リフレッシュトークンは返却するが DB には SHA-256 ハッシュのみ保存する。
 *
 * @param userId - トークンを発行するユーザーの ID
 * @param db - Prisma クライアント。トランザクション内で呼ぶ場合は tx を渡し、
 *             新トークン作成をトランザクションに参加させる。省略時は global prisma。
 */
export async function issueTokenPair(
  userId: string,
  db: RefreshTokenCreator = prisma,
): Promise<IssueTokenPairResult> {
  const accessToken = await signAccessToken(userId)
  if (!accessToken) {
    return { ok: false, reason: 'misconfigured' }
  }

  const rawRefreshToken = crypto
    .randomBytes(MOBILE_REFRESH_TOKEN_RANDOM_BYTES)
    .toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')

  const expiresAt = new Date(Date.now() + MOBILE_REFRESH_TOKEN_TTL_SECONDS * 1000)

  await db.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  })

  return {
    ok: true,
    tokenPair: {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: MOBILE_ACCESS_TOKEN_TTL_SECONDS,
    },
  }
}
