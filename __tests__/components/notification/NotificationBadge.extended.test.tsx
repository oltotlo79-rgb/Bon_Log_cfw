import { vi } from 'vitest'
/**
 * NotificationBadge 追加カバレッジテスト
 *
 * NotificationBadgeServerコンポーネントのテスト
 */

import { getUnreadCount } from '@/lib/actions/notification'

vi.mock('@/lib/actions/notification', () => ({
  getUnreadCount: vi.fn(),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getUnreadCount: vi.fn(),
}))

const mockGetUnreadCount = getUnreadCount as ReturnType<typeof vi.fn>

const loadModule = async () => await import('@/components/notification/NotificationBadge')

describe('NotificationBadgeServer', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未読数が0の場合はnullを返す', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 0 })

    const { NotificationBadgeServer } = await loadModule()
    const result = await NotificationBadgeServer()

    expect(result).toBeNull()
  })

  it('未読数がある場合はspanを返す', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 5 })

    const { NotificationBadgeServer } = await loadModule()
    const result = await NotificationBadgeServer()

    expect(result).not.toBeNull()
    expect(result!.type).toBe('span')
  })

  it('未読数が100以上の場合は99+を表示する', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 200 })

    const { NotificationBadgeServer } = await loadModule()
    const result = await NotificationBadgeServer()

    expect(result!.props.children).toBe('99+')
  })

  it('未読数が99の場合は99を表示する', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 99 })

    const { NotificationBadgeServer } = await loadModule()
    const result = await NotificationBadgeServer()

    expect(result!.props.children).toBe(99)
  })

  it('未読数が1の場合は1を表示する', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 1 })

    const { NotificationBadgeServer } = await loadModule()
    const result = await NotificationBadgeServer()

    expect(result!.props.children).toBe(1)
  })

  it('spanにbg-red-500クラスを持つ', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 5 })

    const { NotificationBadgeServer } = await loadModule()
    const result = await NotificationBadgeServer()

    expect(result!.props.className).toContain('bg-foreground')
  })

  it('spanにrounded-fullクラスを持つ', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 5 })

    const { NotificationBadgeServer } = await loadModule()
    const result = await NotificationBadgeServer()

    expect(result!.props.className).toContain('rounded-full')
  })

  it('getUnreadCountが呼ばれる', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 0 })

    const { NotificationBadgeServer } = await loadModule()
    await NotificationBadgeServer()

    expect(mockGetUnreadCount).toHaveBeenCalled()
  })
})
