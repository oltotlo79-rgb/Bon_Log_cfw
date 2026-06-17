// @vitest-environment node
/**
 * lib/services/device-service のユニットテスト
 *
 * registerDevice / removeDevice の
 * 正常系・冪等性・他人トークン付け替え・自己限定削除を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockMobileDeviceUpsert = vi.fn()
const mockMobileDeviceDeleteMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    mobileDevice: {
      upsert: (...args: unknown[]) => mockMobileDeviceUpsert(...args),
      deleteMany: (...args: unknown[]) => mockMobileDeviceDeleteMany(...args),
    },
  },
}))

describe('registerDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMobileDeviceUpsert.mockResolvedValue({
      id: 'device-1',
      userId: 'user-1',
      token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      platform: 'ios',
    })
  })

  it('新規トークン登録で mobileDevice.upsert が正しい引数で呼ばれる', async () => {
    const { registerDevice } = await import('@/lib/services/device-service')
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'

    await registerDevice('user-1', token, 'ios')

    expect(mockMobileDeviceUpsert).toHaveBeenCalledOnce()
    expect(mockMobileDeviceUpsert).toHaveBeenCalledWith({
      where: { token },
      update: { userId: 'user-1', platform: 'ios' },
      create: { userId: 'user-1', token, platform: 'ios' },
    })
  })

  it('同じトークンを再登録しても upsert が1回呼ばれる（冪等）', async () => {
    const { registerDevice } = await import('@/lib/services/device-service')
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'

    await registerDevice('user-1', token, 'ios')

    expect(mockMobileDeviceUpsert).toHaveBeenCalledOnce()
  })

  it('別ユーザーが同一トークンを登録すると update の userId が新所有者に付け替わる', async () => {
    const { registerDevice } = await import('@/lib/services/device-service')
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'

    await registerDevice('user-new', token, 'android')

    expect(mockMobileDeviceUpsert).toHaveBeenCalledWith({
      where: { token },
      update: { userId: 'user-new', platform: 'android' },
      create: { userId: 'user-new', token, platform: 'android' },
    })
  })

  it('android プラットフォームを登録できる', async () => {
    const { registerDevice } = await import('@/lib/services/device-service')
    const token = 'fcm-token-android-xxxxx'

    await registerDevice('user-2', token, 'android')

    expect(mockMobileDeviceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ platform: 'android' }) }),
    )
  })

  it('void（undefined）を返す', async () => {
    const { registerDevice } = await import('@/lib/services/device-service')

    const result = await registerDevice('user-1', 'token-xyz', 'ios')

    expect(result).toBeUndefined()
  })
})

describe('removeDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMobileDeviceDeleteMany.mockResolvedValue({ count: 1 })
  })

  it('自分のトークンを削除すると mobileDevice.deleteMany が token + userId の複合条件で呼ばれる', async () => {
    const { removeDevice } = await import('@/lib/services/device-service')
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'

    await removeDevice('user-1', token)

    expect(mockMobileDeviceDeleteMany).toHaveBeenCalledOnce()
    expect(mockMobileDeviceDeleteMany).toHaveBeenCalledWith({
      where: { token, userId: 'user-1' },
    })
  })

  it('他人のトークンを指定しても成功する（deleteMany count: 0 だがエラーなし・冪等）', async () => {
    mockMobileDeviceDeleteMany.mockResolvedValueOnce({ count: 0 })
    const { removeDevice } = await import('@/lib/services/device-service')

    await expect(removeDevice('user-1', 'other-user-token')).resolves.toBeUndefined()
  })

  it('存在しないトークンを指定しても成功する（冪等・fail-safe）', async () => {
    mockMobileDeviceDeleteMany.mockResolvedValueOnce({ count: 0 })
    const { removeDevice } = await import('@/lib/services/device-service')

    await expect(removeDevice('user-1', 'nonexistent-token')).resolves.toBeUndefined()
  })

  it('deleteMany は userId 一致のレコードのみ対象にする（他ユーザーの行は削除しない）', async () => {
    const { removeDevice } = await import('@/lib/services/device-service')
    const token = 'shared-token'

    await removeDevice('user-a', token)

    const call = mockMobileDeviceDeleteMany.mock.calls[0]?.[0] as {
      where: { token: string; userId: string }
    }
    expect(call.where.userId).toBe('user-a')
    expect(call.where.token).toBe(token)
  })

  it('void（undefined）を返す', async () => {
    const { removeDevice } = await import('@/lib/services/device-service')

    const result = await removeDevice('user-1', 'token-xyz')

    expect(result).toBeUndefined()
  })
})
