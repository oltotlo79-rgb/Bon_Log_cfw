// @vitest-environment node
/**
 * lib/services/mute-service のユニットテスト
 *
 * muteUserService / unmuteUserService / getMutedUsersService の
 * 正常系・冪等性・フォロー関係不変・エラー系を検証する。
 * ミュート時に follow.deleteMany が呼ばれないことを確認する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockMuteFindUnique = vi.fn()
const mockMuteCreate = vi.fn()
const mockMuteDelete = vi.fn()
const mockMuteFindMany = vi.fn()
const mockUserFindUnique = vi.fn()
const mockFollowDeleteMany = vi.fn()

const mockPrisma = {
  user: {
    findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
  },
  mute: {
    findUnique: (...args: unknown[]) => mockMuteFindUnique(...args),
    create: (...args: unknown[]) => mockMuteCreate(...args),
    delete: (...args: unknown[]) => mockMuteDelete(...args),
    findMany: (...args: unknown[]) => mockMuteFindMany(...args),
  },
  follow: {
    deleteMany: (...args: unknown[]) => mockFollowDeleteMany(...args),
  },
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

const MUTER = 'muter-id'
const MUTED = 'muted-id'

describe('muteUserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: MUTED })
    mockMuteFindUnique.mockResolvedValue(null)
    mockMuteCreate.mockResolvedValue({ muterId: MUTER, mutedId: MUTED })
    mockInvalidateUserRelationsCache.mockResolvedValue(undefined)
  })

  it('正常ミュート時に { ok: true } を返す', async () => {
    const { muteUserService } = await import('@/lib/services/mute-service')
    const result = await muteUserService(MUTER, MUTED)
    expect(result).toEqual({ ok: true })
  })

  it('自己ミュートで { ok: false, reason: "self" } を返す', async () => {
    const { muteUserService } = await import('@/lib/services/mute-service')
    const result = await muteUserService(MUTER, MUTER)
    expect(result).toEqual({ ok: false, reason: 'self' })
    expect(mockMuteCreate).not.toHaveBeenCalled()
  })

  it('対象ユーザーが存在しない場合 { ok: false, reason: "not_found" } を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)
    const { muteUserService } = await import('@/lib/services/mute-service')
    const result = await muteUserService(MUTER, MUTED)
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('対象ユーザーが停止中の場合 { ok: false, reason: "not_found" } を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)
    const { muteUserService } = await import('@/lib/services/mute-service')
    const result = await muteUserService(MUTER, 'suspended-user')
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('既ミュート済みの場合は mute.create なしで { ok: true } を返す（冪等）', async () => {
    mockMuteFindUnique.mockResolvedValueOnce({ muterId: MUTER })
    const { muteUserService } = await import('@/lib/services/mute-service')
    const result = await muteUserService(MUTER, MUTED)
    expect(result).toEqual({ ok: true })
    expect(mockMuteCreate).not.toHaveBeenCalled()
  })

  it('ミュート時に follow.deleteMany が呼ばれない（フォロー関係を変更しない）', async () => {
    const { muteUserService } = await import('@/lib/services/mute-service')
    await muteUserService(MUTER, MUTED)
    expect(mockFollowDeleteMany).not.toHaveBeenCalled()
  })

  it('ミュート成功後に invalidateUserRelationsCache が呼ばれる', async () => {
    const { muteUserService } = await import('@/lib/services/mute-service')
    await muteUserService(MUTER, MUTED)
    expect(mockInvalidateUserRelationsCache).toHaveBeenCalledWith(MUTER)
  })

  it('mute.create がエラーを投げた場合 { ok: false, reason: "error" } を返す', async () => {
    mockMuteCreate.mockRejectedValueOnce(new Error('DB error'))
    const { muteUserService } = await import('@/lib/services/mute-service')
    const result = await muteUserService(MUTER, MUTED)
    expect(result).toEqual({ ok: false, reason: 'error' })
  })
})

describe('unmuteUserService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMuteFindUnique.mockResolvedValue({ muterId: MUTER })
    mockMuteDelete.mockResolvedValue({ muterId: MUTER, mutedId: MUTED })
    mockInvalidateUserRelationsCache.mockResolvedValue(undefined)
  })

  it('正常ミュート解除時に { ok: true } を返す', async () => {
    const { unmuteUserService } = await import('@/lib/services/mute-service')
    const result = await unmuteUserService(MUTER, MUTED)
    expect(result).toEqual({ ok: true })
  })

  it('未ミュート時は mute.delete なしで { ok: true } を返す（冪等）', async () => {
    mockMuteFindUnique.mockResolvedValueOnce(null)
    const { unmuteUserService } = await import('@/lib/services/mute-service')
    const result = await unmuteUserService(MUTER, MUTED)
    expect(result).toEqual({ ok: true })
    expect(mockMuteDelete).not.toHaveBeenCalled()
  })

  it('ミュート解除後に invalidateUserRelationsCache が呼ばれる', async () => {
    const { unmuteUserService } = await import('@/lib/services/mute-service')
    await unmuteUserService(MUTER, MUTED)
    expect(mockInvalidateUserRelationsCache).toHaveBeenCalledWith(MUTER)
  })

  it('mute.delete がエラーを投げた場合 { ok: false, reason: "error" } を返す', async () => {
    mockMuteDelete.mockRejectedValueOnce(new Error('DB error'))
    const { unmuteUserService } = await import('@/lib/services/mute-service')
    const result = await unmuteUserService(MUTER, MUTED)
    expect(result).toEqual({ ok: false, reason: 'error' })
  })

  it('ミュート解除でフォロー関係は変更されない（follow.deleteMany が呼ばれない）', async () => {
    const { unmuteUserService } = await import('@/lib/services/mute-service')
    await unmuteUserService(MUTER, MUTED)
    expect(mockFollowDeleteMany).not.toHaveBeenCalled()
  })
})

describe('getMutedUsersService', () => {
  const mockMutes = [
    {
      mutedId: 'user-a',
      muted: { id: 'user-a', nickname: 'ユーザーA', avatarUrl: '/a.jpg', bio: null },
    },
    {
      mutedId: 'user-b',
      muted: { id: 'user-b', nickname: 'ユーザーB', avatarUrl: '/b.jpg', bio: '盆栽好き' },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockMuteFindMany.mockResolvedValue(mockMutes)
  })

  it('ミュート一覧を { items, nextCursor } 形式で返す', async () => {
    const { getMutedUsersService } = await import('@/lib/services/mute-service')
    const result = await getMutedUsersService(MUTER, 10)
    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('items に id / nickname / avatarUrl / bio が含まれる', async () => {
    const { getMutedUsersService } = await import('@/lib/services/mute-service')
    const result = await getMutedUsersService(MUTER, 10)
    expect(result.items[0]).toMatchObject({
      id: 'user-a',
      nickname: 'ユーザーA',
      avatarUrl: '/a.jpg',
      bio: null,
    })
  })

  it('limit 件取得時に nextCursor が最後の mutedId になる', async () => {
    const { getMutedUsersService } = await import('@/lib/services/mute-service')
    const result = await getMutedUsersService(MUTER, 2)
    expect(result.nextCursor).toBe('user-b')
  })

  it('limit 未満のとき nextCursor が null になる', async () => {
    const { getMutedUsersService } = await import('@/lib/services/mute-service')
    const result = await getMutedUsersService(MUTER, 5)
    expect(result.nextCursor).toBeNull()
  })

  it('cursor が指定された場合 findMany に渡される', async () => {
    mockMuteFindMany.mockResolvedValueOnce([])
    const { getMutedUsersService } = await import('@/lib/services/mute-service')
    await getMutedUsersService(MUTER, 10, 'cursor-id')
    expect(mockMuteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({ muterId_mutedId: expect.any(Object) }),
        skip: 1,
      }),
    )
  })

  it('ミュートがない場合は空配列と nextCursor: null', async () => {
    mockMuteFindMany.mockResolvedValueOnce([])
    const { getMutedUsersService } = await import('@/lib/services/mute-service')
    const result = await getMutedUsersService(MUTER, 10)
    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })
})
