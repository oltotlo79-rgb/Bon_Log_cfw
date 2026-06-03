import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

/**
 * Helper to render a page that contains async Server Components.
 */
async function resolveAsyncJsx(element: React.ReactElement): Promise<React.ReactElement> {
  if (!element || typeof element !== 'object') return element

  const { type, props } = element

  if (typeof type === 'function') {
    try {
      const result = (type as (props: Record<string, unknown>) => Promise<React.ReactElement>)(props)
      if (result && typeof result === 'object' && 'then' in result) {
        const resolved = await result
        return resolveAsyncJsx(resolved)
      }
      return resolveAsyncJsx(result as React.ReactElement)
    } catch {
      return element
    }
  }

  if (props?.children) {
    const children = Array.isArray(props.children)
      ? await Promise.all(props.children.map(async (child: React.ReactNode, i: number) => {
          if (!React.isValidElement(child)) return child
          const resolved = await resolveAsyncJsx(child)
          // cloneElement で静的 children を明示配列にすると React が key を要求するため、
          // key の無い要素には index ベースの key を補う (test 専用 render で reconcile しない)
          return React.isValidElement(resolved) && resolved.key == null
            ? React.cloneElement(resolved, { key: `__rk${i}` })
            : resolved
        }))
      : React.isValidElement(props.children)
        ? await resolveAsyncJsx(props.children)
        : props.children

    return React.cloneElement(element, { ...props, children })
  }

  return element
}

// Mocks
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    post: { findMany: vi.fn() },
    follow: { findUnique: vi.fn() },
    block: { findUnique: vi.fn() },
    mute: { findUnique: vi.fn() },
    like: { findMany: vi.fn() },
    bookmark: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn() }))
