// @vitest-environment node
/**
 * notification-preferences.ts の未カバーブランチを補完するテスト
 *
 * 対象:
 * - getNotificationPreferences: 認証失敗、ゲスト、ユーザー未発見、設定なし
 * - updateNotificationPreferences: Zodバリデーションエラー、認証失敗、ゲスト、正常更新
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.unmock('@/lib/actions/notification-preferences')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireActiveNonGuestUser = vi.fn()
const mockEnforceUserRateLimit = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  // notification-preferences.ts は requireActiveNonGuestUser を使う
  requireActiveNonGuestUser: (...args: unknown[]) => mockRequireActiveNonGuestUser(...args),
  actionSuccess: (data?: unknown) => ({ success: true, ...(data !== undefined ? { data } : {}) }),
  actionError: (error: string) => ({ success: false, error }),
  enforceUserRateLimit: (...args: unknown[]) => mockEnforceUserRateLimit(...args),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const importModule = () => import('@/lib/actions/notification-preferences')

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
  mockEnforceUserRateLimit.mockResolvedValue(null)
})

describe('getNotificationPreferences', () => {
  it('認証失敗時に空の設定を返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })

    const { getNotificationPreferences } = await importModule()
    const result = await getNotificationPreferences()

    expect(result).toEqual({ preferences: {} })
  })

  it('ゲストユーザーの場合に空の設定を返す', async () => {
    // 新仕様: requireActiveNonGuestUser がゲスト判定までまとめて返す
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: 'ゲストは利用不可' })

    const { getNotificationPreferences } = await importModule()
    const result = await getNotificationPreferences()

    expect(result).toEqual({ preferences: {} })
  })

  it('ユーザーが見つからない場合に空の設定を返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const { getNotificationPreferences } = await importModule()
    const result = await getNotificationPreferences()

    expect(result).toEqual({ preferences: {} })
  })

  it('設定がnullの場合に空オブジェクトを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ notificationPreferences: null })

    const { getNotificationPreferences } = await importModule()
    const result = await getNotificationPreferences()

    expect(result).toEqual({ preferences: {} })
  })

  it('保存された設定を返す', async () => {
    const prefs = { like: true, comment: false, follow: true }
    mockPrisma.user.findUnique.mockResolvedValue({ notificationPreferences: prefs })

    const { getNotificationPreferences } = await importModule()
    const result = await getNotificationPreferences()

    expect(result.preferences).toEqual(prefs)
  })
})

describe('updateNotificationPreferences', () => {
  it('不正な型でバリデーションエラーを返す', async () => {
    const { updateNotificationPreferences } = await importModule()
    // @ts-expect-error テスト用に不正な型を渡す
    const result = await updateNotificationPreferences({ like: 'not-boolean' })

    expect(result).toMatchObject({ success: false })
  })

  it('認証失敗時にエラーを返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })

    const { updateNotificationPreferences } = await importModule()
    const result = await updateNotificationPreferences({ like: true })

    expect(result).toMatchObject({ success: false })
  })

  it('ゲストユーザーの場合にエラーを返す', async () => {
    // 新仕様: requireActiveNonGuestUser がゲスト判定までまとめて返す
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: 'ゲストは利用不可' })

    const { updateNotificationPreferences } = await importModule()
    const result = await updateNotificationPreferences({ like: true })

    expect(result).toMatchObject({ success: false })
  })

  it('正常に設定を更新できる', async () => {
    mockPrisma.user.update.mockResolvedValue({})

    const { updateNotificationPreferences } = await importModule()
    const result = await updateNotificationPreferences({
      like: true,
      comment: false,
      reply: true,
    })

    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { notificationPreferences: { like: true, comment: false, reply: true } },
    })
  })

  it('未知のプロパティはstripされる', async () => {
    mockPrisma.user.update.mockResolvedValue({})

    const { updateNotificationPreferences } = await importModule()
    // @ts-expect-error テスト用に未知のプロパティを含める
    const result = await updateNotificationPreferences({ like: true, unknown_field: true })

    expect(result).toMatchObject({ success: true })
    // unknown_fieldはstripされてDBに渡されない
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { notificationPreferences: { like: true } },
      })
    )
  })
})
