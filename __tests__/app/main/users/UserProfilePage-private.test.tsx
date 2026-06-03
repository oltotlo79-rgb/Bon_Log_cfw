/**
 * UserProfilePage - isPrivateAndRestricted branch coverage (line 291)
 * + genres mapping in formattedPosts (line 417)
 */
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
  ProfileHeader: (props: Record<string, unknown>) => (
    <div
      data-testid="profile-header"
      data-is-owner={String(props.isOwner)}
      data-has-follow-request={String(props.hasFollowRequest)}
    />
  ),
}))
vi.mock('@/components/user/ProfileTabs', () => ({
  ProfileTabs: (props: { posts: Array<{ id: string; genres: unknown[] }>; comments: unknown[] }) => (
    <div data-testid="profile-tabs">
      {props.posts.map((p) => (
        <div key={p.id} data-testid={`post-${p.id}`} data-genres={JSON.stringify(p.genres)} />
      ))}
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

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockIsPremium = isPremiumUser as ReturnType<typeof vi.fn>
const mockGetFollowRequestStatus = getFollowRequestStatus as ReturnType<typeof vi.fn>

function makeUser(overrides = {}) {
  return {
    id: 'user-target',
    email: 'target@example.com',
    nickname: 'TargetUser',
    avatarUrl: null,
    headerUrl: null,
    bio: 'Private bio',
    location: 'Tokyo',
    bonsaiStartYear: 2020,
    bonsaiStartMonth: 4,
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

function makePostWithGenres(id: string) {
  return {
    id,
    userId: 'user-target',
    content: 'Test post with genres',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user-target', nickname: 'TargetUser', avatarUrl: null },
    media: [],
    genres: [
      { genre: { id: 'g1', name: '黒松', slug: 'kuromatsu' } },
      { genre: { id: 'g2', name: '真柏', slug: 'shinpaku' } },
    ],
    _count: { likes: 3, comments: 2 },
    quotePost: null,
    repostPost: null,
    quotePostId: null,
    repostPostId: null,
  }
}

describe('UserProfilePage - private account (line 291)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPremium.mockResolvedValue(false)
    mockGetFollowRequestStatus.mockResolvedValue({ hasRequest: false, status: null as unknown as string })
    ;(prisma.follow.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.block.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.mute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.like.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.bookmark.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  it('shows private account message when user is private and viewer is not following', async () => {
    // Logged-in user viewing a private account they do not follow
    mockAuth.mockResolvedValue({ user: { id: 'viewer-id' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ isPublic: false })
    )

    const { default: Page } = await import('@/app/(main)/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'user-target' }) })
    render(result)

    expect(screen.getByText('このアカウントは非公開です')).toBeInTheDocument()
    expect(screen.getByText('フォローリクエストが承認されると、投稿を閲覧できるようになります。')).toBeInTheDocument()
    // Should still show the profile header
    expect(screen.getByTestId('profile-header')).toBeInTheDocument()
    expect(screen.getByTestId('profile-header')).toHaveAttribute('data-is-owner', 'false')
  })

  it('shows private account message for logged-out viewer', async () => {
    mockAuth.mockResolvedValue(null as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ isPublic: false })
    )

    const { default: Page } = await import('@/app/(main)/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'user-target' }) })
    render(result)

    expect(screen.getByText('このアカウントは非公開です')).toBeInTheDocument()
  })

  it('shows full profile for private account when viewer is following', async () => {
    // Viewer is following the private user
    mockAuth.mockResolvedValue({ user: { id: 'viewer-id' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ isPublic: false })
    )
    ;(prisma.follow.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'follow-1' })
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const { default: Page } = await import('@/app/(main)/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'user-target' }) })
    render(await resolveAsyncJsx(result))

    // Should show the profile tabs, not the private notice
    expect(screen.queryByText('このアカウントは非公開です')).not.toBeInTheDocument()
    expect(screen.getByTestId('profile-tabs')).toBeInTheDocument()
  })

  it('shows full profile for private account owner', async () => {
    // Owner viewing their own private profile
    mockAuth.mockResolvedValue({ user: { id: 'user-target' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ isPublic: false })
    )
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const { default: Page } = await import('@/app/(main)/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'user-target' }) })
    render(await resolveAsyncJsx(result))

    expect(screen.queryByText('このアカウントは非公開です')).not.toBeInTheDocument()
    expect(screen.getByTestId('profile-tabs')).toBeInTheDocument()
  })
})

describe('UserProfilePage - genres mapping in formattedPosts (line 417)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPremium.mockResolvedValue(false)
    mockGetFollowRequestStatus.mockResolvedValue({ hasRequest: false, status: null as unknown as string })
    ;(prisma.follow.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.block.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.mute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.like.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.bookmark.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(prisma.comment.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
  })

  it('maps post genres from PostGenre[] to Genre[] for PostCard', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer-id' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser())
    ;(prisma.post.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([makePostWithGenres('p1')])
    ;(prisma.like.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ postId: 'p1' }])
    ;(prisma.bookmark.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const { default: Page } = await import('@/app/(main)/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'user-target' }) })
    render(await resolveAsyncJsx(result))

    const postEl = screen.getByTestId('post-p1')
    const genres = JSON.parse(postEl.getAttribute('data-genres') || '[]')
    // Genres should be flattened: [{id, name, slug}, ...] not [{genre: {...}}, ...]
    expect(genres).toEqual([
      { id: 'g1', name: '黒松', slug: 'kuromatsu' },
      { id: 'g2', name: '真柏', slug: 'shinpaku' },
    ])
  })

  it('sets hasFollowRequest=true when follow request is pending', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer-id' }, expires: '' } as never)
    ;(prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeUser({ isPublic: false })
    )
    mockGetFollowRequestStatus.mockResolvedValue({ hasRequest: true, status: 'pending' })

    const { default: Page } = await import('@/app/(main)/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'user-target' }) })
    render(result)

    expect(screen.getByTestId('profile-header')).toHaveAttribute('data-has-follow-request', 'true')
  })
})
