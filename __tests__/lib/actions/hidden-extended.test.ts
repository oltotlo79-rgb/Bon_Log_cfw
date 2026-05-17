import { vi } from 'vitest'
/**
 * Extended tests for admin/hidden actions - covering restoreContent, deleteHiddenContent,
 * getHiddenContent with comment/event/shop/review types
 */
 export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, Record<string, unknown>> = {
  user: { findUnique: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  post: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  comment: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  event: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  bonsaiShop: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  shopReview: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  report: { count: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), groupBy: vi.fn() },
  adminNotification: { updateMany: vi.fn() },
  adminLog: { create: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
  ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1', userId: 'admin1', role: 'admin' })
})

describe('getHiddenContent - comment type', async () => {
  it('returns hidden comments with report count', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', content: 'bad comment', hiddenAt: new Date(), user: { id: 'u1', nickname: 'User1', avatarUrl: null } },
    ])
    ;(mockPrisma.report.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { targetType: 'comment', targetId: 'c1', _count: 2 },
    ])
    // Mock other types to return empty
    ;(mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.shopReview.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await getHiddenContent({ type: 'comment' })
    expect(result.items).toBeDefined()
    if (result.items) {
      const comments = result.items.filter((i: Record<string, unknown>) => i.type === 'comment')
      expect(comments.length).toBe(1)
      expect(comments[0].reportCount).toBe(2)
    }
  })
})

describe('getHiddenContent - event type', async () => {
  it('returns hidden events', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'e1', title: 'Bad Event', description: 'desc', hiddenAt: new Date(), creator: { id: 'u1', nickname: 'User1', avatarUrl: null } },
    ])
    ;(mockPrisma.report.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.shopReview.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await getHiddenContent({ type: 'event' })
    expect(result.items).toBeDefined()
  })

  it('event without description shows title only', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'e1', title: 'Event', description: null, hiddenAt: new Date(), creator: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ])
    ;(mockPrisma.report.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.shopReview.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await getHiddenContent({ type: 'event' })
    if (result.items) {
      expect(result.items[0].content).toBe('Event')
    }
  })
})

describe('getHiddenContent - shop type', async () => {
  it('returns hidden shops', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'sh1', name: 'Bad Shop', address: '東京都', hiddenAt: new Date(), creator: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ])
    ;(mockPrisma.report.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { targetType: 'shop', targetId: 'sh1', _count: 3 },
    ])
    ;(mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.shopReview.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await getHiddenContent({ type: 'shop' })
    expect(result.items).toBeDefined()
  })
})

describe('getHiddenContent - review type', async () => {
  it('returns hidden reviews with shop name', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.shopReview.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'r1', content: 'bad review', hiddenAt: new Date(), user: { id: 'u1', nickname: 'U', avatarUrl: null }, shop: { name: 'Good Shop' } },
    ])
    ;(mockPrisma.report.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await getHiddenContent({ type: 'review' })
    expect(result.items).toBeDefined()
    if (result.items) {
      expect(result.items[0].content).toContain('Good Shop')
    }
  })

  it('review without content shows (コメントなし)', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.shopReview.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'r1', content: null, hiddenAt: new Date(), user: { id: 'u1', nickname: 'U', avatarUrl: null }, shop: { name: 'Shop' } },
    ])
    ;(mockPrisma.report.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await getHiddenContent({ type: 'review' })
    if (result.items) {
      expect(result.items[0].content).toContain('(コメントなし)')
    }
  })
})

describe('getHiddenContent - sorting', async () => {
  it('sorts all types by hiddenAt descending', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'p1', content: 'post', hiddenAt: new Date('2025-01-01'), user: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ])
    ;(mockPrisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'c1', content: 'comment', hiddenAt: new Date('2025-01-03'), user: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.shopReview.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.report.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await getHiddenContent({})
    if (result.items && result.items.length >= 2) {
      expect(result.items[0].type).toBe('comment') // Jan 3 first
      expect(result.items[1].type).toBe('post') // Jan 1 second
    }
  })

  it('handles null hiddenAt in sort', async () => {
    const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'p1', content: 'post', hiddenAt: null, user: { id: 'u1', nickname: 'U', avatarUrl: null } },
    ])
    ;(mockPrisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.shopReview.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.report.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await getHiddenContent({})
    expect(result.items).toBeDefined()
  })
})

describe('restoreContent', async () => {
  it('restores a post', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await restoreContent('post', 'p1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.post.update).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { isHidden: false, hiddenAt: null } })
  })

  it('restores a comment', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.comment.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await restoreContent('comment', 'c1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.comment.update).toHaveBeenCalled()
  })

  it('restores an event', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.event.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await restoreContent('event', 'e1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.event.update).toHaveBeenCalled()
  })

  it('restores a shop', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.bonsaiShop.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await restoreContent('shop', 'sh1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.bonsaiShop.update).toHaveBeenCalled()
  })

  it('restores a review', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.shopReview.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await restoreContent('review', 'r1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.shopReview.update).toHaveBeenCalled()
  })

  it('fails without admin auth', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    mockAuth.mockResolvedValue(null)

    const result = await restoreContent('post', 'p1')
    expect(result.error).toBeDefined()
  })

  it('updates reports to resolved', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    await restoreContent('post', 'p1')
    expect(mockPrisma.report.updateMany).toHaveBeenCalledWith({
      where: { targetType: 'post', targetId: 'p1' },
      data: { status: 'resolved' },
    })
  })

  it('creates admin log', async () => {
    const { restoreContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.post.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    await restoreContent('post', 'p1')
    expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'restore_content', targetType: 'post', targetId: 'p1' }),
    })
  })
})

describe('deleteHiddenContent', async () => {
  it('deletes a post', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.post.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await deleteHiddenContent('post', 'p1')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.post.delete).toHaveBeenCalledWith({ where: { id: 'p1' } })
  })

  it('deletes a comment', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.comment.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await deleteHiddenContent('comment', 'c1')
    expect(result).toEqual({ success: true })
  })

  it('deletes an event', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.event.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await deleteHiddenContent('event', 'e1')
    expect(result).toEqual({ success: true })
  })

  it('deletes a shop', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.bonsaiShop.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await deleteHiddenContent('shop', 'sh1')
    expect(result).toEqual({ success: true })
  })

  it('deletes a review', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.shopReview.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await deleteHiddenContent('review', 'r1')
    expect(result).toEqual({ success: true })
  })

  it('fails without admin auth', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    mockAuth.mockResolvedValue(null)

    const result = await deleteHiddenContent('post', 'p1')
    expect(result.error).toBeDefined()
  })

  it('deletes related reports', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.post.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    await deleteHiddenContent('post', 'p1')
    expect(mockPrisma.report.deleteMany).toHaveBeenCalledWith({
      where: { targetType: 'post', targetId: 'p1' },
    })
  })

  it('creates admin log for delete', async () => {
    const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
    ;(mockPrisma.post.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.report.deleteMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminNotification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    await deleteHiddenContent('post', 'p1')
    expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'delete_hidden_content' }),
    })
  })
})
