import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBadge } from '@/components/message/MessageBadge'

// Server Action モック
const mockGetUnreadMessageCount = vi.fn()
vi.mock('@/lib/actions/message', () => ({
  getUnreadMessageCount: () => mockGetUnreadMessageCount(),
}))

// React Query モック - useQuery が queryFn を実行するようにし、
// MessageBadge.tsx 内の queryFn body の `result.success ? result.data : undefined`
// 三項分岐双方を踏むためのスパイを公開する。
type UseQueryArg = {
  queryFn?: () => unknown
  queryKey?: unknown[]
  refetchInterval?: number
}
const queryFnLastResult: { value: unknown } = { value: undefined }
vi.mock('@tanstack/react-query', () => ({
  useQuery: (opts: UseQueryArg) => {
    if (typeof opts?.queryFn === 'function') {
      try {
        const r = opts.queryFn()
        if (r && typeof (r as Promise<unknown>).then === 'function') {
          ;(r as Promise<unknown>)
            .then((v) => {
              queryFnLastResult.value = v
            })
            .catch(() => {
              /* swallow */
            })
        } else {
          queryFnLastResult.value = r
        }
      } catch {
        /* queryFn threw — ignore */
      }
    }
    // Synchronous render result: tests set what `data` should look like via the
    // mocked `getUnreadMessageCount()` return value.
    return { data: mockGetUnreadMessageCount() }
  },
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('MessageBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未読メッセージ数を表示する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 5 })
    render(<MessageBadge />)

    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('未読が0件の場合は何も表示しない', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 0 })
    const { container } = render(<MessageBadge />)

    expect(container.firstChild).toBeNull()
  })

  it('100件以上は99+と表示する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 150 })
    render(<MessageBadge />)

    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('200会話上限に達し未読200以上のときは200+と表示する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 200, capReached: true })
    render(<MessageBadge />)

    expect(screen.getByText('200+')).toBeInTheDocument()
  })

  it('99件は99と表示する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 99 })
    render(<MessageBadge />)

    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('1件の未読を表示する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 1 })
    render(<MessageBadge />)

    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('カスタムクラスを適用する', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 5 })
    render(<MessageBadge className="absolute -top-1 -right-1" />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('absolute', '-top-1', '-right-1')
  })

  it('背景色が適用される', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 5 })
    render(<MessageBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('bg-foreground')
  })

  it('テキスト色が適用される', () => {
    mockGetUnreadMessageCount.mockReturnValue({ count: 5 })
    render(<MessageBadge />)

    const badge = screen.getByText('5')
    expect(badge).toHaveClass('text-background')
  })

  it('データがundefinedの場合は何も表示しない', () => {
    mockGetUnreadMessageCount.mockReturnValue(undefined)
    const { container } = render(<MessageBadge />)

    expect(container.firstChild).toBeNull()
  })

  // ============================================================
  // アクセシビリティ
  // ============================================================

  describe('アクセシビリティ', () => {
    it('バッジにaria-label="未読メッセージN件"があること', () => {
      mockGetUnreadMessageCount.mockReturnValue({ count: 5 })
      render(<MessageBadge />)

      const badge = screen.getByText('5')
      expect(badge).toHaveAttribute('aria-label', '未読メッセージ5件')
    })
  })

  // ============================================================
  // queryFn body — `result.success ? result.data : undefined` 両分岐
  // ============================================================
  describe('queryFn body', () => {
    it('result.success=true → result.data を queryFn の戻り値に伝える', async () => {
      mockGetUnreadMessageCount.mockReturnValue({
        success: true,
        data: { count: 3 },
      })
      render(<MessageBadge />)
      // queryFn は async なので microtask を消化してから検証する
      await Promise.resolve()
      await Promise.resolve()
      expect(queryFnLastResult.value).toEqual({ count: 3 })
    })

    it('result.success=false → undefined にフォールバックする', async () => {
      mockGetUnreadMessageCount.mockReturnValue({
        success: false,
        error: 'unauthorized',
      })
      render(<MessageBadge />)
      await Promise.resolve()
      await Promise.resolve()
      expect(queryFnLastResult.value).toBeUndefined()
    })
  })
})
