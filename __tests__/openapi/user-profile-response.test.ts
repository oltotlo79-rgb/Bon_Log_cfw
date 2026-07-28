/**
 * openapi/openapi.json の UserProfileResponse スキーマ契約テスト（v1.6.0 isBlockedByUser 追加分）
 *
 * 実装（app/api/v1/users/[id]/route.ts）が返すフィールドと OpenAPI ドキュメントの
 * properties / required が乖離しないことを固定する回帰テスト。
 */
import { describe, it, expect } from 'vitest'
import openapiSpec from '../../openapi/openapi.json'

describe('openapi.json — UserProfileResponse contract', () => {
  const spec = openapiSpec
  const schema = spec.components.schemas.UserProfileResponse

  it('ドキュメントの version が 1.38.0 である', () => {
    expect(spec.info.version).toBe('1.38.0')
  })

  it('UserProfileResponse に isBlockedByUser プロパティが boolean 型で定義されている', () => {
    expect(schema.properties.isBlockedByUser).toEqual({ type: 'boolean' })
  })

  it('isBlockedByUser が required に含まれる', () => {
    expect(schema.required).toContain('isBlockedByUser')
  })

  it('isBlocked / isMuted / isBlockedByUser / isPremium がすべて required に含まれる（v1.5.0/v1.6.0 分の回帰）', () => {
    expect(schema.required).toEqual(
      expect.arrayContaining(['isBlocked', 'isMuted', 'isBlockedByUser', 'isPremium']),
    )
  })

  it('必須フィールド数とプロパティ数が一致する（余剰・不足なし）', () => {
    expect(schema.required.length).toBe(Object.keys(schema.properties).length)
    for (const key of schema.required) {
      expect(schema.properties).toHaveProperty(key)
    }
  })
})
