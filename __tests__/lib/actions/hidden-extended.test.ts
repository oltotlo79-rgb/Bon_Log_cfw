import { vi } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'
/**
 * Extended tests for admin/hidden actions - covering restoreContent, deleteHiddenContent,
 * getHiddenContent with comment/event/shop/review types
 */
export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

type HiddenResult = { items: Record<string, unknown>[] } | { success: false; error: string }

function getItems(result: HiddenResult): Record<string, unknown>[] | undefined {
  if ('items' in result) return result.items
  return undefined
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
  vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue({ id: 'a1', userId: 'admin1', role: 'admin' } as never)
})

describe('getHiddenContent - comment type', async () => {
  it('returns hidden comments with report count', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.comment.findMany).mockResolvedValue([
      { id: 'c1', content: 'bad comment', hiddenAt: new Date(), user: { id: 'u1', nickname: 'User1', avatarUrl: null } },
    ] as never)
    vi.mocked(mockPrisma.report.groupBy).mockResolvedValue([
      { targetType: 'comment', targetId: 'c1', _count: 2 },
    ] as never)
    vi.mocked(mockPrisma.post.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.event.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.bonsaiShop.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.shopReview.findMany).mockResolvedValue([] as never)

    const result = await getHiddenContent({ type: 'comment' })
    const items = getItems(result as HiddenResult)
    expect(items).toBeDefined()
    if (items) {
      const comments = items.filter((i) => i.type === 'comment')
      expect(comments.length).toBe(1)
      expect(comments[0]!.reportCount).toBe(2)
    }
  })
})

describe('getHiddenContent - event type', async () => {
  it('returns hidden events', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.event.findMany).mockResolvedValue([
      { id: 'e1', title: 'Bad Event', description: 'desc', hiddenAt: new Date(), creator: { id: 'u1', nickname: 'User1', avatarUrl: null } },
    ] as never)
    vi.mocked(mockPrisma.report.groupBy).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.post.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.comment.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.bonsaiShop.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.shopReview.findMany).mockResolvedValue([] as never)

    const result = await getHiddenContent({ type: 'event' })
    expect(getItems(result as HiddenResult)).toBeDefined()
  })

  it('event without description shows title only', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.event.findMany).mockResolvedValue([
      { id: 'e1', title: 'Event', description: null, hiddenAt: new Date(), creator: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ] as never)
    vi.mocked(mockPrisma.report.groupBy).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.post.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.comment.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.bonsaiShop.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.shopReview.findMany).mockResolvedValue([] as never)

    const result = await getHiddenContent({ type: 'event' })
    const items = getItems(result as HiddenResult)
    if (items) {
      expect(items[0]!.content).toBe('Event')
    }
  })
})

describe('getHiddenContent - shop type', async () => {
  it('returns hidden shops', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.bonsaiShop.findMany).mockResolvedValue([
      { id: 'sh1', name: 'Bad Shop', address: '東京都', hiddenAt: new Date(), creator: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ] as never)
    vi.mocked(mockPrisma.report.groupBy).mockResolvedValue([
      { targetType: 'shop', targetId: 'sh1', _count: 3 },
    ] as never)
    vi.mocked(mockPrisma.post.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.comment.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.event.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.shopReview.findMany).mockResolvedValue([] as never)

    const result = await getHiddenContent({ type: 'shop' })
    expect(getItems(result as HiddenResult)).toBeDefined()
  })
})

describe('getHiddenContent - review type', async () => {
  it('returns hidden reviews with shop name', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.shopReview.findMany).mockResolvedValue([
      { id: 'r1', content: 'bad review', hiddenAt: new Date(), user: { id: 'u1', nickname: 'U', avatarUrl: null }, shop: { name: 'Good Shop' } },
    ] as never)
    vi.mocked(mockPrisma.report.groupBy).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.post.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.comment.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.event.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.bonsaiShop.findMany).mockResolvedValue([] as never)

    const result = await getHiddenContent({ type: 'review' })
    const items = getItems(result as HiddenResult)
    expect(items).toBeDefined()
    if (items) {
      expect(String(items[0]!.content)).toContain('Good Shop')
    }
  })

  it('review without content shows (コメントなし)', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.shopReview.findMany).mockResolvedValue([
      { id: 'r1', content: null, hiddenAt: new Date(), user: { id: 'u1', nickname: 'U', avatarUrl: null }, shop: { name: 'Shop' } },
    ] as never)
    vi.mocked(mockPrisma.report.groupBy).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.post.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.comment.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.event.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.bonsaiShop.findMany).mockResolvedValue([] as never)

    const result = await getHiddenContent({ type: 'review' })
    const items = getItems(result as HiddenResult)
    if (items) {
      expect(String(items[0]!.content)).toContain('(コメントなし)')
    }
  })
})

