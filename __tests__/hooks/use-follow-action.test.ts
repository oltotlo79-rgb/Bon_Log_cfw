import { vi, describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Need real useTransition, so unmock React internals
// But we need to control useRouter, useToast, useQueryClient

const mockPush = vi.fn()
const mockToast = vi.fn()
const mockInvalidateQueries = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
    setQueryData: vi.fn(),
  }),
}))

// Import after mocks
import { useFollowAction } from '@/hooks/use-follow-action'

describe('useFollowAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功フロー: onOptimistic → action → キャッシュ無効化', async () => {
    const onOptimistic = vi.fn()
    const onRollback = vi.fn()
    const action = vi.fn().mockResolvedValue({ success: true })
    const getError = vi.fn().mockReturnValue(null)

    const { result } = renderHook(() => useFollowAction())

    await act(async () => {
      result.current.execute({
        onOptimistic,
        onRollback,
        action,
        getError,
      })
    })

    expect(onOptimistic).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledTimes(1)
    expect(getError).toHaveBeenCalledWith({ success: true })
    expect(onRollback).not.toHaveBeenCalled()
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['timeline'] })
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('成功時にsuccessToastが指定されていればトーストを表示する', async () => {
    const action = vi.fn().mockResolvedValue({ success: true })
    const getError = vi.fn().mockReturnValue(null)
    const successToast = { title: 'フォローしました', description: '相手に通知されます' }

    const { result } = renderHook(() => useFollowAction())

    await act(async () => {
      result.current.execute({
        onOptimistic: vi.fn(),
        onRollback: vi.fn(),
        action,
        getError,
        successToast,
      })
    })

    expect(mockToast).toHaveBeenCalledWith(successToast)
  })

  it('エラー時: onRollback呼出 + エラートースト表示', async () => {
    const onOptimistic = vi.fn()
    const onRollback = vi.fn()
    const action = vi.fn().mockResolvedValue({ error: 'サーバーエラー' })
    const getError = vi.fn().mockReturnValue('サーバーエラー')

    const { result } = renderHook(() => useFollowAction())

    await act(async () => {
      result.current.execute({
        onOptimistic,
        onRollback,
        action,
        getError,
      })
    })

    expect(onOptimistic).toHaveBeenCalledTimes(1)
    expect(onRollback).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledWith({
      title: 'エラー',
      description: 'サーバーエラー',
      variant: 'destructive',
    })
    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })

  it('認証エラー時: onRollback呼出 + ログインページへリダイレクト', async () => {
    const onOptimistic = vi.fn()
    const onRollback = vi.fn()
    const action = vi.fn().mockResolvedValue({ error: '認証が必要です' })
    const getError = vi.fn().mockReturnValue('認証が必要です')

    const { result } = renderHook(() => useFollowAction())

    await act(async () => {
      result.current.execute({
        onOptimistic,
        onRollback,
        action,
        getError,
      })
    })

    expect(onRollback).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/login')
    expect(mockToast).not.toHaveBeenCalled()
  })

  it('isPendingはアクション実行中にtrueとなる', async () => {
    let resolveAction!: (value: unknown) => void
    const action = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveAction = resolve })
    )
    const getError = vi.fn().mockReturnValue(null)

    const { result } = renderHook(() => useFollowAction())

    // Before execution
    expect(result.current.isPending).toBe(false)

    // Start execution (don't await yet)
    act(() => {
      result.current.execute({
        onOptimistic: vi.fn(),
        onRollback: vi.fn(),
        action,
        getError,
      })
    })

    // During execution, isPending should be true
    expect(result.current.isPending).toBe(true)

    // Resolve the action
    await act(async () => {
      resolveAction({ success: true })
    })

    // After completion, isPending should be false
    expect(result.current.isPending).toBe(false)
  })

  it('エラー時にキャッシュ無効化は呼ばれない', async () => {
    const action = vi.fn().mockResolvedValue({ error: '失敗' })
    const getError = vi.fn().mockReturnValue('失敗')

    const { result } = renderHook(() => useFollowAction())

    await act(async () => {
      result.current.execute({
        onOptimistic: vi.fn(),
        onRollback: vi.fn(),
        action,
        getError,
      })
    })

    expect(mockInvalidateQueries).not.toHaveBeenCalled()
  })
})
