// @vitest-environment node

import { vi } from 'vitest'
// グローバルモックを解除して実際のモジュールをテスト
vi.unmock('@/lib/logger')

// process.envの型をキャストするヘルパー
const setNodeEnv = (env: string) => {
  (process.env as { NODE_ENV: string }).NODE_ENV = env
}

describe('Logger Module', async () => {
  const originalEnv = process.env.NODE_ENV

  afterAll(() => {
    setNodeEnv(originalEnv || 'test')
  })

  describe('Development Environment', async () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      vi.resetModules()
      setNodeEnv('development')
      // 各テストの前にスパイを設定
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation()
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation()
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation()
      consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation()
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
      consoleWarnSpy.mockRestore()
      consoleErrorSpy.mockRestore()
      consoleDebugSpy.mockRestore()
    })

    it('log()は開発環境でconsole.logを呼び出す', async () => {
      const { logger } = await import('@/lib/logger')
      logger.log('test message', { data: 'value' })

      expect(consoleLogSpy).toHaveBeenCalledWith('test message', { data: 'value' })
    })

    it('warn()は開発環境でconsole.warnを呼び出す', async () => {
      const { logger } = await import('@/lib/logger')
      logger.warn('warning message')

      expect(consoleWarnSpy).toHaveBeenCalledWith('warning message')
    })

    it('error()は開発環境でconsole.errorを呼び出す', async () => {
      const { logger } = await import('@/lib/logger')
      logger.error('error message', new Error('test error'))

      expect(consoleErrorSpy).toHaveBeenCalledWith('error message', expect.any(Error))
    })

    it('debug()は開発環境でconsole.debugを[DEBUG]プレフィックス付きで呼び出す', async () => {
      const { logger } = await import('@/lib/logger')
      logger.debug('debug message', { key: 'value' })

      expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG]', 'debug message', { key: 'value' })
    })

    it('複数の引数を渡せる', async () => {
      const { logger } = await import('@/lib/logger')
      logger.log('arg1', 'arg2', 'arg3', 123, { obj: true })

      expect(consoleLogSpy).toHaveBeenCalledWith('arg1', 'arg2', 'arg3', 123, { obj: true })
    })
  })

  describe('Production Environment', async () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      vi.resetModules()
      setNodeEnv('production')
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation()
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation()
      consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation()
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
      consoleWarnSpy.mockRestore()
      consoleDebugSpy.mockRestore()
    })

    it('log()は本番環境ではconsole.logを呼び出さない', async () => {
      const { logger } = await import('@/lib/logger')
      logger.log('test message')

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    it('warn()は本番環境ではconsole.warnを呼び出さない', async () => {
      const { logger } = await import('@/lib/logger')
      logger.warn('warning message')

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('debug()は本番環境ではconsole.debugを呼び出さない', async () => {
      const { logger } = await import('@/lib/logger')
      logger.debug('debug message')

      expect(consoleDebugSpy).not.toHaveBeenCalled()
    })
  })

  describe('Production Environment - Sentry Integration (Server-side)', async () => {
    const mockCaptureException = vi.fn()
    const mockCaptureMessage = vi.fn()

    beforeEach(() => {
      vi.resetModules()
      setNodeEnv('production')
      mockCaptureException.mockReset()
      mockCaptureMessage.mockReset()

      // Sentryモジュールをモック (vi.doMock for non-hoisted usage)
      vi.doMock('@/lib/sentry-shim', () => ({
        captureException: mockCaptureException,
        captureMessage: mockCaptureMessage,
      }))
    })

    afterEach(() => {
      vi.doUnmock('@/lib/sentry-shim')
    })

    it('error()はサーバーサイドでSentry.captureExceptionを呼び出す（Errorオブジェクト）', async () => {
      const { logger } = await import('@/lib/logger')
      const testError = new Error('test server error')

      logger.error('Server error:', testError)

      // CI環境ではwindowリークによりクライアント側(async import)パスに
      // 入る場合があるため、十分な待ち時間を確保
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockCaptureException).toHaveBeenCalledWith(testError, {
        extra: { args: ['Server error:'] },
      })
    })

    it('error()はサーバーサイドでSentry.captureMessageを呼び出す（文字列のみ）', async () => {
      const { logger } = await import('@/lib/logger')

      logger.error('Simple error message', 'additional info')

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Simple error message additional info',
        {
          level: 'error',
          extra: { args: ['Simple error message', 'additional info'] },
        }
      )
    })

    it('error()はSentry呼び出しが例外をスローしてもエラーを伝播させない', async () => {
      // logger.ts は Sentry を静的 import するため、モジュールの解決失敗時点で
      // アプリ全体が起動できない（期待する fail-fast）。
      // 代わりに Sentry の個別メソッドが失敗したケースで logger が堅牢であることを検証する。
      vi.doUnmock('@/lib/sentry-shim')
      vi.doMock('@/lib/sentry-shim', () => ({
        captureException: vi.fn(() => {
          throw new Error('Sentry capture failed')
        }),
        captureMessage: vi.fn(() => {
          throw new Error('Sentry capture failed')
        }),
      }))

      const { logger } = await import('@/lib/logger')

      expect(() => logger.error('test error')).not.toThrow()
      expect(() => logger.error('error with object', new Error('inner'))).not.toThrow()
    })
  })

  describe('Production Environment - Sentry Integration (Client-side)', async () => {
    const mockCaptureException = vi.fn()
    const mockCaptureMessage = vi.fn()
    const originalWindow = global.window

    beforeEach(() => {
      vi.resetModules()
      setNodeEnv('production')
      mockCaptureException.mockReset()
      mockCaptureMessage.mockReset()

      // windowオブジェクトを定義してクライアントサイドを模擬
      // @ts-expect-error - window mock
      global.window = { location: { href: 'http://localhost' } }

      vi.doMock('@/lib/sentry-shim', () => ({
        captureException: mockCaptureException,
        captureMessage: mockCaptureMessage,
      }))
    })

    afterEach(() => {
      vi.doUnmock('@/lib/sentry-shim')
      global.window = originalWindow
    })

    it('error()はクライアントサイドでSentry.captureExceptionを呼び出す（Errorオブジェクト）', async () => {
      const { logger } = await import('@/lib/logger')
      const testError = new Error('test client error')

      logger.error('Client error:', testError)

      // 動的importのPromise解決を待つ
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCaptureException).toHaveBeenCalledWith(testError, {
        extra: { args: ['Client error:'] },
      })
    })

    it('error()はクライアントサイドでSentry.captureMessageを呼び出す（文字列のみ）', async () => {
      const { logger } = await import('@/lib/logger')

      logger.error('Client error message')

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(mockCaptureMessage).toHaveBeenCalledWith(
        'Client error message',
        {
          level: 'error',
          extra: { args: ['Client error message'] },
        }
      )
    })

    it('error()はクライアント側でSentry呼び出しが例外を投げても伝播させない', async () => {
      // 静的 import 前提のため、モジュール取得自体ではなく
      // Sentry メソッド側の失敗で try/catch が機能することを確認する。
      vi.doUnmock('@/lib/sentry-shim')
      vi.doMock('@/lib/sentry-shim', () => ({
        captureException: vi.fn(() => {
          throw new Error('Sentry capture failed')
        }),
        captureMessage: vi.fn(() => {
          throw new Error('Sentry capture failed')
        }),
      }))

      const { logger } = await import('@/lib/logger')

      expect(() => logger.error('test error')).not.toThrow()
    })
  })

  describe('Test Environment', async () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      vi.resetModules()
      setNodeEnv('test')
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation()
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
    })

    it('log()はテスト環境ではconsole.logを呼び出さない', async () => {
      const { logger } = await import('@/lib/logger')
      logger.log('test message')

      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('Default Export', async () => {
    beforeEach(() => {
      vi.resetModules()
      setNodeEnv('development')
    })

    it('デフォルトエクスポートも同じloggerオブジェクト', async () => {
      const loggerModule = await import('@/lib/logger')

      expect(loggerModule.default).toBe(loggerModule.logger)
    })
  })
})
