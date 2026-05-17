/**
 * useKeyboardShortcuts のユニットテスト。
 *
 * - 単独キー（'/', 'n', '?'）
 * - 連続キー（g h, g n, g p, g s, g e, g m）
 * - Escape でヘルプを閉じる
 * - 入力中はショートカットを無効化
 * - 修飾キー（Ctrl/Alt/Meta）押下時は無効化
 * - enabled=false の制御
 */

import { vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { useKeyboardShortcuts, KEYBOARD_SHORTCUTS } from '@/hooks/use-keyboard-shortcuts'

function dispatchKey(key: string, options: KeyboardEventInit = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, ...options }))
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // 各テストでフォーカスをリセット
    document.body.focus()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shortcuts 一覧を返す', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    expect(result.current.shortcuts).toBe(KEYBOARD_SHORTCUTS)
    expect(result.current.shortcuts.length).toBeGreaterThan(0)
  })

  it("'/' キーで [data-search-input] にフォーカスする", () => {
    const input = document.createElement('input')
    input.setAttribute('data-search-input', 'true')
    document.body.appendChild(input)
    const focusSpy = vi.spyOn(input, 'focus')
    try {
      renderHook(() => useKeyboardShortcuts())
      act(() => {
        dispatchKey('/')
      })
      expect(focusSpy).toHaveBeenCalled()
    } finally {
      input.remove()
    }
  })

  it("'n' キーで onNewPost が呼ばれる", () => {
    const onNewPost = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onNewPost }))
    act(() => {
      dispatchKey('n')
    })
    expect(onNewPost).toHaveBeenCalledTimes(1)
  })

  it("'?' キーで showHelp が true になる（onShowHelp 未指定時）", () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    act(() => {
      dispatchKey('?')
    })
    expect(result.current.showHelp).toBe(true)
  })

  it("'?' キーで onShowHelp が呼ばれる（指定時）", () => {
    const onShowHelp = vi.fn()
    const { result } = renderHook(() => useKeyboardShortcuts({ onShowHelp }))
    act(() => {
      dispatchKey('?')
    })
    expect(onShowHelp).toHaveBeenCalledTimes(1)
    // onShowHelp 指定時は内部 state は更新しない
    expect(result.current.showHelp).toBe(false)
  })

  it("Escape で showHelp が false になる", () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    // 先にヘルプを開く
    act(() => {
      dispatchKey('?')
    })
    expect(result.current.showHelp).toBe(true)
    // Escape で閉じる
    act(() => {
      dispatchKey('Escape')
    })
    expect(result.current.showHelp).toBe(false)
  })

  it("g h で /feed へ push する", () => {
    renderHook(() => useKeyboardShortcuts())
    act(() => {
      dispatchKey('g')
    })
    act(() => {
      dispatchKey('h')
    })
    expect(mockPush).toHaveBeenCalledWith('/feed')
  })

  it("g n で /notifications へ push する", () => {
    renderHook(() => useKeyboardShortcuts())
    // gKeyPressed の state 更新は React の再レンダリング後に反映されるため
    // act() を分けて再描画 → 新しい handler が登録された後に2 つ目のキーを発火させる
    act(() => {
      dispatchKey('g')
    })
    act(() => {
      dispatchKey('n')
    })
    expect(mockPush).toHaveBeenCalledWith('/notifications')
  })

  it("g p で /users/<id> へ push する（userId 指定時）", () => {
    renderHook(() => useKeyboardShortcuts({ userId: 'u-123' }))
    act(() => {
      dispatchKey('g')
    })
    act(() => {
      dispatchKey('p')
    })
    expect(mockPush).toHaveBeenCalledWith('/users/u-123')
  })

  it('g p で userId 未指定時は遷移しない', () => {
    renderHook(() => useKeyboardShortcuts())
    act(() => {
      dispatchKey('g')
    })
    act(() => {
      dispatchKey('p')
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('g s / g e / g m でそれぞれ /settings, /events, /shops へ', () => {
    renderHook(() => useKeyboardShortcuts())
    act(() => {
      dispatchKey('g')
    })
    act(() => {
      dispatchKey('s')
    })
    expect(mockPush).toHaveBeenCalledWith('/settings')

    mockPush.mockClear()
    act(() => {
      dispatchKey('g')
    })
    act(() => {
      dispatchKey('e')
    })
    expect(mockPush).toHaveBeenCalledWith('/events')

    mockPush.mockClear()
    act(() => {
      dispatchKey('g')
    })
    act(() => {
      dispatchKey('m')
    })
    expect(mockPush).toHaveBeenCalledWith('/shops')
  })

  it('input フィールドにフォーカスがある場合はショートカットが無効', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    const onNewPost = vi.fn()
    try {
      renderHook(() => useKeyboardShortcuts({ onNewPost }))
      act(() => {
        dispatchKey('n')
      })
      expect(onNewPost).not.toHaveBeenCalled()
    } finally {
      input.remove()
    }
  })

  it('Ctrl/Alt/Meta 押下時はショートカットを発火しない', () => {
    const onNewPost = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onNewPost }))
    act(() => {
      dispatchKey('n', { ctrlKey: true })
      dispatchKey('n', { altKey: true })
      dispatchKey('n', { metaKey: true })
    })
    expect(onNewPost).not.toHaveBeenCalled()
  })

  it('enabled=false のときは何も起きない', () => {
    const onNewPost = vi.fn()
    renderHook(() => useKeyboardShortcuts({ onNewPost, enabled: false }))
    act(() => {
      dispatchKey('n')
    })
    expect(onNewPost).not.toHaveBeenCalled()
  })

  it('アンマウント時にイベントリスナーが解除される', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { unmount } = renderHook(() => useKeyboardShortcuts())
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