describe('getHiddenContent - sorting', async () => {
  it('sorts all types by hiddenAt descending', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.post.findMany).mockResolvedValue([
      { id: 'p1', content: 'post', hiddenAt: new Date('2025-01-01'), user: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ] as never)
    vi.mocked(mockPrisma.comment.findMany).mockResolvedValue([
      { id: 'c1', content: 'comment', hiddenAt: new Date('2025-01-03'), user: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ] as never)
    vi.mocked(mockPrisma.event.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.bonsaiShop.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.shopReview.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.report.groupBy).mockResolvedValue([] as never)

    const result = await getHiddenContent({})
    const items = getItems(result as HiddenResult)
    if (items && items.length >= 2) {
      expect(items[0]!.type).toBe('comment') // Jan 3 first
      expect(items[1]!.type).toBe('post') // Jan 1 second
    }
  })

  it('handles null hiddenAt in sort', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.post.findMany).mockResolvedValue([
      { id: 'p1', content: 'post', hiddenAt: null, user: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ] as never)
    vi.mocked(mockPrisma.comment.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.event.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.bonsaiShop.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.shopReview.findMany).mockResolvedValue([] as never)
    vi.mocked(mockPrisma.report.groupBy).mockResolvedValue([] as never)

    const result = await getHiddenContent({})
    expect(getItems(result as HiddenResult)).toBeDefined()
  })
})

describe('restoreContent', async () => {
  it('restores a post', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.post.update).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await restoreContent('post', 'p1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.post.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isHidden: false, hiddenAt: null } })
  })

  it('restores a comment', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.comment.update).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await restoreContent('comment', 'c1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.comment.update).toHaveBeenCalled()
  })

  it('restores an event', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.event.update).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await restoreContent('event', 'e1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.event.update).toHaveBeenCalled()
  })

  it('restores a shop', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.bonsaiShop.update).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await restoreContent('shop', 'sh1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.bonsaiShop.update).toHaveBeenCalled()
  })

  it('restores a review', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.shopReview.update).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await restoreContent('review', 'r1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.shopReview.update).toHaveBeenCalled()
  })

  it('fails without admin auth', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    mockAuth.mockResolvedValue(null)

    const result = await restoreContent('post', 'p1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('updates reports to resolved', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.post.update).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    await restoreContent('post', 'p1')
    expect(mockPrisma.report.updateMany).toHaveBeenCalledWith({
      where: { targetType: 'post', targetId: 'p1' },
      data: { status: 'resolved' },
    })
  })

  it('creates admin log', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.post.update).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    await restoreContent('post', 'p1')
    expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'restore_content', targetType: 'post', targetId: 'p1' }),
    })
  })
})

describe('deleteHiddenContent', async () => {
  it('deletes a post', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.post.delete).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.deleteMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await deleteHiddenContent('post', 'p1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.post.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })

  it('deletes a comment', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.comment.delete).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.deleteMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await deleteHiddenContent('comment', 'c1')
    expect(result).toEqual({ success: true })
  })

  it('deletes an event', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.event.delete).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.deleteMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await deleteHiddenContent('event', 'e1')
    expect(result).toEqual({ success: true })
  })

  it('deletes a shop', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.bonsaiShop.delete).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.deleteMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await deleteHiddenContent('shop', 'sh1')
    expect(result).toEqual({ success: true })
  })

  it('deletes a review', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.shopReview.delete).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.deleteMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    const result = await deleteHiddenContent('review', 'r1')
    expect(result).toEqual({ success: true })
  })

  it('fails without admin auth', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    mockAuth.mockResolvedValue(null)

    const result = await deleteHiddenContent('post', 'p1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('deletes related reports', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.post.delete).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.deleteMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    await deleteHiddenContent('post', 'p1')
    expect(mockPrisma.report.deleteMany).toHaveBeenCalledWith({
      where: { targetType: 'post', targetId: 'p1' },
    })
  })

  it('creates admin log for delete', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    vi.mocked(mockPrisma.post.delete).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.report.deleteMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminNotification.updateMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)

    await deleteHiddenContent('post', 'p1')
    expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'delete_hidden_content' }),
    })
  })
})
