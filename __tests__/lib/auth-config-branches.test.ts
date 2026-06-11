// @vitest-environment node
/**
 * auth.config.ts の未カバー行 (152-167) のテスト
 * - jwt callback: token をそのまま返す
 * - session callback: session.user.id と session.user.isAdmin を設定
 */

import { describe, it, expect } from 'vitest'
import { authConfig } from '@/lib/auth.config'

describe('auth.config callbacks - jwt & session (lines 152-167)', () => {
  // ============================================================
  // jwt callback
  // ============================================================
  describe('callbacks.jwt', () => {
    it('tokenをそのまま返す', () => {
      const token = { id: 'user-1', email: 'test@example.com', isAdmin: true }
      const result = authConfig.callbacks?.jwt?.({
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.jwt>>[0])

      expect(result).toBe(token)
    })

    it('空のtokenでもそのまま返す', () => {
      const token = {}
      const result = authConfig.callbacks?.jwt?.({
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.jwt>>[0])

      expect(result).toBe(token)
    })
  })

  // ============================================================
  // session callback
  // ============================================================
  describe('callbacks.session', () => {
    it('session.userにidとisAdminを設定する', () => {
      const session = {
        user: { id: '', name: 'Test', email: 'test@example.com', isAdmin: false },
        expires: '2099-01-01',
      }
      const token = { id: 'user-123', isAdmin: true }

      const result = authConfig.callbacks?.session?.({
        session,
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.session>>[0])

      expect(result).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({
            id: 'user-123',
            isAdmin: true,
          }),
        })
      )
    })

    it('token.isAdminがfalsy の場合、isAdminがfalseになる', () => {
      const session = {
        user: { id: '', name: 'Test', email: 'test@example.com', isAdmin: false },
        expires: '2099-01-01',
      }
      const token = { id: 'user-456', isAdmin: undefined }

      const result = authConfig.callbacks?.session?.({
        session,
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.session>>[0])

      expect(result).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({
            id: 'user-456',
            isAdmin: false,
          }),
        })
      )
    })

    it('session.userがnullの場合、idやisAdminを設定しない', () => {
      const session = {
        user: null as unknown as undefined,
        expires: '2099-01-01',
      }
      const token = { id: 'user-789', isAdmin: true }

      const result = authConfig.callbacks?.session?.({
        session,
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.session>>[0])

      // session.user が falsy なので変更されずそのまま返る
      expect((result as unknown as { user: null }).user).toBeNull()
    })

    it('token.isAdminが0の場合、isAdminがfalseになる', () => {
      const session = {
        user: { id: '', name: 'Test', email: 'test@example.com', isAdmin: false },
        expires: '2099-01-01',
      }
      const token = { id: 'user-100', isAdmin: 0 }

      const result = authConfig.callbacks?.session?.({
        session,
        token,
      } as unknown as Parameters<NonNullable<typeof authConfig.callbacks.session>>[0])

      expect(result).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({
            id: 'user-100',
            isAdmin: false,
          }),
        })
      )
    })
  })

  // ============================================================
  // cookies 設定（NODE_ENV による分岐）
  // ============================================================
  describe('cookies設定', () => {
    it('テスト環境ではセキュアでないCookie名が使われる', () => {
      // NODE_ENV=test なので production ではない
      expect(authConfig.cookies?.sessionToken?.name).toBe('authjs.session-token')
      expect(authConfig.cookies?.callbackUrl?.name).toBe('authjs.callback-url')
      expect(authConfig.cookies?.csrfToken?.name).toBe('authjs.csrf-token')
    })

    it('テスト環境ではsecureがfalse', () => {
      expect(authConfig.cookies?.sessionToken?.options?.secure).toBe(false)
      expect(authConfig.cookies?.callbackUrl?.options?.secure).toBe(false)
      expect(authConfig.cookies?.csrfToken?.options?.secure).toBe(false)
    })

    it('httpOnlyがtrueに設定されている', () => {
      expect(authConfig.cookies?.sessionToken?.options?.httpOnly).toBe(true)
      expect(authConfig.cookies?.callbackUrl?.options?.httpOnly).toBe(true)
      expect(authConfig.cookies?.csrfToken?.options?.httpOnly).toBe(true)
    })

    it('sameSiteがlaxに設定されている', () => {
      expect(authConfig.cookies?.sessionToken?.options?.sameSite).toBe('lax')
      expect(authConfig.cookies?.callbackUrl?.options?.sameSite).toBe('lax')
      expect(authConfig.cookies?.csrfToken?.options?.sameSite).toBe('lax')
    })
  })
})
