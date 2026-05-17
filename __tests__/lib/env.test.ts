// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getAppUrl,
  getAdminEmail,
  getResendApiKey,
  getCronSecret,
  getGuestPassword,
  getBasicAuthConfig,
  getGoogleOAuthConfig,
  getEmailConfig,
  isLegacyCronAuthDisabled,
  isProduction,
  isDevelopment,
} from '@/lib/env'

describe('lib/env', () => {
  const origEnv = process.env

  beforeEach(() => {
    process.env = { ...origEnv }
  })

  afterEach(() => {
    process.env = origEnv
  })

  describe('getAppUrl', () => {
    const setNodeEnv = (v: string) => {
      ;(process.env as { NODE_ENV: string }).NODE_ENV = v
    }

    it('開発環境で NEXT_PUBLIC_APP_URL が未設定ならデフォルトの localhost:3000 を返す', () => {
      setNodeEnv('development')
      delete process.env.NEXT_PUBLIC_APP_URL
      expect(getAppUrl()).toBe('http://localhost:3000')
    })

    it('NEXT_PUBLIC_APP_URL が設定されている場合はその値を返す', () => {
      setNodeEnv('development')
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
      expect(getAppUrl()).toBe('https://example.com')
    })

    it('production で NEXT_PUBLIC_APP_URL が未設定なら例外を投げる (fail-closed)', () => {
      setNodeEnv('production')
      delete process.env.NEXT_PUBLIC_APP_URL
      expect(() => getAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/)
    })

    it('production で NEXT_PUBLIC_APP_URL が空文字なら例外を投げる', () => {
      setNodeEnv('production')
      process.env.NEXT_PUBLIC_APP_URL = '   '
      expect(() => getAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/)
    })

    it('Vercel production (VERCEL_ENV=production) で localhost を指す URL を拒否する', () => {
      setNodeEnv('production')
      process.env.VERCEL_ENV = 'production'
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
      expect(() => getAppUrl()).toThrow(/localhost/)
      delete process.env.VERCEL_ENV
    })

    it('Vercel production で 127.0.0.1 を指す URL を拒否する', () => {
      setNodeEnv('production')
      process.env.VERCEL_ENV = 'production'
      process.env.NEXT_PUBLIC_APP_URL = 'http://127.0.0.1:3000'
      expect(() => getAppUrl()).toThrow(/localhost/)
      delete process.env.VERCEL_ENV
    })

    it('NODE_ENV=production だが Vercel 以外なら localhost も許容 (ローカル next build 用)', () => {
      setNodeEnv('production')
      delete process.env.VERCEL_ENV
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
      expect(getAppUrl()).toBe('http://localhost:3000')
    })

    it('production で不正な URL を拒否する', () => {
      setNodeEnv('production')
      process.env.NEXT_PUBLIC_APP_URL = 'not-a-url'
      expect(() => getAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/)
    })

    it('production で有効な https URL は許可する', () => {
      setNodeEnv('production')
      process.env.NEXT_PUBLIC_APP_URL = 'https://www.bon-log.com'
      expect(getAppUrl()).toBe('https://www.bon-log.com')
    })
  })

  describe('getAdminEmail', () => {
    it('ADMIN_EMAIL が未設定の場合は空文字を返す', () => {
      delete process.env.ADMIN_EMAIL
      expect(getAdminEmail()).toBe('')
    })

    it('ADMIN_EMAIL が設定されている場合はその値を返す', () => {
      process.env.ADMIN_EMAIL = 'admin@example.com'
      expect(getAdminEmail()).toBe('admin@example.com')
    })
  })

  describe('getResendApiKey', () => {
    it('RESEND_API_KEY が未設定の場合は空文字を返す', () => {
      delete process.env.RESEND_API_KEY
      expect(getResendApiKey()).toBe('')
    })

    it('RESEND_API_KEY が設定されている場合はその値を返す', () => {
      process.env.RESEND_API_KEY = 're_abc123'
      expect(getResendApiKey()).toBe('re_abc123')
    })
  })

  describe('getCronSecret', () => {
    it('CRON_SECRET 未設定時は undefined（fail-closed 判定を呼び出し側に委譲）', () => {
      delete process.env.CRON_SECRET
      expect(getCronSecret()).toBeUndefined()
    })

    it('CRON_SECRET 設定時はその値をそのまま返す', () => {
      process.env.CRON_SECRET = 'super-secret-123'
      expect(getCronSecret()).toBe('super-secret-123')
    })
  })

  describe('getGuestPassword', () => {
    it('GUEST_PASSWORD 未設定時は空文字', () => {
      delete process.env.GUEST_PASSWORD
      expect(getGuestPassword()).toBe('')
    })

    it('GUEST_PASSWORD 設定時はその値を返す', () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      expect(getGuestPassword()).toBe('GuestPass1!')
    })
  })

  describe('getBasicAuthConfig', () => {
    it('すべて未設定時は enabled=false / user=undefined / password=undefined', () => {
      delete process.env.BASIC_AUTH_ENABLED
      delete process.env.BASIC_AUTH_USER
      delete process.env.BASIC_AUTH_PASSWORD
      expect(getBasicAuthConfig()).toEqual({
        enabled: false,
        user: undefined,
        password: undefined,
      })
    })

    it('ENABLED 以外の値（例: "yes"）は enabled=false（厳密比較）', () => {
      process.env.BASIC_AUTH_ENABLED = 'yes'
      expect(getBasicAuthConfig().enabled).toBe(false)
    })

    it('ENABLED="true" のときだけ enabled=true で user / password を返す', () => {
      process.env.BASIC_AUTH_ENABLED = 'true'
      process.env.BASIC_AUTH_USER = 'admin'
      process.env.BASIC_AUTH_PASSWORD = 'pw'
      expect(getBasicAuthConfig()).toEqual({
        enabled: true,
        user: 'admin',
        password: 'pw',
      })
    })
  })

  describe('getGoogleOAuthConfig', () => {
    it('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 未設定時は空文字を返す', () => {
      delete process.env.GOOGLE_CLIENT_ID
      delete process.env.GOOGLE_CLIENT_SECRET
      expect(getGoogleOAuthConfig()).toEqual({ clientId: '', clientSecret: '' })
    })

    it('両方設定されている場合はその値を返す', () => {
      process.env.GOOGLE_CLIENT_ID = 'google-client-id'
      process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
      expect(getGoogleOAuthConfig()).toEqual({
        clientId: 'google-client-id',
        clientSecret: 'google-client-secret',
      })
    })

    it('片方だけ設定されている場合は未設定側のみ空文字', () => {
      process.env.GOOGLE_CLIENT_ID = 'only-id'
      delete process.env.GOOGLE_CLIENT_SECRET
      expect(getGoogleOAuthConfig()).toEqual({ clientId: 'only-id', clientSecret: '' })
    })
  })

  describe('getEmailConfig', () => {
    it('EMAIL_PROVIDER 未設定時は console プロバイダー + デフォルト送信元', () => {
      delete process.env.EMAIL_PROVIDER
      delete process.env.EMAIL_FROM
      expect(getEmailConfig()).toEqual({
        provider: 'console',
        fromAddress: 'BON-LOG <onboarding@resend.dev>',
      })
    })

    it('EMAIL_PROVIDER=resend で resend プロバイダー', () => {
      process.env.EMAIL_PROVIDER = 'resend'
      expect(getEmailConfig().provider).toBe('resend')
    })

    it('EMAIL_PROVIDER が resend 以外の値の場合は console にフォールバック（未知値を無害化）', () => {
      process.env.EMAIL_PROVIDER = 'unknown-provider'
      expect(getEmailConfig().provider).toBe('console')
    })

    it('EMAIL_FROM 設定時はその値を返す', () => {
      process.env.EMAIL_FROM = 'App <noreply@example.com>'
      expect(getEmailConfig().fromAddress).toBe('App <noreply@example.com>')
    })

    it('EMAIL_FROM 空文字の場合はデフォルトにフォールバック（|| 演算子）', () => {
      process.env.EMAIL_FROM = ''
      expect(getEmailConfig().fromAddress).toBe('BON-LOG <onboarding@resend.dev>')
    })
  })

  describe('isLegacyCronAuthDisabled', () => {
    it('DISABLE_LEGACY_CRON_AUTH 未設定時は false（レガシー Bearer 許容）', () => {
      delete process.env.DISABLE_LEGACY_CRON_AUTH
      expect(isLegacyCronAuthDisabled()).toBe(false)
    })

    it('DISABLE_LEGACY_CRON_AUTH="true" のときだけ true（厳密比較）', () => {
      process.env.DISABLE_LEGACY_CRON_AUTH = 'true'
      expect(isLegacyCronAuthDisabled()).toBe(true)
    })

    it('DISABLE_LEGACY_CRON_AUTH="1" など任意の真値は false（厳密比較）', () => {
      process.env.DISABLE_LEGACY_CRON_AUTH = '1'
      expect(isLegacyCronAuthDisabled()).toBe(false)
    })
  })

  describe('isProduction / isDevelopment', () => {
    const setNodeEnv = (v: string) => {
      ;(process.env as { NODE_ENV: string }).NODE_ENV = v
    }

    it('NODE_ENV=production で isProduction() だけが true', () => {
      setNodeEnv('production')
      expect(isProduction()).toBe(true)
      expect(isDevelopment()).toBe(false)
    })

    it('NODE_ENV=development で isDevelopment() だけが true', () => {
      setNodeEnv('development')
      expect(isProduction()).toBe(false)
      expect(isDevelopment()).toBe(true)
    })

    it('NODE_ENV=test の場合はどちらも false（test は両方に属さない）', () => {
      setNodeEnv('test')
      expect(isProduction()).toBe(false)
      expect(isDevelopment()).toBe(false)
    })
  })
})
