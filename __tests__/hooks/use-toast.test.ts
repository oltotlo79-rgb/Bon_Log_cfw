

import { vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useToast } from '@/hooks/use-toast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初期状態ではtoasts配列を持つ', () => {
    const { result } = renderHook(() => useToast())
    expect(Array.isArray(result.current.toasts)).toBe(true)
  })

  it('toast関数を返す', () => {
    const { result } = renderHook(() => useToast())
    expect(typeof result.current.toast).toBe('function')
  })

  it('toastを追加できる', async () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({ title: 'テスト' })
    })

    await waitFor(() => {
      expect(result.current.toasts.some(t => t.title === 'テスト')).toBe(true)
    })
  })

  it('toastにdescriptionを含めることができる', async () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({ title: 'タイトル', description: '詳細説明' })
    })

    await waitFor(() => {
      expect(result.current.toasts.some(t => t.description === '詳細説明')).toBe(true)
    })
  })

  it('toastにvariantを設定できる', async () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({ title: 'エラー', variant: 'destructive' })
    })

    await waitFor(() => {
      expect(result.current.toasts.some(t => t.variant === 'destructive')).toBe(true)
    })
  })

  it('toastにIDが自動で割り当てられる', async () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({ title: 'テストID' })
    })

    await waitFor(() => {
      const toast = result.current.toasts.find(t => t.title === 'テストID')
      expect(toast?.id).toBeDefined()
      expect(typeof toast?.id).toBe('string')
    })
  })

  it('複数のtoastを追加できる', async () => {
    const { result } = renderHook(() => useToast())
    const initialLength = result.current.toasts.length

    act(() => {
      result.current.toast({ title: 'Toast A' })
      result.current.toast({ title: 'Toast B' })
    })

    await waitFor(() => {
      expect(result.current.toasts.length).toBeGreaterThanOrEqual(initialLength + 2)
    })
  })

  it('toastは一意のIDを持つ', async () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({ title: 'Unique1' })
      result.current.toast({ title: 'Unique2' })
    })

    await waitFor(() => {
      const toast1 = result.current.toasts.find(t => t.title === 'Unique1')
      const toast2 = result.current.toasts.find(t => t.title === 'Unique2')
      expect(toast1?.id).not.toBe(toast2?.id)
    })
  })

  it('3秒後にtoastが自動的に削除される', async () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({ title: '削除テスト' })
    })

    await waitFor(() => {
      expect(result.current.toasts.some(t => t.title === '削除テスト')).toBe(true)
    })

    // 3秒経過をシミュレート
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    await waitFor(() => {
      expect(result.current.toasts.some(t => t.title === '削除テスト')).toBe(false)
    })
  })

  it('複数のフックインスタンスが同じ状態を共有する', async () => {
    const { result: result1 } = renderHook(() => useToast())
    const { result: result2 } = renderHook(() => useToast())

    act(() => {
      result1.current.toast({ title: '共有テスト123' })
    })

    await waitFor(() => {
      expect(result1.current.toasts.some(t => t.title === '共有テスト123')).toBe(true)
      expect(result2.current.toasts.some(t => t.title === '共有テスト123')).toBe(true)
    })
  })

  it('titleなしでtoastを作成できる', async () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({ description: '説明のみテスト' })
    })

    await waitFor(() => {
      const toast = result.current.toasts.find(t => t.description === '説明のみテスト')
      expect(toast).toBeDefined()
      expect(toast?.title).toBeUndefined()
    })
  })

  it('空のオブジェクトでtoastを作成できる', async () => {
    const { result } = renderHook(() => useToast())
    const initialLength = result.current.toasts.length

    act(() => {
      result.current.toast({})
    })

    await waitFor(() => {
      expect(result.current.toasts.length).toBe(initialLength + 1)
    })
  })

  it('defaultバリアントでtoastを作成できる', async () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.toast({ title: 'デフォルトバリアント', variant: 'default' })
    })

    await waitFor(() => {
      const toast = result.current.toasts.find(t => t.title === 'デフォルトバリアント')
      expect(toast?.variant).toBe('default')
    })
  })
})
