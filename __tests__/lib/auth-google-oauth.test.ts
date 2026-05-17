import { vi, describe, it, expect, beforeEach } from 'vitest'

/**
 * Google OAuth createUser イベントロジックのテスト
 *
 * auth.ts の events.createUser は、OAuthプロバイダー経由で
 * 初回ログインしたユーザーの nickname と emailVerified を設定する。
 * NextAuth の初期化とは独立してロジックをテストする。
 */

const mockUpdate = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    adminUser: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}))

/**
 * auth.ts の events.createUser と同じロジックを再現してテストする。
 * モジュール初期化の副作用を避けるために、ロジックを直接テストする。
 */
async function createUserHandler(user: { id?: string; name?: string | null }) {
  const { prisma } = await import('@/lib/db')
  if (user.id && user.name) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        nickname: user.name,
        emailVerified: new Date(),
      },
    })
  }
}

describe('Google OAuth createUser event', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('nameがある場合にnicknameとemailVerifiedを設定する', async () => {
    await createUserHandler({ id: 'user-google-1', name: 'Google User' })

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'user-google-1' },
      data: {
        nickname: 'Google User',
        emailVerified: expect.any(Date),
      },
    })
  })

  it('nameがnullの場合はupdateを呼ばない', async () => {
    await createUserHandler({ id: 'user-google-2', name: null })

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('nameがundefinedの場合はupdateを呼ばない', async () => {
    await createUserHandler({ id: 'user-google-3' })

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('idがない場合はupdateを呼ばない', async () => {
    await createUserHandler({ name: 'No ID User' })

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('idとnameの両方がある場合のみupdateを呼ぶ', async () => {
    await createUserHandler({ id: 'user-1', name: 'Test' })
    expect(mockUpdate).toHaveBeenCalledTimes(1)

    mockUpdate.mockClear()
    await createUserHandler({ id: '', name: 'Empty ID' })
    expect(mockUpdate).not.toHaveBeenCalled()

    await createUserHandler({ id: 'user-2', name: '' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
