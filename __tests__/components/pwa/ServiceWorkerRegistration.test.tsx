import { vi } from 'vitest'
/**
 * ServiceWorkerRegistration コンポーネントのテスト
 *
 * 以下を網羅的にカバーします:
 * - オンライン/オフライン状態の検出とバナー表示
 * - Service Workerの登録ライフサイクル
 * - 更新検出と更新プロンプト
 * - 「今すぐ更新」「後で」ボタン操作
 * - 開発環境でのSW無効化
 * - controllerchange時のページリロード
 * - エラーハンドリング
 */
import { render, screen, act } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration'

// -------------------------------------------------------
// ヘルパー: Service Worker モック構築
// -------------------------------------------------------

type ListenerMap = Record<string, ((...args: unknown[]) => void)[]>

function createMockRegistration(overrides: Record<string, unknown> = {}) {
  const listeners: ListenerMap = {}
  return {
    scope: '/',
    installing: null as unknown,
    waiting: null as unknown,
    active: null,
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(cb)
    }),
    removeEventListener: vi.fn(),
    __listeners: listeners,
    ...overrides,
  }
}

function createMockServiceWorkerContainer() {
  const containerListeners: ListenerMap = {}
  return {
    register: vi.fn(),
    controller: null as unknown,
    addEventListener: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!containerListeners[event]) containerListeners[event] = []
      containerListeners[event].push(cb)
    }),
    removeEventListener: vi.fn(),
    __listeners: containerListeners,
  }
}

function createMockServiceWorker() {
  const workerListeners: ListenerMap = {}
  return {
    state: 'installing' as string,
    postMessage: vi.fn(),
    addEventListener: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!workerListeners[event]) workerListeners[event] = []
      workerListeners[event].push(cb)
    }),
    removeEventListener: vi.fn(),
    __listeners: workerListeners,
  }
}

// -------------------------------------------------------
// テスト本体
// -------------------------------------------------------

