// @vitest-environment node
/**
 * lib/services/user-connections-service のユニットテスト
 *
 * fetchUserFollowers / fetchUserFollowing の正常系（0件/多件）、
 * Follow の複合キー (`followerId_followingId`) カーソルによるページ継続、
 * followers/following で固定側・可変側が入れ替わる非対称性、
 * 非公開/不存在/ゲスト対象ユーザーの reason 分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockFollowFindMany = vi.fn()
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    follow: {
      findMany: (...args: unknown[]) => mockFollowFindMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockCanViewAuthorContent = vi.fn()
const mockVisibleUserWhere = vi.fn()
vi.mock('@/lib/services/post-visibility', () => ({
  canViewAuthorContent: (...args: unknown[]) => mockCanViewAuthorContent(...args),
  visibleUserWhere: (...args: unknown[]) => mockVisibleUserWhere(...args),
}))

vi.mock('@/lib/actions/pagination', () => ({
  normalizeCursorPagination: (opts: { cursor?: string; limit?: number }) => ({
    cursor: opts.cursor,
    limit: opts.limit ?? 20,
  }),
}))

vi.mock('@/lib/prisma/shared-includes', () => ({
  USER_MINIMAL_WITH_BIO_SELECT: {
    id: true,
    nickname: true,
    avatarUrl: true,
    bio: true,
  },
}))

vi.mock('@/lib/constants/guest', () => ({
  GUEST_EMAIL: 'guest@example.com',
}))

const TARGET_USER_ID = 'user-target'
const VIEWER_ID = 'viewer-1'
const VISIBLE_USER_WHERE_STUB = { isPublic: true }

function makeFollowerRow(followerId: string, createdAt: Date) {
  return {
    followerId,
    followingId: TARGET_USER_ID,
    createdAt,
    follower: {
      id: followerId,
      nickname: `nick-${followerId}`,
      avatarUrl: null,
      bio: null,
      _count: { followers: 1, following: 2 },
    },
  }
}

function makeFollowingRow(followingId: string, createdAt: Date) {
  return {
    followerId: TARGET_USER_ID,
    followingId,
    createdAt,
    following: {
      id: followingId,
      nickname: `nick-${followingId}`,
      avatarUrl: null,
      bio: null,
      _count: { followers: 3, following: 4 },
    },
  }
}

describe('fetchUserFollowers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: false, email: 'target@example.com' })
    mockCanViewAuthorContent.mockResolvedValue(true)
    mockVisibleUserWhere.mockReturnValue(VISIBLE_USER_WHERE_STUB)
    mockFollowFindMany.mockResolvedValue([])
  })

  it('フォロワーが 0 件のとき items: [] / nextCursor: undefined を返す', async () => {
    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('フォロワーが多数件あるとき items に変換して返す', async () => {
    const rows = [
      makeFollowerRow('follower-1', new Date('2025-03-01T00:00:00Z')),
      makeFollowerRow('follower-2', new Date('2025-02-01T00:00:00Z')),
    ]
    mockFollowFindMany.mockResolvedValueOnce(rows)

    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      id: 'follower-1',
      nickname: 'nick-follower-1',
      followersCount: 1,
      followingCount: 2,
    })
  })

  it('followingId: targetUserId で where が絞られる（対象ユーザー固定）', async () => {
    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID)

    expect(mockFollowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ followingId: TARGET_USER_ID }),
      }),
    )
  })

  it('follower 側の可視性フィルタは visibleUserWhere(viewerId) に委譲される', async () => {
    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID)

    expect(mockVisibleUserWhere).toHaveBeenCalledWith(VIEWER_ID)
    expect(mockFollowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ follower: VISIBLE_USER_WHERE_STUB }),
      }),
    )
  })

  it('cursor 指定時、複合キー { followerId: cursor, followingId: targetUserId } で次頁を取得する', async () => {
    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID, 'prev-last-follower-id')

    expect(mockFollowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: {
          followerId_followingId: {
            followerId: 'prev-last-follower-id',
            followingId: TARGET_USER_ID,
          },
        },
        skip: 1,
      }),
    )
  })

  it('rows.length === limit のとき nextCursor が最後の行の followerId になる（ページ継続）', async () => {
    const rows = [
      makeFollowerRow('follower-a', new Date('2025-03-01T00:00:00Z')),
      makeFollowerRow('follower-b', new Date('2025-02-01T00:00:00Z')),
    ]
    mockFollowFindMany.mockResolvedValueOnce(rows)

    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID, undefined, 2)

    if (!result.ok) throw new Error('unreachable')
    expect(result.nextCursor).toBe('follower-b')
  })

  it('rows.length < limit のとき nextCursor は undefined（最終ページ）', async () => {
    mockFollowFindMany.mockResolvedValueOnce([makeFollowerRow('follower-a', new Date())])

    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID, undefined, 20)

    if (!result.ok) throw new Error('unreachable')
    expect(result.nextCursor).toBeUndefined()
  })

  it('2ページ目のカーソルが1ページ目の最終行と重複・欠落なく継続する', async () => {
    const page1 = [
      makeFollowerRow('follower-1', new Date('2025-03-03T00:00:00Z')),
      makeFollowerRow('follower-2', new Date('2025-03-02T00:00:00Z')),
    ]
    mockFollowFindMany.mockResolvedValueOnce(page1)

    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result1 = await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID, undefined, 2)
    if (!result1.ok) throw new Error('unreachable')
    expect(result1.nextCursor).toBe('follower-2')

    const page2 = [makeFollowerRow('follower-3', new Date('2025-03-01T00:00:00Z'))]
    mockFollowFindMany.mockResolvedValueOnce(page2)

    const result2 = await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID, result1.nextCursor, 2)
    if (!result2.ok) throw new Error('unreachable')

    // ページ間で id の重複がないこと（follower-2 が2ページ目に再出現しない）
    const allIds = [...result1.items.map((i) => i.id), ...result2.items.map((i) => i.id)]
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(mockFollowFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursor: {
          followerId_followingId: { followerId: 'follower-2', followingId: TARGET_USER_ID },
        },
        skip: 1,
      }),
    )
  })

  it('対象ユーザーが存在しない場合 reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers('no-such-user', VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(mockFollowFindMany).not.toHaveBeenCalled()
  })

  it('対象ユーザーがゲストアカウントの場合 reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'guest@example.com',
    })

    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('非公開アカウントかつ閲覧不可（他人）の場合 reason: private_account を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: false,
      isSuspended: false,
      email: 'private@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(false)

    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'private_account' })
  })

  it('停止ユーザーで canViewAuthorContent が false のとき reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: true,
      email: 'suspended@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(false)

    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('本人が自分のフォロワー一覧を見る場合は非公開でも閲覧可能', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: false,
      isSuspended: false,
      email: 'private@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(true)

    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers(TARGET_USER_ID, TARGET_USER_ID)

    expect(result.ok).toBe(true)
  })

  it('viewerId が undefined（ゲスト閲覧）でも公開アカウントなら閲覧できる', async () => {
    const { fetchUserFollowers } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowers(TARGET_USER_ID, undefined)

    expect(result.ok).toBe(true)
  })
})

describe('fetchUserFollowing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: false, email: 'target@example.com' })
    mockCanViewAuthorContent.mockResolvedValue(true)
    mockVisibleUserWhere.mockReturnValue(VISIBLE_USER_WHERE_STUB)
    mockFollowFindMany.mockResolvedValue([])
  })

  it('フォロー中が 0 件のとき items: [] / nextCursor: undefined を返す', async () => {
    const { fetchUserFollowing } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowing(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('フォロー中が多数件あるとき items に変換して返す', async () => {
    const rows = [
      makeFollowingRow('following-1', new Date('2025-03-01T00:00:00Z')),
      makeFollowingRow('following-2', new Date('2025-02-01T00:00:00Z')),
    ]
    mockFollowFindMany.mockResolvedValueOnce(rows)

    const { fetchUserFollowing } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowing(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      id: 'following-1',
      followersCount: 3,
      followingCount: 4,
    })
  })

  it('followerId: targetUserId で where が絞られる（対象ユーザー固定、followers とは対称に逆転）', async () => {
    const { fetchUserFollowing } = await import('@/lib/services/user-connections-service')
    await fetchUserFollowing(TARGET_USER_ID, VIEWER_ID)

    expect(mockFollowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ followerId: TARGET_USER_ID }),
      }),
    )
  })

  it('following 側の可視性フィルタは visibleUserWhere(viewerId) に委譲される', async () => {
    const { fetchUserFollowing } = await import('@/lib/services/user-connections-service')
    await fetchUserFollowing(TARGET_USER_ID, VIEWER_ID)

    expect(mockFollowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ following: VISIBLE_USER_WHERE_STUB }),
      }),
    )
  })

  it('cursor 指定時、複合キー { followerId: targetUserId, followingId: cursor }（followers と可変側が逆転）で次頁を取得する', async () => {
    const { fetchUserFollowing } = await import('@/lib/services/user-connections-service')
    await fetchUserFollowing(TARGET_USER_ID, VIEWER_ID, 'prev-last-following-id')

    expect(mockFollowFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: {
          followerId_followingId: {
            followerId: TARGET_USER_ID,
            followingId: 'prev-last-following-id',
          },
        },
        skip: 1,
      }),
    )
  })

  it('rows.length === limit のとき nextCursor が最後の行の followingId になる（ページ継続）', async () => {
    const rows = [
      makeFollowingRow('following-a', new Date('2025-03-01T00:00:00Z')),
      makeFollowingRow('following-b', new Date('2025-02-01T00:00:00Z')),
    ]
    mockFollowFindMany.mockResolvedValueOnce(rows)

    const { fetchUserFollowing } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowing(TARGET_USER_ID, VIEWER_ID, undefined, 2)

    if (!result.ok) throw new Error('unreachable')
    expect(result.nextCursor).toBe('following-b')
  })

  it('2ページ目のカーソルが1ページ目の最終行と重複・欠落なく継続する', async () => {
    const page1 = [
      makeFollowingRow('following-1', new Date('2025-03-03T00:00:00Z')),
      makeFollowingRow('following-2', new Date('2025-03-02T00:00:00Z')),
    ]
    mockFollowFindMany.mockResolvedValueOnce(page1)

    const { fetchUserFollowing } = await import('@/lib/services/user-connections-service')
    const result1 = await fetchUserFollowing(TARGET_USER_ID, VIEWER_ID, undefined, 2)
    if (!result1.ok) throw new Error('unreachable')
    expect(result1.nextCursor).toBe('following-2')

    const page2 = [makeFollowingRow('following-3', new Date('2025-03-01T00:00:00Z'))]
    mockFollowFindMany.mockResolvedValueOnce(page2)

    const result2 = await fetchUserFollowing(TARGET_USER_ID, VIEWER_ID, result1.nextCursor, 2)
    if (!result2.ok) throw new Error('unreachable')

    const allIds = [...result1.items.map((i) => i.id), ...result2.items.map((i) => i.id)]
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(mockFollowFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursor: {
          followerId_followingId: { followerId: TARGET_USER_ID, followingId: 'following-2' },
        },
        skip: 1,
      }),
    )
  })

  it('対象ユーザーが存在しない場合 reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { fetchUserFollowing } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowing('no-such-user', VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(mockFollowFindMany).not.toHaveBeenCalled()
  })

  it('非公開アカウントかつ閲覧不可（他人）の場合 reason: private_account を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: false,
      isSuspended: false,
      email: 'private@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(false)

    const { fetchUserFollowing } = await import('@/lib/services/user-connections-service')
    const result = await fetchUserFollowing(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'private_account' })
  })
})
