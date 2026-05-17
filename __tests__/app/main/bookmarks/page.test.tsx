// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({ redirect: (...args: unknown[]) => mockRedirect(...args) }))

const mockGetBookmarkedPosts = vi.fn()
vi.mock('@/lib/actions/bookmark', () => ({
  getBookmarkedPosts: () => mockGetBookmarkedPosts(),
}))

vi.mock('@/app/(main)/bookmarks/BookmarkPostList', () => ({
  BookmarkPostList: () => <div data-testid="bookmark-list" />,
}))

describe('BookmarksPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('未認証の場合、エラーが発生する（proxyで認証済みが前提）', async () => {
    mockAuth.mockResolvedValueOnce(null)
    mockGetBookmarkedPosts.mockResolvedValueOnce({ posts: [], nextCursor: undefined })

    const { default: BookmarksPage } = await import('@/app/(main)/bookmarks/page')

    // session is null so accessing session!.user.id throws
    await expect(BookmarksPage()).rejects.toThrow()
  })

  it('認証済みの場合、ブックマーク投稿を取得する', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
    mockGetBookmarkedPosts.mockResolvedValueOnce({ posts: [], nextCursor: undefined })

    const { default: BookmarksPage } = await import('@/app/(main)/bookmarks/page')

    const result = await BookmarksPage()
    expect(result).toBeTruthy()
    expect(mockGetBookmarkedPosts).toHaveBeenCalled()
  })
})
