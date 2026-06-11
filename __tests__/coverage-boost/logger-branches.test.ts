// @vitest-environment node
/**
 * logger.ts 追加ブランチカバレッジテスト
 *
 * 本番環境でのSentryエラー送信ブランチをカバー
 */
import { vi } from 'vitest'

// Sentryモックを設定
const mockCaptureException = vi.fn()
const mockCaptureMessage = vi.fn()

vi.unmock('@/lib/logger')

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}))

describe('logger.ts 追加ブランチテスト', () => {
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
    return mod.logger
  }

  describe('production - error with Sentry', () => {
    it('Errorオブジェクトの場合captureExceptionを呼ぶ', async () => {
      const logger = await freshLogger('production')
      const testError = new Error('test error')

      logger.error('エラー発生:', testError)

      // Dynamic import is async - need to flush microtasks + timers
      await vi.waitFor(() => {
        expect(mockCaptureException).toHaveBeenCalledWith(
          testError,
          expect.objectContaining({
            extra: expect.objectContaining({
              args: expect.arrayContaining(['エラー発生:']),
            }),
          })
        )
      }, { timeout: 2000 })
    })

    it('Errorオブジェクトがない場合captureMessageを呼ぶ', async () => {
      const logger = await freshLogger('production')

      logger.error('文字列のみのエラー', 'additional info')

      await vi.waitFor(() => {
        expect(mockCaptureMessage).toHaveBeenCalledWith(
          expect.stringContaining('文字列のみのエラー'),
          expect.objectContaining({
            level: 'error',
          })
        )
      }, { timeout: 2000 })
    })

    it('production環境ではconsole.errorが呼ばれない', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const logger = await freshLogger('production')

      logger.error('prod error')

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('info method', () => {
    it('development環境でinfoがconsole.logを呼ぶ', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
      const logger = await freshLogger('development')

      logger.info('info message')

      expect(spy).toHaveBeenCalledWith('info message')
    })

    it('production環境でinfoが抑制される', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
      const logger = await freshLogger('production')

      logger.info('suppressed')

      expect(spy).not.toHaveBeenCalled()
    })
  })
})
