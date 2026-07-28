/**
 * @module lib/api/v1
 * モバイル API v1 共通基盤のバレルエクスポート。
 *
 * route handler からはこの index を経由してインポートする。
 */

export { signAccessToken, verifyAccessToken } from './jwt'
export type { AccessTokenClaims, JwtVerifyResult } from './jwt'

export { requireBearerUser } from './auth-guard'
export type { BearerAuthOptions } from './auth-guard'

export { apiError, apiErrorWithDetails, apiZodError, apiRateLimited } from './response'

export { apiPaginationSchema } from './pagination'
export type { PaginatedResponse } from './pagination'

export type { BearerAuthResult, RateLimitResult } from './types'
