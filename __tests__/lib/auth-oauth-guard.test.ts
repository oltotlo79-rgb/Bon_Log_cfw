import { describe, it, expect } from 'vitest'
import {
  assertSafeOAuthLinking,
  VERIFIED_EMAIL_OAUTH_PROVIDERS,
} from '@/lib/security/oauth-guard'

/**
 * assertSafeOAuthLinking のテスト
 *
 * `allowDangerousEmailAccountLinking: true` を指定したプロバイダーが
 * ホワイトリスト外の場合に例外を投げることを確認する。
 */

describe('assertSafeOAuthLinking', () => {
  it('allowDangerousEmailAccountLinking が未指定のプロバイダーはそのまま通過する', () => {
    const providers = [
      { id: 'credentials', options: {} },
      { id: 'github', options: { allowDangerousEmailAccountLinking: false } },
    ]
    expect(() => assertSafeOAuthLinking(providers)).not.toThrow()
  })

  it('google は allowDangerousEmailAccountLinking=true でも許容される（ホワイトリスト）', () => {
    const providers = [
      { id: 'google', options: { allowDangerousEmailAccountLinking: true } },
    ]
    expect(() => assertSafeOAuthLinking(providers)).not.toThrow()
  })

  it('ホワイトリスト外のプロバイダーで allowDangerousEmailAccountLinking=true は例外を投げる', () => {
    const providers = [
      { id: 'custom-oauth', options: { allowDangerousEmailAccountLinking: true } },
    ]
    expect(() => assertSafeOAuthLinking(providers)).toThrow(/custom-oauth/)
    expect(() => assertSafeOAuthLinking(providers)).toThrow(/VERIFIED_EMAIL_OAUTH_PROVIDERS/)
  })

  it('options が null / undefined でもクラッシュしない', () => {
    expect(() => assertSafeOAuthLinking([{ id: 'x' }])).not.toThrow()
    expect(() => assertSafeOAuthLinking([{ id: 'x', options: null }])).not.toThrow()
  })

  it('配列要素が非オブジェクトでもクラッシュしない', () => {
    expect(() => assertSafeOAuthLinking([null, undefined, 'str', 0])).not.toThrow()
  })

  it('入力配列がそのまま返される（型保持）', () => {
    const input = [{ id: 'google', options: { allowDangerousEmailAccountLinking: true } }]
    const result = assertSafeOAuthLinking(input)
    expect(result).toBe(input)
  })

  it('VERIFIED_EMAIL_OAUTH_PROVIDERS に google が含まれる', () => {
    expect(VERIFIED_EMAIL_OAUTH_PROVIDERS.has('google')).toBe(true)
  })
})
