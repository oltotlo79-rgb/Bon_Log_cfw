// @vitest-environment node
/**
 * lib/services/user-profile-write-service のユニットテスト
 *
 * updateUserProfile の部分更新・各フィールド上限・revalidatePath 呼び出しと、
 * isNicknameReserved の正常/予約語分岐を網羅する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockUserUpdate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))

// ──────────────────────────────────────────────────
// Mock: next/cache — revalidatePath の呼び出しを捕捉する
// ──────────────────────────────────────────────────
const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

// ──────────────────────────────────────────────────
// Mock: isPremiumUser
// ──────────────────────────────────────────────────
const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

// ──────────────────────────────────────────────────
// テストデータ
// ──────────────────────────────────────────────────
const USER_ID = 'user-profile-test-01'

const baseDbUser = {
  id: USER_ID,
  email: 'profile@example.com',
  nickname: '盆栽太郎',
  avatarUrl: '/uploads/avatar.jpg',
  headerUrl: null,
  bio: '盆栽が好きです',
  location: '東京',
  isPublic: true,
  bonsaiStartYear: 2020,
  bonsaiStartMonth: 4,
  birthDate: null,
  twoFactorEnabled: false,
}

describe('isNicknameReserved', () => {
  it('通常のニックネームは false を返す', async () => {
    const { isNicknameReserved } = await import('@/lib/services/user-profile-write-service')
    expect(isNicknameReserved('盆栽太郎')).toBe(false)
  })

  it('予約済みニックネーム (E2Eテストユーザー) は true を返す', async () => {
    const { isNicknameReserved } = await import('@/lib/services/user-profile-write-service')
    expect(isNicknameReserved('E2Eテストユーザー')).toBe(true)
  })

  it('予約済みニックネーム (E2E他ユーザー) は true を返す', async () => {
    const { isNicknameReserved } = await import('@/lib/services/user-profile-write-service')
    expect(isNicknameReserved('E2E他ユーザー')).toBe(true)
  })

  it('大文字小文字を無視して予約語を判定する', async () => {
    const { isNicknameReserved } = await import('@/lib/services/user-profile-write-service')
    expect(isNicknameReserved('e2e test user')).toBe(true)
  })

  it('前後の空白を無視して予約語を判定する', async () => {
    const { isNicknameReserved } = await import('@/lib/services/user-profile-write-service')
    expect(isNicknameReserved('  E2Eテストユーザー  ')).toBe(true)
  })

  it('空文字列は false を返す', async () => {
    const { isNicknameReserved } = await import('@/lib/services/user-profile-write-service')
    expect(isNicknameReserved('')).toBe(false)
  })
})

describe('updateUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserUpdate.mockResolvedValue(baseDbUser)
    mockIsPremiumUser.mockResolvedValue(false)
  })

  it('nickname のみ更新: 他フィールドが変わらないこと', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    const result = await updateUserProfile(USER_ID, { nickname: '新しい名前' })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown>; where: Record<string, unknown> } | undefined
    expect(updateCallArg).toBeDefined()
    expect(updateCallArg?.data).toHaveProperty('nickname', '新しい名前')
    expect(updateCallArg?.data).not.toHaveProperty('bio')
    expect(updateCallArg?.data).not.toHaveProperty('location')
    expect(updateCallArg?.where).toEqual({ id: USER_ID })
    expect(result.nickname).toBe('盆栽太郎') // DB モックの値を返す
  })

  it('bio のみ更新: 他フィールドが渡されないこと', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { bio: '新しい自己紹介' })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('bio', '新しい自己紹介')
    expect(updateCallArg?.data).not.toHaveProperty('nickname')
    expect(updateCallArg?.data).not.toHaveProperty('location')
  })

  it('bio を null で更新: null がそのまま渡されること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { bio: null })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('bio', null)
  })

  it('location のみ更新: location が渡されること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { location: '大阪' })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('location', '大阪')
    expect(updateCallArg?.data).not.toHaveProperty('nickname')
  })

  it('isPublic=false で更新: isPublic が false になること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { isPublic: false })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('isPublic', false)
  })

  it('avatarUrl を更新: avatarUrl が渡されること', async () => {
    const avatarUrl = '/uploads/avatars/new.jpg'
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { avatarUrl })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('avatarUrl', avatarUrl)
  })

  it('headerUrl を null で更新: null が渡されること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { headerUrl: null })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('headerUrl', null)
  })

  it('bonsaiStartYear を更新: 年が渡されること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { bonsaiStartYear: 2015 })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('bonsaiStartYear', 2015)
  })

  it('bonsaiStartMonth を更新: 月が渡されること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { bonsaiStartMonth: 6 })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('bonsaiStartMonth', 6)
  })

  it('birthDate を文字列で更新: Date オブジェクトに変換されること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { birthDate: '1990-05-15' })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data['birthDate']).toBeInstanceOf(Date)
  })

  it('birthDate を null で更新: null が渡されること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { birthDate: null })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('birthDate', null)
  })

  it('複数フィールドを同時に更新できること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, {
      nickname: '新ニック',
      bio: '新自己紹介',
      location: '京都',
    })

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(updateCallArg?.data).toHaveProperty('nickname', '新ニック')
    expect(updateCallArg?.data).toHaveProperty('bio', '新自己紹介')
    expect(updateCallArg?.data).toHaveProperty('location', '京都')
  })

  it('空オブジェクトを渡した場合: DB に何も渡されないこと', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, {})

    const updateCallArg = mockUserUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined
    expect(Object.keys(updateCallArg?.data ?? {})).toHaveLength(0)
  })

  it('更新後に revalidatePath が 2 回呼ばれること（ユーザーパス + 設定パス）', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    await updateUserProfile(USER_ID, { nickname: 'テスト' })

    expect(mockRevalidatePath).toHaveBeenCalledTimes(2)
    // ユーザーページパス
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/users/${USER_ID}`)
    // 設定ページパス
    expect(mockRevalidatePath).toHaveBeenCalledWith(expect.stringContaining('settings'))
  })

  it('非プレミアムユーザーで isPremium=false を返すこと', async () => {
    mockIsPremiumUser.mockResolvedValue(false)
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    const result = await updateUserProfile(USER_ID, {})

    expect(result.isPremium).toBe(false)
  })

  it('プレミアムユーザーで isPremium=true を返すこと', async () => {
    mockIsPremiumUser.mockResolvedValue(true)
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    const result = await updateUserProfile(USER_ID, {})

    expect(result.isPremium).toBe(true)
  })

  it('birthDate が null の場合 birthDate フィールドは null を返すこと', async () => {
    mockUserUpdate.mockResolvedValue({ ...baseDbUser, birthDate: null })
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    const result = await updateUserProfile(USER_ID, {})

    expect(result.birthDate).toBeNull()
  })

  it('birthDate が Date の場合 ISO 日付文字列 (YYYY-MM-DD) を返すこと', async () => {
    mockUserUpdate.mockResolvedValue({ ...baseDbUser, birthDate: new Date('1990-05-15T00:00:00Z') })
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    const result = await updateUserProfile(USER_ID, {})

    expect(result.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('結果に email が含まれること', async () => {
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    const result = await updateUserProfile(USER_ID, {})

    expect(result.email).toBe('profile@example.com')
  })

  it('twoFactorEnabled が true の場合、結果にも true が含まれること', async () => {
    mockUserUpdate.mockResolvedValue({ ...baseDbUser, twoFactorEnabled: true })
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    const result = await updateUserProfile(USER_ID, {})

    expect(result.twoFactorEnabled).toBe(true)
  })

  it('twoFactorEnabled が false の場合、結果にも false が含まれること', async () => {
    mockUserUpdate.mockResolvedValue({ ...baseDbUser, twoFactorEnabled: false })
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')
    const result = await updateUserProfile(USER_ID, {})

    expect(result.twoFactorEnabled).toBe(false)
  })

  it('prisma.user.update がエラーをスローした場合 updateUserProfile もスローすること', async () => {
    mockUserUpdate.mockRejectedValue(new Error('DB error'))
    const { updateUserProfile } = await import('@/lib/services/user-profile-write-service')

    await expect(updateUserProfile(USER_ID, { nickname: '失敗テスト' })).rejects.toThrow('DB error')
  })
})
