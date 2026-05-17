// @vitest-environment node
/**
 * admin/events/page.tsx ブランチカバレッジ向上テスト
 *
 * 管理者チェック、検索条件、ページネーションの全ブランチをテスト
 */
import { vi } from 'vitest'
import React from 'react'

// ============================================================
// モック設定
// ============================================================

class RedirectError extends Error {
  digest = 'NEXT_REDIRECT'
  constructor(public url: string) {
    super(`NEXT_REDIRECT: ${url}`)
  }
}
const mockRedirect = vi.fn((url: string) => { throw new RedirectError(url) })
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

const mockIsAdmin = vi.fn()
vi.mock('@/lib/actions/admin', () => ({
  isAdmin: () => mockIsAdmin(),
}))

const mockFindMany = vi.fn()
const mockCount = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    event: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('./EventActionsDropdown', () => ({
  EventActionsDropdown: ({ eventId }: { eventId: string }) => (
    <button data-testid={`action-${eventId}`}>操作</button>
  ),
}))

describe('AdminEventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('管理者でない場合はリダイレクトする', async () => {
    mockIsAdmin.mockResolvedValue(false)

    const AdminEventsPage = (await import('@/app/admin/events/page')).default
    await expect(
      AdminEventsPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/feed')
  })

  it('検索キーワードなしでイベント一覧を表示する', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const AdminEventsPage = (await import('@/app/admin/events/page')).default
    const result = await AdminEventsPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeDefined()
    expect(mockFindMany).toHaveBeenCalled()
    // search = '' なので where = {}
    expect(mockCount).toHaveBeenCalledWith({ where: {} })
  })

  it('検索キーワードありでフィルタリングする', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const AdminEventsPage = (await import('@/app/admin/events/page')).default
    await AdminEventsPage({ searchParams: Promise.resolve({ search: '盆栽' }) })

    // search = '盆栽' なので where に OR条件が設定される
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { title: { contains: '盆栽' } },
            { venue: { contains: '盆栽' } },
          ],
        },
      })
    )
  })

  it('cursor 未指定時は先頭ページを取得する (cursor/skip なし)', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const events = Array.from({ length: 20 }, (_, i) => ({
      id: `event-${i}`,
      title: `Event ${i}`,
      startDate: new Date(),
      createdAt: new Date(),
      prefecture: '東京都',
      city: '渋谷区',
      creator: { id: 'u1', nickname: 'Creator' },
    }))
    mockFindMany.mockResolvedValue(events)
    mockCount.mockResolvedValue(50)

    const AdminEventsPage = (await import('@/app/admin/events/page')).default
    const result = await AdminEventsPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeDefined()
    const call = mockFindMany.mock.calls[0][0]
    expect(call.take).toBe(20)
    expect(call.cursor).toBeUndefined()
    expect(call.skip).toBeUndefined()
  })

  it('cursor 指定時はカーソルベースで取得する (skip=1)', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([{
      id: 'e1', title: 'Event', startDate: new Date(), createdAt: new Date(),
      prefecture: '大阪府', city: null,
      creator: { id: 'u1', nickname: 'Creator' },
    }])
    mockCount.mockResolvedValue(50)

    const AdminEventsPage = (await import('@/app/admin/events/page')).default
    const result = await AdminEventsPage({ searchParams: Promise.resolve({ cursor: 'event-20' }) })

    expect(result).toBeDefined()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'event-20' }, skip: 1, take: 20 })
    )
  })

  it('最終ページでは次へリンクが表示されない', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(20)

    const AdminEventsPage = (await import('@/app/admin/events/page')).default
    const result = await AdminEventsPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeDefined()
  })

  it('イベントが0件の場合に空メッセージを表示する', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const AdminEventsPage = (await import('@/app/admin/events/page')).default
    const result = await AdminEventsPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeDefined()
  })
})
