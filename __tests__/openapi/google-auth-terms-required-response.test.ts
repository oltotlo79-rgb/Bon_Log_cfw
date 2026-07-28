/**
 * openapi/openapi.json の GoogleAuthTermsRequiredResponse スキーマ契約テスト（v1.38.0）
 *
 * POST /api/v1/auth/google の 403 レスポンスが、現行規約バージョンを含む
 * details.currentTermsVersion を機械可読な形で公開し続けることを固定する回帰テスト。
 */
import { describe, it, expect } from 'vitest'
import openapiSpec from '../../openapi/openapi.json'

describe('openapi.json — GoogleAuthTermsRequiredResponse contract', () => {
  const spec = openapiSpec
  const schema = spec.components.schemas.GoogleAuthTermsRequiredResponse

  it('ドキュメントの version が 1.38.0 である', () => {
    expect(spec.info.version).toBe('1.38.0')
  })

  it('components.schemas に GoogleAuthTermsRequiredResponse が定義されている', () => {
    expect(schema).toBeDefined()
  })

  it('error.properties に details が定義されている', () => {
    expect(schema.properties.error.properties.details).toBeDefined()
    expect(schema.properties.error.properties.details.type).toBe('object')
  })

  it('error.properties.details.properties に currentTermsVersion が string 型で定義されている', () => {
    expect(schema.properties.error.properties.details.properties.currentTermsVersion).toEqual({
      type: 'string',
    })
  })

  it('currentTermsVersion は details.required に含まれる', () => {
    expect(schema.properties.error.properties.details.required).toContain('currentTermsVersion')
  })

  it('details は error.required に含まれない（optional。ACCOUNT_SUSPENDED 等では省略されるため）', () => {
    expect(schema.properties.error.required).not.toContain('details')
  })

  it('code / message / status は従来どおり error.required に含まれる', () => {
    expect(schema.properties.error.required).toEqual(
      expect.arrayContaining(['code', 'message', 'status']),
    )
  })

  it('POST /api/v1/auth/google の 403 レスポンスが GoogleAuthTermsRequiredResponse を参照する', () => {
    const googlePath = spec.paths['/api/v1/auth/google']
    const response403 = googlePath.post.responses['403']
    expect(response403.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/GoogleAuthTermsRequiredResponse',
    )
  })

  it('POST /api/v1/auth/google の 400/401/429/503 は引き続き共通 ApiErrorResponse を参照する（details なしエンドポイントの回帰）', () => {
    const googlePath = spec.paths['/api/v1/auth/google']
    for (const status of ['400', '401', '429', '503'] as const) {
      const response = googlePath.post.responses[status]
      expect(response.content['application/json'].schema.$ref).toBe(
        '#/components/schemas/ApiErrorResponse',
      )
    }
  })
})
