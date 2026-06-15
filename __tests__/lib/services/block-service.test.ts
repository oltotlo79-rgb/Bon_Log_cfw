// @vitest-environment node
/**
 * lib/services/block-service のユニットテスト
 *
 * blockUserService / unblockUserService / getBlockedUsersService の
 * 正常系・冪等性・フォロー解除・エラー系を検証する。
 * ブロック時に prisma.follow.deleteMany が呼ばれることを確認する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFollowDeleteMany = vi.fn()
const mockBlockFindUnique = vi.fn()
const mockBlockCreate = vi.fn()
const mockBlockDelete = vi.fn()
const mockBlockFindMany = vi.fn()
const mockUserFindUnique = vi.fn()
const mockTransaction = vi.fn()

const mockPrisma = {
  user: {
    findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
  },
  block: {
    findUnique: (...args: unknown[]) => mockBlockFindUnique(...args),
    create: (...args: unknown[]) => mockBlockCreate(...args),
    delete: (...args: unknown[]) => mockBlockDelete(...args),
    findMany: (...args: unknown[]) => mockBlockFindMany(...args),
  },
  follow: {
    deleteMany: (...args: unknown[]) => mockFollowDeleteMany(...args),
  },
  $transaction: (...args: unknown[]) => mockTransaction(...args),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockInvalidateUserRelationsCache = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  invalidateUserRelationsCache: (...args: unknown[]) => mockInvalidateUserRelationsCache(...args),
}))

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/prisma/shared-includes', () => ({
  USER_MINIMAL_WITH_BIO_SELECT: {
    id: true,
    nickname: true,
    avatarUrl: true,
    bio: true,
  },
}))

const BLOCKER = 'blocker-id'
const BLOCKED = 'blocked-id'

describe('blockUserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: BLOCKED })
    mockBlockFindUnique.mockResolvedValue(null)
    mockTransaction.mockImplementation(async (operations: unknown[]) => {
      for (const op of operations) {
        await op
      }
      return []
    })
    mockFollowDeleteMany.mockResolvedValue({ count: 0 })
    mockBlockCreate.mockResolvedValue({ blockerId: BLOCKER, blockedId: BLOCKED })
    mockInvalidateUserRelationsCache.mockResolvedValue(undefined)
  })

  it('正常ブロック時に { ok: true } を返す', async () => {
    const { blockUserService } = await import('@/lib/services/block-service')
    const result = await blockUserService(BLOCKER, BLOCKED)
    expect(result).toEqual({ ok: true })
  })

  it('ブロック時に $transaction が呼ばれる', async () => {
    const { blockUserService } = await import('@/lib/services/block-service')
    await blockUserService(BLOCKER, BLOCKED)
    expect(mockTransaction).toHaveBeenCalled()
  })

  it('ブロック時に follow.deleteMany が呼ばれフォロー関係が解除される', async () => {
    mockTransaction.mockImplementationOnce(async (operations: unknown[]) => {
      for (const op of operations) {
        await op
      }
      return []
    })
    const { blockUserService } = await import('@/lib/services/block-service')
    await blockUserService(BLOCKER, BLOCKED)
    expect(mockFollowDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: expect.arrayContaining([
            { followerId: BLOCKER, followingId: BLOCKED },
            { followerId: BLOCKED, followingId: BLOCKER },
          ]),
        },
      }),
    )
  })

  it('自己ブロックで { ok: false, reason: "self" } を返す', async () => {
    const { blockUserService } = await import('@/lib/services/block-service')
    const result = await blockUserService(BLOCKER, BLOCKER)
    expect(result).toEqual({ ok: false, reason: 'self' })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('対象ユーザーが存在しない場合 { ok: false, reason: "not_found" } を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)
    const { blockUserService } = await import('@/lib/services/block-service')
    const result = await blockUserService(BLOCKER, BLOCKED)
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('対象ユーザーが停止中の場合 { ok: false, reason: "not_found" } を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)
    const { blockUserService } = await import('@/lib/services/block-service')
    const result = await blockUserService(BLOCKER, 'suspended-user')
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('既ブロック済みの場合はトランザクションなしで { ok: true } を返す（冪等）', async () => {
    mockBlockFindUnique.mockResolvedValueOnce({ blockerId: BLOCKER })
    const { blockUserService } = await import('@/lib/services/block-service')
    const result = await blockUserService(BLOCKER, BLOCKED)
    expect(result).toEqual({ ok: true })
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('ブロック成功後に invalidateUserRelationsCache が呼ばれる', async () => {
    const { blockUserService } = await import('@/lib/services/block-service')
    await blockUserService(BLOCKER, BLOCKED)
    expect(mockInvalidateUserRelationsCache).toHaveBeenCalledWith(BLOCKER)
  })

  it('$transaction がエラーを投げた場合 { ok: false, reason: "error" } を返す', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('DB error'))
    const { blockUserService } = await import('@/lib/services/block-service')
    const result = await blockUserService(BLOCKER, BLOCKED)
    expect(result).toEqual({ ok: false, reason: 'error' })
  })
})

describe('unblockUserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBlockFindUnique.mockResolvedValue({ blockerId: BLOCKER })
    mockBlockDelete.mockResolvedValue({ blockerId: BLOCKER, blockedId: BLOCKED })
    mockInvalidateUserRelationsCache.mockResolvedValue(undefined)
  })

  it('正常ブロック解除時に { ok: true } を返す', async () => {
    const { unblockUserService } = await import('@/lib/services/block-service')
    const result = await unblockUserService(BLOCKER, BLOCKED)
    expect(result).toEqual({ ok: true })
  })

  it('未ブロック時はトランザクションなしで { ok: true } を返す（冪等）', async () => {
    mockBlockFindUnique.mockResolvedValueOnce(null)
    const { unblockUserService } = await import('@/lib/services/block-service')
    const result = await unblockUserService(BLOCKER, BLOCKED)
    expect(result).toEqual({ ok: true })
    expect(mockBlockDelete).not.toHaveBeenCalled()
  })

  it('ブロック解除後に invalidateUserRelationsCache が呼ばれる', async () => {
    const { unblockUserService } = await import('@/lib/services/block-service')
    await unblockUserService(BLOCKER, BLOCKED)
    expect(mockInvalidateUserRelationsCache).toHaveBeenCalledWith(BLOCKER)
  })

  it('block.delete がエラーを投げた場合 { ok: false, reason: "error" } を返す', async () => {
    mockBlockDelete.mockRejectedValueOnce(new Error('DB error'))
    const { unblockUserService } = await import('@/lib/services/block-service')
    const result = await unblockUserService(BLOCKER, BLOCKED)
    expect(result).toEqual({ ok: false, reason: 'error' })
  })

  it('ブロック解除でフォロー関係は復活しない（follow.deleteMany が呼ばれない）', async () => {
    const { unblockUserService } = await import('@/lib/services/block-service')
    await unblockUserService(BLOCKER, BLOCKED)
    expect(mockFollowDeleteMany).not.toHaveBeenCalled()
  })
})

describe('getBlockedUsersService', () => {
  const mockBlocks = [
    {
      blockedId: 'user-a',
      blocked: { id: 'user-a', nickname: 'ユーザーA', avatarUrl: '/a.jpg', bio: null },
    },
    {
      blockedId: 'user-b',
      blocked: { id: 'user-b', nickname: 'ユーザーB', avatarUrl: '/b.jpg', bio: '盆栽好き' },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockBlockFindMany.mockResolvedValue(mockBlocks)
  })

  it('ブロック一覧を { items, nextCursor } 形式で返す', async () => {
    const { getBlockedUsersService } = await import('@/lib/services/block-service')
    const result = await getBlockedUsersService(BLOCKER, 10)
    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('items に id / nickname / avatarUrl / bio が含まれる', async () => {
    const { getBlockedUsersService } = await import('@/lib/services/block-service')
    const result = await getBlockedUsersService(BLOCKER, 10)
    expect(result.items[0]).toMatchObject({
      id: 'user-a',
      nickname: 'ユーザーA',
      avatarUrl: '/a.jpg',
      bio: null,
    })
  })

  it('limit 件取得時に nextCursor が最後の blockedId になる', async () => {
    const { getBlockedUsersService } = await import('@/lib/services/block-service')
    const result = await getBlockedUsersService(BLOCKER, 2)
    expect(result.nextCursor).toBe('user-b')
  })

  it('limit 未満のとき nextCursor が null になる', async () => {
    const { getBlockedUsersService } = await import('@/lib/services/block-service')
    const result = await getBlockedUsersService(BLOCKER, 5)
    expect(result.nextCursor).toBeNull()
  })

  it('cursor が指定された場合 findMany に渡される', async () => {
    mockBlockFindMany.mockResolvedValueOnce([])
    const { getBlockedUsersService } = await import('@/lib/services/block-service')
    await getBlockedUsersService(BLOCKER, 10, 'cursor-id')
    expect(mockBlockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({ blockerId_blockedId: expect.any(Object) }),
        skip: 1,
      }),
    )
  })

  it('ブロックがない場合は空配列と nextCursor: null', async () => {
    mockBlockFindMany.mockResolvedValueOnce([])
    const { getBlockedUsersService } = await import('@/lib/services/block-service')
    const result = await getBlockedUsersService(BLOCKER, 10)
    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })
})
