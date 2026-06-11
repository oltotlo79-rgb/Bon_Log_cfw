// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/**
 * lib/env-validation のテスト
 *
 * - 必須環境変数（DATABASE_URL, NEXTAUTH_SECRET）の検証
 * - 本番環境のみ実行されるオプショナル環境変数の警告ロジック
 *
 * NODE_ENV を切り替えるため process.env の保存・復元を必ず行う。
 */
describe('validateEnv', () => {
  const origEnv = process.env
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    process.env = { ...origEnv }
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = origEnv
    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  describe('正常系（必須変数が揃っている）', () => {
    it('開発環境: 全て揃っていればエラーも警告も出ない', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
      process.env.DATABASE_URL = 'postgresql://test'
      process.env.NEXTAUTH_SECRET = '0123456789abcdef0123'
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).not.toThrow()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('本番環境: 必須＋オプショナル全て揃っていれば警告なし', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
      process.env.DATABASE_URL = 'postgresql://test'
      process.env.NEXTAUTH_SECRET = '0123456789abcdef0123'
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      process.env.SENTRY_DSN = 'https://example.com/123'
      process.env.STRIPE_SECRET_KEY = 'sk_test_xxx'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx'
      process.env.RESEND_API_KEY = 're_xxx'
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.com'
      process.env.TWO_FACTOR_ENCRYPTION_KEY = '0'.repeat(64)
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).not.toThrow()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('DISABLE_RATE_LIMIT の fail-closed ガード', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
      process.env.DATABASE_URL = 'postgresql://test'
      process.env.NEXTAUTH_SECRET = '0123456789abcdef0123'
    })

    it('本番 + 非 loopback URL でフラグ on なら起動を中断する', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://www.bon-log.com'
      process.env.DISABLE_RATE_LIMIT = 'true'
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).toThrow(/DISABLE_RATE_LIMIT/)
    })

    it('loopback URL (CI E2E) ならフラグ on でも中断しない', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
      process.env.DISABLE_RATE_LIMIT = 'true'
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).not.toThrow()
    })

    it('フラグ未設定なら本番 URL でも中断しない', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://www.bon-log.com'
      delete process.env.DISABLE_RATE_LIMIT
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).not.toThrow()
    })
  })

  describe('本番のオプショナル変数欠落警告', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
      process.env.DATABASE_URL = 'postgresql://test'
      process.env.NEXTAUTH_SECRET = '0123456789abcdef0123'
      // NEXT_PUBLIC_APP_URL は production で必須 (canonical / OG / sitemap 生成に使う)。
      // ここでは「他のオプショナル欠落だけ検証する」テスト群のため固定の HTTPS を入れる。
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    })

    it('SENTRY_DSN 未設定で「エラー監視が無効化」警告が出る', async () => {
      delete process.env.SENTRY_DSN
      const { validateEnv } = await import('@/lib/env-validation')
      validateEnv()
      const warnings = consoleWarnSpy.mock.calls.flat().join(' ')
      expect(warnings).toContain('SENTRY_DSN')
      expect(warnings).toContain('エラー監視')
    })

    it('STRIPE_SECRET_KEY 未設定で「プレミアム決済」警告が出る', async () => {
      delete process.env.STRIPE_SECRET_KEY
      const { validateEnv } = await import('@/lib/env-validation')
      validateEnv()
      const warnings = consoleWarnSpy.mock.calls.flat().join(' ')
      expect(warnings).toContain('STRIPE_SECRET_KEY')
    })

    it('UPSTASH_REDIS_REST_URL 未設定で「fail-open」警告が出る', async () => {
      delete process.env.UPSTASH_REDIS_REST_URL
      const { validateEnv } = await import('@/lib/env-validation')
      validateEnv()
      const warnings = consoleWarnSpy.mock.calls.flat().join(' ')
      expect(warnings).toContain('UPSTASH_REDIS_REST_URL')
      expect(warnings).toContain('fail-open')
    })

    it('開発環境ではオプショナル変数の警告は出ない', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
      delete process.env.SENTRY_DSN
      delete process.env.STRIPE_SECRET_KEY
      const { validateEnv } = await import('@/lib/env-validation')
      validateEnv()
      // SENTRY_DSN や STRIPE_SECRET_KEY 関連の警告は出ない
      const warnings = consoleWarnSpy.mock.calls.flat().join(' ')
      expect(warnings).not.toContain('SENTRY_DSN')
      expect(warnings).not.toContain('STRIPE_SECRET_KEY')
    })
  })

  describe('必須変数欠落時の挙動', () => {
    it('本番環境で DATABASE_URL 欠落時は例外を投げる', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
      delete process.env.DATABASE_URL
      process.env.NEXTAUTH_SECRET = '0123456789abcdef0123'
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).toThrow(/DATABASE_URL/)
    })

    it('本番環境で NEXTAUTH_SECRET 欠落時は例外を投げる', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
      process.env.DATABASE_URL = 'postgresql://test'
      delete process.env.NEXTAUTH_SECRET
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).toThrow(/NEXTAUTH_SECRET/)
    })

    it('開発環境では必須変数欠落でも例外を投げず警告のみ', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
      delete process.env.DATABASE_URL
      delete process.env.NEXTAUTH_SECRET
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).not.toThrow()
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('NEXT_PUBLIC_APP_URL の本番制約', () => {
    beforeEach(() => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
      process.env.DATABASE_URL = 'postgresql://test'
      process.env.NEXTAUTH_SECRET = '0123456789abcdef0123'
    })

    it('未設定で例外', async () => {
      delete process.env.NEXT_PUBLIC_APP_URL
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_APP_URL/)
    })

    it('HTTP (非 HTTPS) で例外', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://example.com'
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).toThrow(/HTTPS/)
    })

    it('http://localhost は CI / E2E 用に許容する', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).not.toThrow()
    })

    it('http://127.0.0.1 も loopback として許容する', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3000'
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).not.toThrow()
    })

    it('不正な URL 文字列で例外', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'not-a-url'
      const { validateEnv } = await import('@/lib/env-validation')
      // zod schema 段階で .url() に弾かれるため、Zod の本番 throw 経路で落ちる。
      expect(() => validateEnv()).toThrow()
    })

    it('NEXTAUTH_URL と origin がずれていれば警告', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.com'
      process.env.NEXTAUTH_URL = 'https://auth.example.com'
      const { validateEnv } = await import('@/lib/env-validation')
      validateEnv()
      const warnings = consoleWarnSpy.mock.calls.flat().join(' ')
      expect(warnings).toContain('NEXTAUTH_URL')
      expect(warnings).toContain('origin')
    })

    it('開発環境では未設定でも例外にならない', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
      delete process.env.NEXT_PUBLIC_APP_URL
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).not.toThrow()
    })
  })

  describe('値が不正な場合', () => {
    it('NEXTAUTH_SECRET が短すぎる場合は本番で例外', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
      process.env.DATABASE_URL = 'postgresql://test'
      process.env.NEXTAUTH_SECRET = 'short'
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      const { validateEnv } = await import('@/lib/env-validation')
      expect(() => validateEnv()).toThrow()
    })

    it('STRIPE_SECRET_KEY が sk_ で始まらない場合はエラーログ出力', async () => {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true })
      process.env.DATABASE_URL = 'postgresql://test'
      process.env.NEXTAUTH_SECRET = '0123456789abcdef0123'
      process.env.STRIPE_SECRET_KEY = 'invalid_format'
      const { validateEnv } = await import('@/lib/env-validation')
      validateEnv()
      const errors = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(errors).toContain('STRIPE_SECRET_KEY')
    })
  })
})
