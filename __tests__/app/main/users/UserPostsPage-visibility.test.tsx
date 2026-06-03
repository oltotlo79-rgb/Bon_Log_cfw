// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    post: { findMany: vi.fn() },
    follow: { findUnique: vi.fn() },
  },
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockUserFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>
const mockPostFindMany = prisma.post.findMany as ReturnType<typeof vi.fn>
const mockFollowFindUnique = prisma.follow.findUnique as ReturnType<typeof vi.fn>

async function renderPage(viewerId: string | null) {
  mockAuth.mockResolvedValue(viewerId ? { user: { id: viewerId } } : null)
  const { default: Page } = await import('@/app/(main)/users/[id]/posts/page')
  return Page({ params: Promise.resolve({ id: 'author-id' }) })
}

describe('UserPostsPage - visibility guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFollowFindUnique.mockResolvedValue(null)
    mockPostFindMany.mockResolvedValue([])
  })

  it('非公開アカウントを非フォロワーが開くと notFound', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'author-id', nickname: 'A', isPublic: false, isSuspended: false })
    await expect(renderPage('viewer-id')).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
    expect(mockPostFindMany).not.toHaveBeenCalled()
  })

  it('停止アカウントを本人以外が開くと notFound', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'author-id', nickname: 'A', isPublic: true, isSuspended: true })
    await expect(renderPage('viewer-id')).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('存在しないユーザーは notFound', async () => {
    mockUserFindUnique.mockResolvedValue(null)
    await expect(renderPage('viewer-id')).rejects.toThrow('NOT_FOUND')
  })

  it('本人は非公開でも閲覧できる', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'author-id', nickname: 'A', isPublic: false, isSuspended: false })
    await expect(renderPage('author-id')).resolves.toBeDefined()
    expect(notFound).not.toHaveBeenCalled()
    expect(mockPostFindMany).toHaveBeenCalled()
  })

  it('フォロワーは非公開アカウントを閲覧できる', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'author-id', nickname: 'A', isPublic: false, isSuspended: false })
    mockFollowFindUnique.mockResolvedValue({ followerId: 'viewer-id' })
    await expect(renderPage('viewer-id')).resolves.toBeDefined()
    expect(notFound).not.toHaveBeenCalled()
  })

  it('公開アカウントは未ログインでも閲覧できる', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'author-id', nickname: 'A', isPublic: true, isSuspended: false })
    await expect(renderPage(null)).resolves.toBeDefined()
    expect(notFound).not.toHaveBeenCalled()
  })
})
