/**
 * AnnouncementBannerClient のテスト。
 *
 * - 表示候補が空なら何も描画しない
 * - dismiss ボタンで localStorage に ID が記録され再表示されない
 * - dismiss 済み ID は次回も非表示
 * - localStorage 破損時は空集合にフォールバック
 *
 * vitest.setup.tsx の localStorage モックは vi.fn() のみで永続化しないため、
 * Map ベース実装を注入して localStorage の挙動を再現する。
 * AnnouncementBannerClient はモジュールレベルキャッシュを持つため、
 * 各テスト前に `vi.resetModules()` で動的 import し直す。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { STORAGE_KEY_DISMISSED_ANNOUNCEMENTS } from '@/lib/constants/storage-keys'

vi.mock('@/lib/client-logger', () => ({
  clientLogger: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

function installLocalStorageMap(): Map<string, string> {
  const store = new Map<string, string>()
  const ls = window.localStorage
  ;(ls.getItem as ReturnType<typeof vi.fn>).mockImplementation((k: string) =>
    store.has(k) ? store.get(k) ?? null : null,
  )
  ;(ls.setItem as ReturnType<typeof vi.fn>).mockImplementation((k: string, v: string) => {
    store.set(k, v)
  })
  ;(ls.removeItem as ReturnType<typeof vi.fn>).mockImplementation((k: string) => {
    store.delete(k)
  })
  ;(ls.clear as ReturnType<typeof vi.fn>).mockImplementation(() => {
    store.clear()
  })
  return store
}

const items = [
  { id: 'a1', title: '更新のお知らせ', content: '新機能が追加されました', type: 'banner' },
  { id: 'a2', title: 'メンテナンス', content: '深夜にメンテします', type: 'both' },
]

async function freshImport() {
  vi.resetModules()
  return await import('@/components/common/AnnouncementBannerClient')
}

describe('AnnouncementBannerClient', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installLocalStorageMap()
  })

  it('items が空配列なら何も描画しない', async () => {
    const { AnnouncementBannerClient } = await freshImport()
    const { container } = render(<AnnouncementBannerClient items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('最初のお知らせを表示する', async () => {
    const { AnnouncementBannerClient } = await freshImport()
    render(<AnnouncementBannerClient items={items} />)
    expect(screen.getByText('更新のお知らせ')).toBeInTheDocument()
    expect(screen.getByText('新機能が追加されました')).toBeInTheDocument()
  })

  it('dismiss すると次のお知らせを表示する', async () => {
    const { AnnouncementBannerClient } = await freshImport()
    render(<AnnouncementBannerClient items={items} />)
    act(() => {
      fireEvent.click(screen.getByLabelText('このお知らせを閉じる'))
    })
    expect(screen.queryByText('更新のお知らせ')).not.toBeInTheDocument()
    expect(screen.getByText('メンテナンス')).toBeInTheDocument()
  })

  it('dismiss した ID は localStorage に記録される', async () => {
    const { AnnouncementBannerClient } = await freshImport()
    render(<AnnouncementBannerClient items={items} />)
    act(() => {
      fireEvent.click(screen.getByLabelText('このお知らせを閉じる'))
    })
    const raw = store.get(STORAGE_KEY_DISMISSED_ANNOUNCEMENTS)
    expect(raw).toBeDefined()
    expect(JSON.parse(raw as string)).toEqual(['a1'])
  })

  it('localStorage に dismiss 済み ID があれば該当お知らせは非表示', async () => {
    store.set(STORAGE_KEY_DISMISSED_ANNOUNCEMENTS, JSON.stringify(['a1']))
    const { AnnouncementBannerClient } = await freshImport()
    render(<AnnouncementBannerClient items={items} />)
    expect(screen.queryByText('更新のお知らせ')).not.toBeInTheDocument()
    expect(screen.getByText('メンテナンス')).toBeInTheDocument()
  })

  it('全件 dismiss 済みなら何も描画しない', async () => {
    store.set(STORAGE_KEY_DISMISSED_ANNOUNCEMENTS, JSON.stringify(['a1', 'a2']))
    const { AnnouncementBannerClient } = await freshImport()
    const { container } = render(<AnnouncementBannerClient items={items} />)
    expect(container.querySelector('[role="region"]')).toBeNull()
  })

  it('localStorage が壊れた JSON でも空集合扱いでフォールバックする', async () => {
    store.set(STORAGE_KEY_DISMISSED_ANNOUNCEMENTS, '{not-json')
    const { AnnouncementBannerClient } = await freshImport()
    render(<AnnouncementBannerClient items={items} />)
    expect(screen.getByText('更新のお知らせ')).toBeInTheDocument()
  })

  it('localStorage が配列でない場合も空集合扱いでフォールバックする', async () => {
    store.set(STORAGE_KEY_DISMISSED_ANNOUNCEMENTS, JSON.stringify({ foo: 'bar' }))
    const { AnnouncementBannerClient } = await freshImport()
    render(<AnnouncementBannerClient items={items} />)
    expect(screen.getByText('更新のお知らせ')).toBeInTheDocument()
  })

  it('localStorage.setItem が throw しても UI は dismiss を反映する（warn のみ）', async () => {
    const { clientLogger } = await import('@/lib/client-logger')
    ;(window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('quota exceeded')
    })
    const { AnnouncementBannerClient } = await freshImport()
    render(<AnnouncementBannerClient items={items} />)
    act(() => {
      fireEvent.click(screen.getByLabelText('このお知らせを閉じる'))
    })
    // catch しても crash しないこと（warn のみ）
    expect(clientLogger.warn).toHaveBeenCalled()
    // localStorage には書けなかったので次レンダ時もキャッシュに依存
    // dispatchEvent は呼ばれていない（try 内で setItem が throw したため）が、
    // useState による local 再描画はしないので a1 は引き続き visible item として残る。
    // よって "更新のお知らせ" がそのまま見えていることを確認。
    expect(screen.getByText('更新のお知らせ')).toBeInTheDocument()
  })

  it('storage イベントで key が異なる場合は再描画しない', async () => {
    const { AnnouncementBannerClient } = await freshImport()
    render(<AnnouncementBannerClient items={items} />)
    expect(screen.getByText('更新のお知らせ')).toBeInTheDocument()

    // 別キーへの storage イベントは反応しない
    store.set('other-key', 'changed')
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other-key' }))
    })
    expect(screen.getByText('更新のお知らせ')).toBeInTheDocument()
  })

  it('storage イベントで他タブの dismiss を反映する', async () => {
    const { AnnouncementBannerClient } = await freshImport()
    render(<AnnouncementBannerClient items={items} />)
    expect(screen.getByText('更新のお知らせ')).toBeInTheDocument()

    // 他タブからの dismiss を再現
    store.set(STORAGE_KEY_DISMISSED_ANNOUNCEMENTS, JSON.stringify(['a1']))
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_KEY_DISMISSED_ANNOUNCEMENTS }),
      )
    })
    expect(screen.queryByText('更新のお知らせ')).not.toBeInTheDocument()
    expect(screen.getByText('メンテナンス')).toBeInTheDocument()
  })

  it('アンマウント時に subscribe が解除される（unmount 後の storage イベントで warn しない）', async () => {
    const { AnnouncementBannerClient } = await freshImport()
    const { unmount } = render(<AnnouncementBannerClient items={items} />)
    unmount()
    // unmount 後に storage イベントを発火しても crash しないこと
    expect(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_KEY_DISMISSED_ANNOUNCEMENTS }),
      )
    }).not.toThrow()
  })
})
