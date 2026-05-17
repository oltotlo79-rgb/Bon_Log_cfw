// @vitest-environment node

import { vi } from 'vitest'
/**
 * ブランチカバレッジ向上テスト（パート2）- lib/actions/user.ts
 */

import { createMockPrismaClient } from '../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

describe('updateProfile ブランチカバレッジ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('bonsaiStartYearが空文字の場合nullになる', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    mockPrisma.user.update.mockResolvedValue({})

    const formData = new FormData()
    formData.set('nickname', 'テスト')
    formData.set('bio', '')
    formData.set('location', '')
    formData.set('bonsaiStartYear', '')
    formData.set('bonsaiStartMonth', '')
    formData.set('birthDate', '')

    const { updateProfile } = await import('@/lib/actions/user')
    await updateProfile(formData)

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bonsaiStartYear: null,
          bonsaiStartMonth: null,
          birthDate: null,
        }),
      })
    )
  })

  it('bonsaiStartYearがNaNの場合nullになる', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    mockPrisma.user.update.mockResolvedValue({})

    const formData = new FormData()
    formData.set('nickname', 'テスト')
    formData.set('bio', '')
    formData.set('location', '')
    formData.set('bonsaiStartYear', 'abc')
    formData.set('bonsaiStartMonth', 'xyz')
    formData.set('birthDate', '')

    const { updateProfile } = await import('@/lib/actions/user')
    await updateProfile(formData)

    // NaN値はnullに変換されることを確認
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bonsaiStartYear: null,
          bonsaiStartMonth: null,
        }),
      })
    )
  })

  it('bioとlocationが空文字の場合nullになる', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    mockPrisma.user.update.mockResolvedValue({})

    const formData = new FormData()
    formData.set('nickname', 'テスト')
    formData.set('bio', '')
    formData.set('location', '')
    formData.set('birthDate', '')

    const { updateProfile } = await import('@/lib/actions/user')
    await updateProfile(formData)

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bio: null,
          location: null,
        }),
      })
    )
  })

  it('birthDateが指定されている場合Dateに変換する', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' })
    mockPrisma.user.update.mockResolvedValue({})

    const formData = new FormData()
    formData.set('nickname', 'テスト')
    formData.set('bio', '自己紹介')
    formData.set('location', '東京')
    formData.set('bonsaiStartYear', '2020')
    formData.set('bonsaiStartMonth', '3')
    formData.set('birthDate', '1990-01-01')

    const { updateProfile } = await import('@/lib/actions/user')
    await updateProfile(formData)

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bio: '自己紹介',
          location: '東京',
          bonsaiStartYear: 2020,
          bonsaiStartMonth: 3,
          birthDate: expect.any(Date),
        }),
      })
    )
  })
})

describe('getFollowers ブランチカバレッジ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cursorなしで取得する', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([
      { follower: { id: 'user-2', nickname: 'User2', avatarUrl: null, bio: null } },
    ])

    const { getFollowers } = await import('@/lib/actions/follow')
    const result = await getFollowers('user-1')
    expect(result.users).toHaveLength(1)
    expect(result.users[0]).toEqual(
      expect.objectContaining({ id: 'user-2', nickname: 'User2' })
    )
  })

  it('cursorありで取得する', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([])

    const { getFollowers } = await import('@/lib/actions/follow')
    await getFollowers('user-1', 'cursor-user')

    expect(mockPrisma.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({
          followerId_followingId: {
            followerId: 'cursor-user',
            followingId: 'user-1',
          },
        }),
        skip: 1,
      })
    )
  })
})

describe('getFollowing ブランチカバレッジ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cursorなしで取得する', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([
      { following: { id: 'user-3', nickname: 'User3', avatarUrl: null, bio: null } },
    ])

    const { getFollowing } = await import('@/lib/actions/user')
    const result = await getFollowing('user-1')
    expect(result.following).toHaveLength(1)
    expect(result.following[0]).toEqual(
      expect.objectContaining({ id: 'user-3', nickname: 'User3' })
    )
  })

  it('cursorありで取得する', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([])

    const { getFollowing } = await import('@/lib/actions/user')
    await getFollowing('user-1', 'cursor-user')

    expect(mockPrisma.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: expect.objectContaining({
          followerId_followingId: {
            followerId: 'user-1',
            followingId: 'cursor-user',
          },
        }),
        skip: 1,
      })
    )
  })
})
