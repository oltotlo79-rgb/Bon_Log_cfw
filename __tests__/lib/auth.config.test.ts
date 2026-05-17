// @vitest-environment node

import { authConfig } from '@/lib/auth.config'

describe('auth.config', () => {
  describe('pages設定', () => {
    it('signInページが/loginに設定されている', () => {
      expect(authConfig.pages?.signIn).toBe('/login')
    })

    it('errorページが/loginに設定されている', () => {
      expect(authConfig.pages?.error).toBe('/login')
    })
  })

  describe('providers設定', () => {
    it('providersが空配列', () => {
      expect(authConfig.providers).toEqual([])
    })
  })

  /**
   * `authorized` callback は proxy.ts に認可判定を委譲するため常に true を返す仕様。
   * NextAuth の既定リダイレクトでは callbackUrl を付与できず、PROTECTED_PATHS の
   * 判定が auth.config と proxy.ts で二重化する問題を避けるための設計判断。
   * リグレッション検知のため代表的なパスで true を返すことを検証する。
   */
  describe('callbacks.authorized', () => {
    const createMockRequest = (pathname: string) => ({
      nextUrl: {
        pathname,
        searchParams: new URLSearchParams(),
      } as URL,
    })

    type AuthorizedArgs = Parameters<NonNullable<NonNullable<typeof authConfig.callbacks>['authorized']>>[0]

    const samplePaths = [
      '/',
      '/login',
      '/register',
      '/password-reset',
      '/verify-email',
      '/about',
      '/help',
      '/contact',
      '/pesticides',
      '/pesticides/columns/abc',
      '/fertilizers',
      '/hormones',
      '/shops',
      '/events',
      '/dictionary',
      '/feed',
      '/settings',
      '/notifications',
      '/admin/users',
      '/api/auth/signin',
      '/_next/static/chunks/main.js',
      '/favicon.ico',
    ]

    samplePaths.forEach((path) => {
      it(`${path} は未ログインでも true を返す (proxy.ts に判定委譲)`, () => {
        const result = authConfig.callbacks?.authorized?.({
          auth: null,
          request: createMockRequest(path),
        } as AuthorizedArgs)

        expect(result).toBe(true)
      })

      it(`${path} はログイン済みでも true を返す`, () => {
        const result = authConfig.callbacks?.authorized?.({
          auth: { user: { id: 'user-1', email: 'test@example.com' } },
          request: createMockRequest(path),
        } as AuthorizedArgs)

        expect(result).toBe(true)
      })
    })
  })
})
