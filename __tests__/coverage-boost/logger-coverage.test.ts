// @vitest-environment node

import { vi } from 'vitest'
/**
 * Logger ブランチカバレッジ向上テスト
 *
 * Sentry統合テストは __tests__/lib/logger.test.ts で網羅されているため、
 * このファイルでは環境別のブランチカバレッジに集中する。
 */

// vitest.setup.tsxのグローバルモックを解除して実モジュールをテスト
vi.unmock('@/lib/logger')

// Sentryモックを明示的に設定（他テストとの分離）
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

describe('logger', async () => {
  const originalEnv = process.env.NODE_ENV
  const processEnv = process.env as Record<string, string | undefined>

  afterEach(() => {
    processEnv.NODE_ENV = originalEnv
    vi.restoreAllMocks()
    vi.resetModules()
  })

  async function freshLogger(env: string) {
    vi.resetModules()
    processEnv.NODE_ENV = env
    const mod = await import('@/lib/logger')
    return mod.logger as {
      log: (...args: unknown[]) => void
      warn: (...args: unknown[]) => void
      error: (...args: unknown[]) => void
      debug: (...args: unknown[]) => void
    }
  }

  describe('development mode', () => {
    it('log calls console.log', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
      const logger = await freshLogger('development')
      logger.log('test message', { data: 1 })
      expect(spy).toHaveBeenCalledWith('test message', { data: 1 })
    })

    it('warn calls console.warn', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const logger = await freshLogger('development')
      logger.warn('warning message')
      expect(spy).toHaveBeenCalledWith('warning message')
    })

    it('error calls console.error in development', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const logger = await freshLogger('development')
      logger.error('error occurred')
      expect(spy).toHaveBeenCalledWith('error occurred')
    })

    it('debug calls console.debug with [DEBUG] prefix', async () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
      const logger = await freshLogger('development')
      logger.debug('debug info')
      expect(spy).toHaveBeenCalledWith('[DEBUG]', 'debug info')
    })
  })

  describe('non-development mode - suppressed methods', () => {
    it('log does NOT call console.log', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
      const logger = await freshLogger('production')
      logger.log('suppressed')
      expect(spy).not.toHaveBeenCalled()
    })

    it('warn does NOT call console.warn', async () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const logger = await freshLogger('production')
      logger.warn('suppressed')
      expect(spy).not.toHaveBeenCalled()
    })

    it('debug does NOT call console.debug', async () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
      const logger = await freshLogger('production')
      logger.debug('suppressed')
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('non-development error', () => {
    it('does NOT call console.error in production', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const logger = await freshLogger('production')
      logger.error('prod error')
      // production環境ではconsole.errorは呼ばれない（Sentryに送信）
      expect(console.error).not.toHaveBeenCalled()
    })

    it('error does not throw even without Sentry', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const logger = await freshLogger('production')
      // エラーが投げられないことを確認
      expect(() => {
        logger.error('no crash', new Error('test'))
      }).not.toThrow()
    })
  })

  describe('test environment', () => {
    it('log is suppressed', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
      const logger = await freshLogger('test')
      logger.log('test env')
      expect(spy).not.toHaveBeenCalled()
    })

    it('debug is suppressed', async () => {
      const spy = vi.spyOn(console, 'debug').mockImplementation(() => undefined)
      const logger = await freshLogger('test')
      logger.debug('test env')
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('default export', async () => {
    it('default export has same methods as named export', async () => {
      vi.resetModules()
      processEnv.NODE_ENV = 'test'
      const mod = await import('@/lib/logger')
      expect(mod.default).toBeDefined()
      expect(typeof mod.default.log).toBe('function')
      expect(typeof mod.default.warn).toBe('function')
      expect(typeof mod.default.error).toBe('function')
      expect(typeof mod.default.debug).toBe('function')
    })
  })
})
