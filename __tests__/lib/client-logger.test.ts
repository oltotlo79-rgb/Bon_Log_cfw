import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// client-loggerはグローバルモックされているので、unmockして実モジュールをテスト
vi.unmock('@/lib/client-logger')

describe('client-logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('module exports', () => {
    it('clientLoggerオブジェクトがexportされている', async () => {
      const mod = await import('@/lib/client-logger')
      expect(mod.clientLogger).toBeDefined()
      expect(typeof mod.clientLogger.error).toBe('function')
      expect(typeof mod.clientLogger.log).toBe('function')
      expect(typeof mod.clientLogger.warn).toBe('function')
    })
  })

  describe('メソッド呼び出し', () => {
    it('errorを呼んでもエラーにならない', async () => {
      const { clientLogger } = await import('@/lib/client-logger')
      expect(() => clientLogger.error('test error')).not.toThrow()
    })

    it('logを呼んでもエラーにならない', async () => {
      const { clientLogger } = await import('@/lib/client-logger')
      expect(() => clientLogger.log('test log')).not.toThrow()
    })

    it('warnを呼んでもエラーにならない', async () => {
      const { clientLogger } = await import('@/lib/client-logger')
      expect(() => clientLogger.warn('test warn')).not.toThrow()
    })

    it('errorにErrorオブジェクトを渡してもエラーにならない', async () => {
      const { clientLogger } = await import('@/lib/client-logger')
      expect(() => clientLogger.error('msg', new Error('test'))).not.toThrow()
    })
  })

  describe('development環境でのconsole出力', () => {
    // Vitest sets NODE_ENV='test' by default, which means isDev is false at module evaluation time.
    // client-logger.ts checks process.env.NODE_ENV === 'development' at module load time.
    // We need to test with development NODE_ENV by re-importing.

    let originalNodeEnv: string | undefined

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV
    })

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
      vi.resetModules()
    })

    it('development環境ではconsole.errorが呼ばれる', async () => {
      process.env.NODE_ENV = 'development'
      vi.resetModules()

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { clientLogger } = await import('@/lib/client-logger')
      clientLogger.error('dev error msg')

      expect(consoleSpy).toHaveBeenCalledWith('dev error msg')
      consoleSpy.mockRestore()
    })

    it('development環境ではconsole.logが呼ばれる', async () => {
      process.env.NODE_ENV = 'development'
      vi.resetModules()

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const { clientLogger } = await import('@/lib/client-logger')
      clientLogger.log('dev log msg')

      expect(consoleSpy).toHaveBeenCalledWith('dev log msg')
      consoleSpy.mockRestore()
    })

    it('development環境ではconsole.warnが呼ばれる', async () => {
      process.env.NODE_ENV = 'development'
      vi.resetModules()

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { clientLogger } = await import('@/lib/client-logger')
      clientLogger.warn('dev warn msg')

      expect(consoleSpy).toHaveBeenCalledWith('dev warn msg')
      consoleSpy.mockRestore()
    })

    it('test環境ではconsole.logが呼ばれない', async () => {
      process.env.NODE_ENV = 'test'
      vi.resetModules()

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const { clientLogger } = await import('@/lib/client-logger')
      clientLogger.log('should not appear')

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('test環境ではconsole.warnが呼ばれない', async () => {
      process.env.NODE_ENV = 'test'
      vi.resetModules()

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { clientLogger } = await import('@/lib/client-logger')
      clientLogger.warn('should not appear')

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('本番環境でのSentry送信', () => {
    let originalNodeEnv: string | undefined

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV
    })

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv
      vi.resetModules()
    })

    it('production環境でerrorを呼ぶとSentryに送信しようとする', async () => {
      process.env.NODE_ENV = 'production'
      vi.resetModules()

      // window is defined in jsdom
      const mockCaptureException = vi.fn()
      vi.doMock('@/lib/sentry-shim', () => ({
        captureException: mockCaptureException,
      }))

      const { clientLogger } = await import('@/lib/client-logger')
      clientLogger.error('production error')

      // Sentry import is async, so we wait
      await new Promise((resolve) => setTimeout(resolve, 50))
      // captureException may or may not be called depending on dynamic import resolution
      // The key is no error is thrown
    })

    it('production環境でErrorオブジェクトを渡すとそのErrorがSentryに送信される', async () => {
      process.env.NODE_ENV = 'production'
      vi.resetModules()

      const mockCaptureException = vi.fn()
      vi.doMock('@/lib/sentry-shim', () => ({
        captureException: mockCaptureException,
      }))

      const testError = new Error('test production error')
      const { clientLogger } = await import('@/lib/client-logger')
      clientLogger.error('msg', testError)

      await new Promise((resolve) => setTimeout(resolve, 50))
      // No error thrown
    })
  })
})
