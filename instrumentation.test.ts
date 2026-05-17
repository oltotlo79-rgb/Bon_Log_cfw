/**
 * Next.js Instrumentation のユニットテスト
 *
 * register() と onRequestError の挙動を検証する。
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const mockEnforceSecurity = vi.fn()
vi.mock('./lib/security-checks', () => ({
  enforceSecurityInProduction: mockEnforceSecurity,
}))

vi.mock('./sentry.server.config', () => ({}))
vi.mock('./sentry.edge.config', () => ({}))

const mockCaptureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}))

describe('instrumentation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('register', () => {
    it('NEXT_RUNTIME=nodejs のときセキュリティチェックを実行する', async () => {
      process.env.NEXT_RUNTIME = 'nodejs'

      const { register } = await import('./instrumentation')
      await register()

      expect(mockEnforceSecurity).toHaveBeenCalledTimes(1)
    })

    it('NEXT_RUNTIME=edge のときセキュリティチェックを実行しない', async () => {
      process.env.NEXT_RUNTIME = 'edge'

      const { register } = await import('./instrumentation')
      await register()

      expect(mockEnforceSecurity).not.toHaveBeenCalled()
    })

    it('NEXT_RUNTIME 未設定のときセキュリティチェックを実行しない', async () => {
      delete process.env.NEXT_RUNTIME

      const { register } = await import('./instrumentation')
      await register()

      expect(mockEnforceSecurity).not.toHaveBeenCalled()
    })
  })

  describe('onRequestError', () => {
    it('Sentry.captureException にエラーとリクエスト情報を渡す', async () => {
      const { onRequestError } = await import('./instrumentation')

      const err = new Error('Test error') as Error & { digest: string }
      err.digest = 'abc123'
      const request = { path: '/feed', method: 'GET', headers: {} }
      const context = {
        routerKind: 'App Router' as const,
        routePath: '/feed',
        routeType: 'render' as const,
        renderSource: 'react-server-components' as const,
        revalidateReason: undefined as 'on-demand' | 'stale' | undefined,
        renderType: 'dynamic' as const,
      }

      await onRequestError(err, request, context)

      expect(mockCaptureException).toHaveBeenCalledTimes(1)
      expect(mockCaptureException).toHaveBeenCalledWith(err, {
        extra: {
          path: '/feed',
          method: 'GET',
          routePath: '/feed',
          routeType: 'render',
          routerKind: 'App Router',
          renderSource: 'react-server-components',
        },
      })
    })
  })
})