describe('ServiceWorkerRegistration', () => {
  const originalEnv = process.env.NODE_ENV
  const processEnv = process.env as Record<string, string | undefined>
  let windowListeners: ListenerMap
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  // Save the original serviceWorker descriptor so we can restore it
  const originalSWDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()

    // Track window event listeners
    windowListeners = {}
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (event: string, handler: EventListenerOrEventListenerObject) => {
        const fn = typeof handler === 'function' ? handler : handler.handleEvent.bind(handler)
        if (!windowListeners[event]) windowListeners[event] = []
        windowListeners[event].push(fn as (...args: unknown[]) => void)
      }
    )
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener').mockImplementation(() => {})

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Replace window.location to intercept reload() which triggers jsdom navigation warnings.
    // jsdom's window.location.reload is non-configurable so we must replace the whole object.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'http://localhost/',
        pathname: '/',
        search: '',
        hash: '',
        hostname: 'localhost',
        host: 'localhost',
        port: '',
        protocol: 'http:',
        origin: 'http://localhost',
        ancestorOrigins: window.location.ancestorOrigins,
        reload: vi.fn(),
        assign: vi.fn(),
        replace: vi.fn(),
        toString: () => 'http://localhost/',
      },
    })

    // Default: online
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()

    // Restore navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })

    // Restore navigator.serviceWorker
    if (originalSWDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', originalSWDescriptor)
    }

    // Restore NODE_ENV
    processEnv.NODE_ENV = originalEnv
  })

  /**
   * 共通セットアップ: production + serviceWorkerコンテナ設定済みの状態を作る
   */
  function setupProductionSW() {
    processEnv.NODE_ENV = 'production'

    const swContainer = createMockServiceWorkerContainer()
    Object.defineProperty(navigator, 'serviceWorker', { value: swContainer, configurable: true, writable: true })
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true })

    return swContainer
  }

  // =======================================================
  // 基本レンダリング
  // =======================================================

  describe('基本レンダリング', () => {
    it('オンライン時・更新なしでは何も表示しない', () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      // Use development mode to skip SW registration entirely, avoiding side effects
      processEnv.NODE_ENV = 'development'
      const swContainer = createMockServiceWorkerContainer()
      Object.defineProperty(navigator, 'serviceWorker', { value: swContainer, configurable: true, writable: true })

      const { container } = render(<ServiceWorkerRegistration />)
      expect(container.innerHTML).toBe('')
    })

    it('オフライン時にオフラインバナーを表示する', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      processEnv.NODE_ENV = 'development'
      const swContainer = createMockServiceWorkerContainer()
      Object.defineProperty(navigator, 'serviceWorker', { value: swContainer, configurable: true, writable: true })

      render(<ServiceWorkerRegistration />)

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/オフラインです/)).toBeInTheDocument()
      expect(screen.getByText(/一部の機能が制限されます/)).toBeInTheDocument()
    })

    it('オフラインバナーにaria-live="assertive"がある', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      processEnv.NODE_ENV = 'development'
      const swContainer = createMockServiceWorkerContainer()
      Object.defineProperty(navigator, 'serviceWorker', { value: swContainer, configurable: true, writable: true })

      render(<ServiceWorkerRegistration />)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
    })
  })

  // =======================================================
  // オンライン/オフライン イベント切り替え
  // =======================================================

  describe('オンライン/オフライン切り替え', () => {
    it('onlineイベントでオフラインバナーが消える', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText(/オフラインです/)).toBeInTheDocument()

      await act(async () => {
        windowListeners['online']?.forEach(fn => fn())
      })

      expect(screen.queryByText(/オフラインです/)).not.toBeInTheDocument()
    })

    it('offlineイベントでオフラインバナーが表示される', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.queryByText(/オフラインです/)).not.toBeInTheDocument()

      await act(async () => {
        windowListeners['offline']?.forEach(fn => fn())
      })

      expect(screen.getByText(/オフラインです/)).toBeInTheDocument()
    })

    it('オフライン->オンライン->オフラインの切り替えが正しく動作する', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText(/オフラインです/)).toBeInTheDocument()

      // Go online
      await act(async () => {
        windowListeners['online']?.forEach(fn => fn())
      })
      expect(screen.queryByText(/オフラインです/)).not.toBeInTheDocument()

      // Go offline again
      await act(async () => {
        windowListeners['offline']?.forEach(fn => fn())
      })
      expect(screen.getByText(/オフラインです/)).toBeInTheDocument()
    })
  })

  // =======================================================
  // 開発環境でのSW無効化
  // =======================================================

  describe('開発環境', () => {
    it('開発環境ではService Workerを登録せずログを出す', () => {
      const prevEnv = process.env.NODE_ENV
      processEnv.NODE_ENV = 'development'
      const swContainer = createMockServiceWorkerContainer()
      Object.defineProperty(navigator, 'serviceWorker', { value: swContainer, configurable: true, writable: true })

      render(<ServiceWorkerRegistration />)

      expect(consoleLogSpy).toHaveBeenCalledWith('[SW] Service Worker disabled in development mode')
      expect(swContainer.register).not.toHaveBeenCalled()
      processEnv.NODE_ENV = prevEnv
    })
  })

  // =======================================================
  // Service Workerが未サポートの場合
  // =======================================================

  describe('Service Worker未サポート', () => {
    it('serviceWorkerがnavigatorに存在しない場合は何もしない', () => {
      processEnv.NODE_ENV = 'production'

      // Remove serviceWorker entirely via delete so that 'serviceWorker' in navigator === false
      // We need to make it configurable first
      Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true, writable: true })
      // Now delete it so 'in' check fails
       
      delete (navigator as any).serviceWorker

      const { container } = render(<ServiceWorkerRegistration />)
      expect(container.innerHTML).toBe('')
    })
  })

  // =======================================================
  // Service Worker登録: document.readyState === 'complete'
  // =======================================================

  describe('Service Worker登録 (readyState=complete)', () => {
    it('document.readyState が complete のとき直接 registerSW を呼ぶ', async () => {
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(swContainer.register).toHaveBeenCalledWith('/sw.js', { scope: '/' })
      expect(consoleLogSpy).toHaveBeenCalledWith('[SW] Service Worker registered:', '/')
    })
  })

  // =======================================================
  // Service Worker登録: document.readyState !== 'complete'
  // =======================================================

  describe('Service Worker登録 (readyState=loading)', () => {
    it('document.readyState が loading のとき load イベントを待つ', async () => {
      processEnv.NODE_ENV = 'production'
      const swContainer = createMockServiceWorkerContainer()
      Object.defineProperty(navigator, 'serviceWorker', { value: swContainer, configurable: true, writable: true })
      Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true })

      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })

      // register should not be called yet
      expect(swContainer.register).not.toHaveBeenCalled()

      // fire load event
      await act(async () => {
        if (windowListeners['load']) {
          for (const fn of windowListeners['load']) {
            await (fn as () => Promise<void>)()
          }
        }
      })

      expect(swContainer.register).toHaveBeenCalledWith('/sw.js', { scope: '/' })

      // Restore readyState
      Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true })
    })
  })

  // =======================================================
  // 既にwaitingのService Workerがある場合
  // =======================================================

  describe('既にwaitingのSWがある場合', () => {
    it('registration.waiting がある場合に更新プロンプトを表示する', async () => {
      const swContainer = setupProductionSW()
      const waitingSW = createMockServiceWorker()
      const registration = createMockRegistration({ waiting: waitingSW })
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(screen.getByText('アップデートがあります')).toBeInTheDocument()
      expect(screen.getByText('今すぐ更新')).toBeInTheDocument()
      expect(screen.getByText('後で')).toBeInTheDocument()
      expect(screen.getByText(/新しいバージョンが利用可能です/)).toBeInTheDocument()
    })
  })

  // =======================================================
  // updatefound + statechange で新バージョン検出
  // =======================================================

  describe('updatefound -> statechange による更新検出', () => {
    it('新しいSWが installed になり controller がある場合に更新プロンプトを表示する', async () => {
      const swContainer = setupProductionSW()
      const newWorker = createMockServiceWorker()
      const registration = createMockRegistration({ installing: newWorker })
      swContainer.controller = { postMessage: vi.fn() }
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      // fire updatefound
      await act(async () => {
        const cbs = registration.__listeners['updatefound']
        expect(cbs).toBeDefined()
        cbs!.forEach(cb => cb())
      })

      // Simulate the new worker transitioning to 'installed'
      newWorker.state = 'installed'
      await act(async () => {
        const cbs = newWorker.__listeners['statechange']
        expect(cbs).toBeDefined()
        cbs!.forEach(cb => cb())
      })

      expect(consoleLogSpy).toHaveBeenCalledWith('[SW] New version available')
      expect(screen.getByText('アップデートがあります')).toBeInTheDocument()
    })

    it('controller がない場合は更新プロンプトを表示しない', async () => {
      const swContainer = setupProductionSW()
      swContainer.controller = null // No controller (first install)
      const newWorker = createMockServiceWorker()
      const registration = createMockRegistration({ installing: newWorker })
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      // fire updatefound
      await act(async () => {
        registration.__listeners['updatefound']!.forEach(cb => cb())
      })

      // worker installed but no controller
      newWorker.state = 'installed'
      await act(async () => {
        newWorker.__listeners['statechange']!.forEach(cb => cb())
      })

      expect(screen.queryByText('アップデートがあります')).not.toBeInTheDocument()
    })

    it('worker state が installed 以外の場合は更新プロンプトを表示しない', async () => {
      const swContainer = setupProductionSW()
      swContainer.controller = { postMessage: vi.fn() }
      const newWorker = createMockServiceWorker()
      const registration = createMockRegistration({ installing: newWorker })
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      // fire updatefound
      await act(async () => {
        registration.__listeners['updatefound']!.forEach(cb => cb())
      })

      // Worker is still in 'installing' state, not 'installed'
      newWorker.state = 'activating'
      await act(async () => {
        newWorker.__listeners['statechange']!.forEach(cb => cb())
      })

      expect(screen.queryByText('アップデートがあります')).not.toBeInTheDocument()
    })

    it('installing が null の場合は statechange リスナーを追加しない', async () => {
      const swContainer = setupProductionSW()
      const registration = createMockRegistration({ installing: null })
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      // fire updatefound - should not crash even though installing is null
      await act(async () => {
        registration.__listeners['updatefound']!.forEach(cb => cb())
      })

      // No crash, no update prompt
      expect(screen.queryByText('アップデートがあります')).not.toBeInTheDocument()
    })
  })

  // =======================================================
  // 更新プロンプト操作
  // =======================================================

  describe('更新プロンプト操作', () => {
    async function renderWithUpdatePrompt() {
      const swContainer = setupProductionSW()
      const waitingSW = createMockServiceWorker()
      const registration = createMockRegistration({ waiting: waitingSW })
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      return { waitingSW, registration, swContainer }
    }

    it('「今すぐ更新」ボタンでpostMessageを送信し、プロンプトを閉じる', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const { waitingSW } = await renderWithUpdatePrompt()

      expect(screen.getByText('アップデートがあります')).toBeInTheDocument()

      await act(async () => {
        await user.click(screen.getByText('今すぐ更新'))
      })

      expect(waitingSW.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
      expect(screen.queryByText('アップデートがあります')).not.toBeInTheDocument()
    })

    it('「後で」ボタンでプロンプトを閉じる', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await renderWithUpdatePrompt()

      expect(screen.getByText('アップデートがあります')).toBeInTheDocument()

      await act(async () => {
        await user.click(screen.getByText('後で'))
      })

      expect(screen.queryByText('アップデートがあります')).not.toBeInTheDocument()
    })

    it('閉じるボタン（aria-label="閉じる"）でプロンプトを閉じる', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await renderWithUpdatePrompt()

      expect(screen.getByText('アップデートがあります')).toBeInTheDocument()

      await act(async () => {
        await user.click(screen.getByLabelText('閉じる'))
      })

      expect(screen.queryByText('アップデートがあります')).not.toBeInTheDocument()
    })

    it('更新プロンプトにrole="alert"とaria-live="polite"がある', async () => {
      await renderWithUpdatePrompt()

      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'polite')
    })
  })

  // =======================================================
  // 定期更新チェック (setInterval)
  // =======================================================

  describe('定期更新チェック', () => {
    it('1時間ごとにregistration.update()を呼ぶ', async () => {
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(registration.update).not.toHaveBeenCalled()

      // Advance 1 hour
      act(() => {
        vi.advanceTimersByTime(60 * 60 * 1000)
      })
      expect(registration.update).toHaveBeenCalledTimes(1)

      // Advance another hour
      act(() => {
        vi.advanceTimersByTime(60 * 60 * 1000)
      })
      expect(registration.update).toHaveBeenCalledTimes(2)
    })

    it('30分では update が呼ばれない', async () => {
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      act(() => {
        vi.advanceTimersByTime(30 * 60 * 1000)
      })
      expect(registration.update).not.toHaveBeenCalled()
    })

    // 回帰テスト: 本番 Sentry で 17 events 観測されていた
    // "Failed to update a ServiceWorker ... unknown error" の unhandled rejection を防ぐ。
    // registration.update() の reject はネットワーク一時障害等で常時発生しうるため、
    // catch して握りつぶす。次回 interval で再試行されること、reject が unhandled に
    // ならないことを保証する。
    it('update() が reject しても unhandled rejection にならず、次回 interval で再試行される', async () => {
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      // 1 回目失敗 (本番で観測されたパターン) → 2 回目は成功
      registration.update
        .mockRejectedValueOnce(
          new TypeError(
            "Failed to update a ServiceWorker for scope ('https://www.bon-log.com/') with script ('https://www.bon-log.com/sw.js'): An unknown error occurred when fetching the script.",
          ),
        )
        .mockResolvedValueOnce(undefined)

      const unhandledRejections: unknown[] = []
      const onUnhandled = (reason: unknown) => unhandledRejections.push(reason)
      process.on('unhandledRejection', onUnhandled)

      try {
        await act(async () => {
          render(<ServiceWorkerRegistration />)
        })
        await act(async () => {
          await Promise.resolve()
        })

        // 1 時間進める → update が reject
        await act(async () => {
          vi.advanceTimersByTime(60 * 60 * 1000)
          // catch ハンドラの microtask を消化
          await Promise.resolve()
          await Promise.resolve()
        })
        expect(registration.update).toHaveBeenCalledTimes(1)

        // 2 時間目: 再度呼ばれて成功
        await act(async () => {
          vi.advanceTimersByTime(60 * 60 * 1000)
          await Promise.resolve()
        })
        expect(registration.update).toHaveBeenCalledTimes(2)

        // process レベルの unhandledRejection が発火していないこと
        expect(unhandledRejections).toEqual([])
      } finally {
        process.off('unhandledRejection', onUnhandled)
      }
    })
  })

  // =======================================================
  // controllerchange でページリロード
  // =======================================================

  describe('controllerchange', () => {
    it('controllerchange イベントでリロードログを出力する', async () => {
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      // Trigger controllerchange
      const cbs = swContainer.__listeners['controllerchange']
      expect(cbs).toBeDefined()
      expect(cbs!.length).toBeGreaterThan(0)

      await act(async () => {
        cbs!.forEach(cb => cb())
      })

      // window.location.reload is called but cannot be mocked in jsdom;
      // verify via console log that the handler executed
      expect(consoleLogSpy).toHaveBeenCalledWith('[SW] Controller changed, reloading page')
    })

    it('controllerchange が複数回呼ばれてもログは1回だけ出力される', async () => {
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      const cbs = swContainer.__listeners['controllerchange']

      await act(async () => {
        cbs!.forEach(cb => cb())
        cbs!.forEach(cb => cb())
        cbs!.forEach(cb => cb())
      })

      // refreshing flag should prevent multiple executions; log should appear only once
      const reloadLogs = consoleLogSpy.mock.calls.filter(
        (args: unknown[]) => args[0] === '[SW] Controller changed, reloading page'
      )
      expect(reloadLogs).toHaveLength(1)
    })
  })

  // =======================================================
  // 登録エラー
  // =======================================================

  describe('登録エラー', () => {
    it('register が失敗した場合にエラーログを出す', async () => {
      const swContainer = setupProductionSW()
      const error = new Error('Registration failed')
      swContainer.register.mockRejectedValue(error)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SW] Service Worker registration failed:',
        error
      )
    })
  })

  // =======================================================
  // 二重初期化防止
  // =======================================================

  describe('二重初期化防止', () => {
    it('登録は1回だけ行われる', async () => {
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      expect(swContainer.register).toHaveBeenCalledTimes(1)
    })
  })

  // =======================================================
  // クリーンアップ
  // =======================================================

  describe('クリーンアップ', () => {
    it('アンマウント時にイベントリスナーをクリーンアップする', async () => {
      const swContainer = setupProductionSW()
      const registration = createMockRegistration()
      swContainer.register.mockResolvedValue(registration)

      let unmountFn: () => void
      await act(async () => {
        const result = render(<ServiceWorkerRegistration />)
        unmountFn = result.unmount
      })
      await act(async () => {
        await Promise.resolve()
      })

      act(() => {
        unmountFn()
      })

      // Check that removeEventListener was called on window
      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))
      // Check that removeEventListener was called on serviceWorker container
      expect(swContainer.removeEventListener).toHaveBeenCalledWith('controllerchange', expect.any(Function))
    })
  })

  // =======================================================
  // 表示優先度（updatePrompt > offline）
  // =======================================================

  describe('表示優先度', () => {
    it('更新プロンプトはオフラインバナーより優先される', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const swContainer = setupProductionSW()
      const waitingSW = createMockServiceWorker()
      const registration = createMockRegistration({ waiting: waitingSW })
      swContainer.register.mockResolvedValue(registration)

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      // Update prompt should show, not offline banner
      expect(screen.getByText('アップデートがあります')).toBeInTheDocument()
      expect(screen.queryByText(/オフラインです/)).not.toBeInTheDocument()
    })

    it('更新プロンプトを閉じた後にオフラインバナーが表示される', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const swContainer = setupProductionSW()
      const waitingSW = createMockServiceWorker()
      const registration = createMockRegistration({ waiting: waitingSW })
      swContainer.register.mockResolvedValue(registration)

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await act(async () => {
        render(<ServiceWorkerRegistration />)
      })
      await act(async () => {
        await Promise.resolve()
      })

      // Dismiss the update prompt
      await act(async () => {
        await user.click(screen.getByText('後で'))
      })

      // Now offline banner should show
      expect(screen.queryByText('アップデートがあります')).not.toBeInTheDocument()
      expect(screen.getByText(/オフラインです/)).toBeInTheDocument()
    })
  })
})
