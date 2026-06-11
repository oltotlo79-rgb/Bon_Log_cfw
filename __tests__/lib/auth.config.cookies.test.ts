// @vitest-environment node

/**
 * auth.config - Cookie設定の分岐カバレッジテスト
 *
 * 対象: lines 103-125 — NODE_ENV による cookie名・secure属性の分岐
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('auth.config cookies branch coverage', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    vi.resetModules()
    // @ts-expect-error -- NODE_ENV is readonly
    process.env.NODE_ENV = originalEnv
  })

  describe('production環境', () => {
    beforeEach(() => {
      vi.resetModules()
      // @ts-expect-error -- NODE_ENV is readonly
      process.env.NODE_ENV = 'production'
    })

    it('sessionToken cookie名が __Secure- プレフィックス付きになる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.sessionToken?.name).toBe('__Secure-authjs.session-token')
    })

    it('sessionToken cookie が secure: true になる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.sessionToken?.options?.secure).toBe(true)
    })

    it('callbackUrl cookie名が __Secure- プレフィックス付きになる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.callbackUrl?.name).toBe('__Secure-authjs.callback-url')
    })

    it('callbackUrl cookie が secure: true になる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.callbackUrl?.options?.secure).toBe(true)
    })

    it('csrfToken cookie名が __Host- プレフィックス付きになる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.csrfToken?.name).toBe('__Host-authjs.csrf-token')
    })

    it('csrfToken cookie が secure: true になる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.csrfToken?.options?.secure).toBe(true)
    })
  })

  describe('開発環境', () => {
    beforeEach(() => {
      vi.resetModules()
      // @ts-expect-error -- NODE_ENV is readonly
      process.env.NODE_ENV = 'development'
    })

    it('sessionToken cookie名がプレフィックスなしになる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.sessionToken?.name).toBe('authjs.session-token')
    })

    it('sessionToken cookie が secure: false になる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.sessionToken?.options?.secure).toBe(false)
    })

    it('callbackUrl cookie名がプレフィックスなしになる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.callbackUrl?.name).toBe('authjs.callback-url')
    })

    it('callbackUrl cookie が secure: false になる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.callbackUrl?.options?.secure).toBe(false)
    })

    it('csrfToken cookie名がプレフィックスなしになる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.csrfToken?.name).toBe('authjs.csrf-token')
    })

    it('csrfToken cookie が secure: false になる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      expect(authConfig.cookies?.csrfToken?.options?.secure).toBe(false)
    })
  })

  describe('共通Cookie設定', () => {
    it('sessionToken に httpOnly, sameSite, path が正しく設定されている', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      const opts = authConfig.cookies?.sessionToken?.options
      expect(opts?.httpOnly).toBe(true)
      expect(opts?.sameSite).toBe('lax')
      expect(opts?.path).toBe('/')
    })

    it('callbackUrl に httpOnly, sameSite, path が正しく設定されている', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      const opts = authConfig.cookies?.callbackUrl?.options
      expect(opts?.httpOnly).toBe(true)
      expect(opts?.sameSite).toBe('lax')
      expect(opts?.path).toBe('/')
    })

    it('csrfToken に httpOnly, sameSite, path が正しく設定されている', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      const opts = authConfig.cookies?.csrfToken?.options
      expect(opts?.httpOnly).toBe(true)
      expect(opts?.sameSite).toBe('lax')
      expect(opts?.path).toBe('/')
    })
  })

  describe('callbacks.session', () => {
    it('session.user が存在する場合に id と isAdmin をセットする', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      const session = { user: { id: '', isAdmin: false } } as { user: { id: string; isAdmin: boolean } }
      const token = { id: 'user-123', isAdmin: true }

      const result = authConfig.callbacks?.session?.({
        session,
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.session>>[0])

      expect(result).toEqual({
        user: { id: 'user-123', isAdmin: true },
      })
    })

    it('session.user が undefined の場合はそのまま返す', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      const session = {} as { user?: unknown }
      const token = { id: 'user-123', isAdmin: true }

      const result = authConfig.callbacks?.session?.({
        session,
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.session>>[0])

      expect(result).toEqual({})
    })

    it('token.isAdmin が falsy の場合 isAdmin が false になる', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      const session = { user: { id: '', isAdmin: true } } as { user: { id: string; isAdmin: boolean } }
      const token = { id: 'user-456' }

      const result = authConfig.callbacks?.session?.({
        session,
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.session>>[0])

      expect(result).toEqual({
        user: { id: 'user-456', isAdmin: false },
      })
    })
  })

  describe('callbacks.jwt', () => {
    it('token をそのまま返す', async () => {
      const { authConfig } = await import('@/lib/auth.config')
      const token = { id: 'user-1', isAdmin: true, sub: 'abc' }

      const result = authConfig.callbacks?.jwt?.({
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.jwt>>[0])

      expect(result).toBe(token)
    })
  })
})
