/**
 * @module lib/api/v1/jwt
 * モバイル API v1 向け JWT 発行・検証モジュール。
 *
 * 鍵は MOBILE_JWT_SECRET（32バイトhex）から導出し、HS256 で署名する。
 * 鍵未設定の検出はリクエスト時に行い、SERVER_MISCONFIGURED（503）を返せる構造にする。
 * モジュール読み込み時に throw しないことで、Web 側の動作を阻害しない。
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import {
  MOBILE_ACCESS_TOKEN_TTL_SECONDS,
  MOBILE_JWT_ISSUER,
  MOBILE_JWT_AUDIENCE,
  MOBILE_TOKEN_TYPE_ACCESS,
  MOBILE_JWT_ALGORITHM,
  MOBILE_JWT_SECRET_HEX_LENGTH,
} from '@/lib/constants/limits/mobile-auth'

/** JWT クレームに付加するトークン種別フィールド名 */
const CLAIM_TOKEN_TYPE = 'typ'

/**
 * 署名済みアクセストークンのクレーム形状。
 * `sub` は userId, `typ` は "access" 固定。
 */
export interface AccessTokenClaims extends JWTPayload {
  sub: string
  typ: typeof MOBILE_TOKEN_TYPE_ACCESS
}

/** JWT 検証成功 */
export type JwtVerifySuccess = { ok: true; claims: AccessTokenClaims }
/** JWT 検証失敗: SERVER_MISCONFIGURED（鍵未設定） */
export type JwtVerifyMisconfigured = { ok: false; reason: 'misconfigured' }
/** JWT 検証失敗: 有効期限切れ */
export type JwtVerifyExpired = { ok: false; reason: 'expired' }
/** JWT 検証失敗: その他不正（署名エラー, 形式エラー等） */
export type JwtVerifyInvalid = { ok: false; reason: 'invalid' }

export type JwtVerifyResult =
  | JwtVerifySuccess
  | JwtVerifyMisconfigured
  | JwtVerifyExpired
  | JwtVerifyInvalid

/**
 * MOBILE_JWT_SECRET を TextEncoder でバイト列に変換する。
 * 未設定または形式不正の場合は null を返す（モジュール読み込み時に throw しない）。
 */
function getSecretKey(): Uint8Array | null {
  const raw = process.env.MOBILE_JWT_SECRET
  if (!raw || raw.length !== MOBILE_JWT_SECRET_HEX_LENGTH) return null
  if (!/^[0-9a-fA-F]+$/.test(raw)) return null
  return new TextEncoder().encode(raw)
}

/**
 * ユーザー ID を subject に持つアクセストークンを発行する。
 * 鍵未設定の場合は null を返す（呼び出し側で SERVER_MISCONFIGURED を返すこと）。
 */
export async function signAccessToken(userId: string): Promise<string | null> {
  const key = getSecretKey()
  if (!key) return null

  return new SignJWT({ [CLAIM_TOKEN_TYPE]: MOBILE_TOKEN_TYPE_ACCESS })
    .setProtectedHeader({ alg: MOBILE_JWT_ALGORITHM })
    .setSubject(userId)
    .setIssuer(MOBILE_JWT_ISSUER)
    .setAudience(MOBILE_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MOBILE_ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key)
}

/**
 * アクセストークンを検証し、クレームを返す。
 *
 * TOKEN_EXPIRED と INVALID_TOKEN を区別することが重要 —
 * モバイルは TOKEN_EXPIRED でのみリフレッシュを試みる（AUTH_INVALID_TOKEN では試みない）。
 */
export async function verifyAccessToken(token: string): Promise<JwtVerifyResult> {
  const key = getSecretKey()
  if (!key) return { ok: false, reason: 'misconfigured' }

  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: MOBILE_JWT_ISSUER,
      audience: MOBILE_JWT_AUDIENCE,
      algorithms: [MOBILE_JWT_ALGORITHM],
    })

    if (payload[CLAIM_TOKEN_TYPE] !== MOBILE_TOKEN_TYPE_ACCESS) {
      return { ok: false, reason: 'invalid' }
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return { ok: false, reason: 'invalid' }
    }

    const claims: AccessTokenClaims = {
      ...payload,
      sub: payload.sub,
      typ: MOBILE_TOKEN_TYPE_ACCESS,
    }
    return { ok: true, claims }
  } catch (err) {
    if (isJoseExpiredError(err)) {
      return { ok: false, reason: 'expired' }
    }
    return { ok: false, reason: 'invalid' }
  }
}

/**
 * jose の JWTExpired エラーを識別する型ガード。
 * `err.code === 'ERR_JWT_EXPIRED'` で判定し、TOKEN_EXPIRED と INVALID_TOKEN を分離する。
 */
function isJoseExpiredError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>)['code'] === 'ERR_JWT_EXPIRED'
  )
}