vi.mock('@/lib/actions/analytics', () => ({ recordProfileView: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/actions/follow-request', () => ({
  getFollowRequestStatus: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('@/components/user/ProfileHeader', () => ({
  ProfileHeader: (props: Record<string, unknown>) => <div data-testid="profile-header" data-is-owner={String(props.isOwner)} />,
}))
vi.mock('@/components/post/PostCard', () => ({
  PostCard: (props: Record<string, unknown>) => <div data-testid="post-card" data-post-id={(props.post as { id: string }).id} />,
}))
vi.mock('@/components/user/ProfileTabs', () => ({
  ProfileTabs: (props: { posts: Array<{ id: string }>; comments: unknown[]; currentUserId?: string }) => (
    <div data-testid="profile-tabs">
      {props.posts.length === 0 ? (
        <p>まだ投稿がありません</p>
      ) : (
        props.posts.map((p) => (
          <div key={p.id} data-testid="post-card" data-post-id={p.id} />
        ))
      )}
      <span data-testid="tab-label">投稿</span>
    </div>
  ),
}))
vi.mock('@/components/seo/JsonLd', () => ({
  PersonJsonLd: () => <div data-testid="person-jsonld" />,
}))
vi.mock('@/components/common/Breadcrumb', () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isPremiumUser } from '@/lib/premium'
import { getFollowRequestStatus } from '@/lib/actions/follow-request'
import { notFound } from 'next/navigation'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockIsPremium = isPremiumUser as ReturnType<typeof vi.fn>
const mockGetFollowRequestStatus = getFollowRequestStatus as ReturnType<typeof vi.fn>

function makeUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'test@example.com',
    nickname: 'TestUser',
    avatarUrl: null,
    headerUrl: null,
    bio: 'Hello',
    location: null,
    bonsaiStartYear: null,
    bonsaiStartMonth: null,
    birthDate: null,
    isPublic: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    password: null,
    emailVerified: null,
    _count: { posts: 5, followers: 10, following: 3 },
    ...overrides,
  }
}

function makePost(id: string) {
  return {
    id,
    userId: 'user-1',
    content: 'Test post',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user-1', nickname: 'TestUser', avatarUrl: null },
    media: [],
    genres: [],
    _count: { likes: 2, comments: 1 },
    quotePost: null,
    repostPost: null,
    quotePostId: null,
    repostPostId: null,
  }
}

describe('UserProfilePage', async () => {
  let Page: typeof import('@/app/(main)/users/[id]/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    mockIsPremium.mockResolvedValue(false)
    mockGetFollowRequestStatus.mockResolvedValue({ hasRequest: false, status: null as unknown as string })
    ;(prisma.follow.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.block.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.mute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.like.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.bookmark.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const mod = await import('@/app/(main)/users/[id]/page')
    Page = mod.default
  }, 20000)

  it('renders profile for logged-out user viewing existing profile', async () => {
    mockAuth.mockResolvedValue(null as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser())
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makePost('p1')])

    const result = await Page({ params: Promise.resolve({ id: 'user-1' }) })
    render(await resolveAsyncJsx(result))

    expect(screen.getByTestId('profile-header')).toBeInTheDocument()
    expect(screen.getByTestId('post-card')).toBeInTheDocument()
    expect(screen.getByText('投稿')).toBeInTheDocument()
  }, 20000)

  it('calls notFound when user does not exist', async () => {
    mockAuth.mockResolvedValue(null as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(
      Page({ params: Promise.resolve({ id: 'nonexistent' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('停止ユーザーのプロフィールは本人以外に notFound を返す', async () => {
    mockAuth.mockResolvedValue(null as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser({ isSuspended: true }))

    await expect(
      Page({ params: Promise.resolve({ id: 'user-1' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('プロフィールの最近の投稿クエリは isHidden:false で非表示投稿を除外する', async () => {
    mockAuth.mockResolvedValue(null as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser())
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    await resolveAsyncJsx(await Page({ params: Promise.resolve({ id: 'user-1' }) }))

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isHidden: false }) })
    )
  })

  it('shows blocked message when user is blocked', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser())
    ;(prisma.block.findUnique as ReturnType<typeof vi.fn>).mockImplementation(({ where }: { where: { blockerId_blockedId: { blockerId: string } } }) => {
      if (where.blockerId_blockedId.blockerId === 'me') return { id: 'block-1' }
      return null
    })
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await Page({ params: Promise.resolve({ id: 'user-1' }) })
    render(result)

    expect(screen.getByText('このユーザーをブロックしています')).toBeInTheDocument()
  })

  it('shows blocked-by message when blocked by the user', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser())
    ;(prisma.block.findUnique as ReturnType<typeof vi.fn>).mockImplementation(({ where }: { where: { blockerId_blockedId: { blockerId: string } } }) => {
      if (where.blockerId_blockedId.blockerId === 'user-1') return { id: 'block-2' }
      return null
    })
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await Page({ params: Promise.resolve({ id: 'user-1' }) })
    render(result)

    expect(screen.getByText('このユーザーからブロックされています')).toBeInTheDocument()
  })

  it('shows empty message when user has no posts', async () => {
    mockAuth.mockResolvedValue(null as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser())
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await Page({ params: Promise.resolve({ id: 'user-1' }) })
    render(await resolveAsyncJsx(result))

    expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument()
  })

  it('marks isOwner=true when viewing own profile', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser())
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await Page({ params: Promise.resolve({ id: 'user-1' }) })
    render(await resolveAsyncJsx(result))

    expect(screen.getByTestId('profile-header')).toHaveAttribute('data-is-owner', 'true')
  })

  it('fetches likes and bookmarks for logged-in user with posts', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser({ id: 'other' }))
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makePost('p1')])
    ;(prisma.like.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ postId: 'p1' }])
    ;(prisma.bookmark.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ postId: 'p1' }])

    const result = await Page({ params: Promise.resolve({ id: 'other' }) })
    render(await resolveAsyncJsx(result))

    expect(prisma.like.findMany).toHaveBeenCalled()
    expect(prisma.bookmark.findMany).toHaveBeenCalled()
  })

  it('コメント一覧は対象投稿の可視性で絞り込む（M-2）', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser({ id: 'other' }))
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = await Page({ params: Promise.resolve({ id: 'other' }) })
    render(await resolveAsyncJsx(result))

    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'other',
          deletedAt: null,
          isHidden: false,
          post: { isHidden: false, user: { isSuspended: false, OR: [{ isPublic: true }, { id: 'me' }, { followers: { some: { followerId: 'me' } } }] } },
        }),
      }),
    )
  })
})

describe('generateMetadata', async () => {
  let generateMetadata: typeof import('@/app/(main)/users/[id]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/users/[id]/page')
    generateMetadata = mod.generateMetadata
  })

  it('returns user metadata when user exists', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      nickname: 'TestUser',
      bio: 'My bio',
      avatarUrl: '/avatar.jpg',
      isPublic: true,
    })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'user-1' }) })
    expect(result.title).toBe('TestUserさんのプロフィール | BON-LOG')
  })

  it('returns fallback when user not found', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'none' }) })
    expect(result.title).toBe('ユーザーが見つかりません')
  })

  it('公開アカウントは robots を設定しない (ルートレイアウト継承)', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      nickname: 'PublicUser',
      bio: null,
      avatarUrl: null,
      isPublic: true,
    })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'user-public' }) })
    expect(result.robots).toBeUndefined()
  })

  it('非公開アカウントは noindex / nofollow を返す', async () => {
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      nickname: 'PrivateUser',
      bio: null,
      avatarUrl: null,
      isPublic: false,
    })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'user-private' }) })
    expect(result.robots).toEqual({ index: false, follow: false })
  })
})
