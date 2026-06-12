/**
 * @module lib/api/v1/schemas
 * モバイル API v1 の Zod スキーマ集約。
 *
 * route handler と OpenAPI ジェネレータの双方が同一スキーマを import する
 * single source of truth。スキーマ定義のみを公開し、ビジネスロジックは含まない。
 */

export * from './request'
export * from './response'
