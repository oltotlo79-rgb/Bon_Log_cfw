// @vitest-environment node
/**
 * block.ts の未カバーブランチを補完するテスト
 *
 * 対象:
 * - blockUser: バリデーション失敗、ゲストチェック、対象ユーザー不在、トランザクションエラー
 * - unblockUser: ゲストチェック、deleteエラー
 * - getBlockedUsers: ゲストチェック、カーソル付きページネーション、DBエラー
 * - isBlocked: 認証失敗、両方ブロック、片方のみブロック、DBエラー
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.unmock('@/lib/actions/block')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireActiveNonGuestUser = vi.fn()
const mockRequireAuth = vi.fn()
const mockRequireNotGuest = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  requireActiveNonGuestUser: (...args: unknown[]) => mockRequireActiveNonGuestUser(...args),
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireNotGuest: (...args: unknown[]) => mockRequireNotGuest(...args),
  actionSuccess: (data?: unknown) => ({ success: true, ...(data !== undefined ? { data } : {}) }),
  actionError: (error: string) => ({ success: false, error }),
  enforceUserRateLimit: vi.fn().mockResolvedValue(null),
  invalidateUserRelationsCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const importModule = () => import('@/lib/actions/block')

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
  mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
  mockRequireNotGuest.mockResolvedValue(null)
})

describe('blockUser', () => {
  it('空のIDでバリデーションエラーを返す', async () => {
    const { blockUser } = await importModule()
    const result = await blockUser('')

    expect(result).toMatchObject({ success: false })
  })

  it('認証失敗時にエラーを返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })

    const { blockUser } = await importModule()
    const result = await blockUser('target-user')

    expect(result).toMatchObject({ success: false })
  })

  it('ゲストユーザーの場合にエラーを返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: 'ゲストは利用不可' })

    const { blockUser } = await importModule()
    const result = await blockUser('target-user')

    expect(result).toMatchObject({ success: false })
  })

  it('自分自身をブロックしようとするとエラーを返す', async () => {
    const { blockUser } = await importModule()
    const result = await blockUser('user-1')

    expect(result).toMatchObject({ success: false })
  })

  it('対象ユーザーが存在しない場合にエラーを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const { blockUser } = await importModule()
    const result = await blockUser('nonexistent-user')

    expect(result).toMatchObject({ success: false })
  })

  it('正常にブロックできる', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user' })
    mockPrisma.$transaction.mockResolvedValue([{}, {}])

    const { blockUser } = await importModule()
    const result = await blockUser('target-user')

    expect(result).toMatchObject({ success: true })
  })

  it('トランザクションエラー時にERR_BLOCK_FAILEDを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user' })
    mockPrisma.$transaction.mockRejectedValue(new Error('DB error'))

    const { blockUser } = await importModule()
    const result = await blockUser('target-user')

    expect(result).toMatchObject({ success: false })
  })
})

describe('unblockUser', () => {
  it('認証失敗時にエラーを返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })

    const { unblockUser } = await importModule()
    const result = await unblockUser('target-user')

    expect(result).toMatchObject({ success: false })
  })

  it('ゲストユーザーの場合にエラーを返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: 'ゲストは利用不可' })

    const { unblockUser } = await importModule()
    const result = await unblockUser('target-user')

    expect(result).toMatchObject({ success: false })
  })

  it('正常にブロック解除できる', async () => {
    mockPrisma.block.delete.mockResolvedValue({})

    const { unblockUser } = await importModule()
    const result = await unblockUser('target-user')

    expect(result).toMatchObject({ success: true })
  })

  it('deleteエラー時にERR_UNBLOCK_FAILEDを返す', async () => {
    mockPrisma.block.delete.mockRejectedValue(new Error('DB error'))

    const { unblockUser } = await importModule()
    const result = await unblockUser('target-user')

    expect(result).toMatchObject({ success: false })
  })
})

describe('getBlockedUsers', () => {
  it('認証失敗時に空配列を返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

    const { getBlockedUsers } = await importModule()
    const result = await getBlockedUsers()

    expect(result).toEqual({ users: [] })
  })

  it('ゲストユーザーの場合に空配列を返す', async () => {
    mockRequireNotGuest.mockResolvedValue({ error: 'ゲストは利用不可' })

    const { getBlockedUsers } = await importModule()
    const result = await getBlockedUsers()

    expect(result).toEqual({ users: [] })
  })

  it('ブロックユーザー一覧を取得できる', async () => {
    mockPrisma.block.findMany.mockResolvedValue([
      { blockedId: 'u2', blocked: { id: 'u2', nickname: 'User2', avatarUrl: null, bio: null } },
    ])

    const { getBlockedUsers } = await importModule()
    const result = await getBlockedUsers()

    expect(result.users).toHaveLength(1)
    expect(result.nextCursor).toBeUndefined()
  })

  it('カーソル付きページネーションが動作する', async () => {
    mockPrisma.block.findMany.mockResolvedValue([])

    const { getBlockedUsers } = await importModule()
    const result = await getBlockedUsers('cursor-id', 10)

    expect(result.users).toHaveLength(0)
  })

  it('limitと同数の結果がある場合nextCursorを返す', async () => {
    const blocks = Array.from({ length: 20 }, (_, i) => ({
      blockedId: `u${i}`,
      blocked: { id: `u${i}`, nickname: `User${i}`, avatarUrl: null, bio: null },
    }))
    mockPrisma.block.findMany.mockResolvedValue(blocks)

    const { getBlockedUsers } = await importModule()
    const result = await getBlockedUsers(undefined, 20)

    expect(result.nextCursor).toBe('u19')
  })

  it('DBエラー時に空配列を返す', async () => {
    mockPrisma.block.findMany.mockRejectedValue(new Error('DB error'))

    const { getBlockedUsers } = await importModule()
    const result = await getBlockedUsers()

    expect(result).toEqual({ users: [] })
  })
})

describe('isBlocked', () => {
  it('認証失敗時に{ blocked: false, blockedBy: false }を返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

    const { isBlocked } = await importModule()
    const result = await isBlocked('target-user')

    expect(result).toEqual({ blocked: false, blockedBy: false })
  })

  it('双方向ブロック時に両方trueを返す', async () => {
    mockPrisma.block.findUnique
      .mockResolvedValueOnce({ id: 'b1' })  // 自分→相手
      .mockResolvedValueOnce({ id: 'b2' })  // 相手→自分

    const { isBlocked } = await importModule()
    const result = await isBlocked('target-user')

    expect(result).toEqual({ blocked: true, blockedBy: true })
  })

  it('自分のみブロックしている場合', async () => {
    mockPrisma.block.findUnique
      .mockResolvedValueOnce({ id: 'b1' })  // 自分→相手
      .mockResolvedValueOnce(null)           // 相手→自分

    const { isBlocked } = await importModule()
    const result = await isBlocked('target-user')

    expect(result).toEqual({ blocked: true, blockedBy: false })
  })

  it('相手にのみブロックされている場合', async () => {
    mockPrisma.block.findUnique
      .mockResolvedValueOnce(null)           // 自分→相手
      .mockResolvedValueOnce({ id: 'b1' })  // 相手→自分

    const { isBlocked } = await importModule()
    const result = await isBlocked('target-user')

    expect(result).toEqual({ blocked: false, blockedBy: true })
  })

  it('DBエラー時に{ blocked: false, blockedBy: false }を返す', async () => {
    mockPrisma.block.findUnique.mockRejectedValue(new Error('DB error'))

    const { isBlocked } = await importModule()
    const result = await isBlocked('target-user')

    expect(result).toEqual({ blocked: false, blockedBy: false })
  })
})
