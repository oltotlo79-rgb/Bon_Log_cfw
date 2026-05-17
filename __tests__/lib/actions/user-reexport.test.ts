// @vitest-environment node

import { vi } from 'vitest'

// lib/actions/user.ts が re-export するモジュールをモック
vi.mock('@/lib/actions/user-profile', () => ({
  getUser: vi.fn(),
  getCurrentUser: vi.fn(),
  updateProfile: vi.fn(),
  updatePrivacy: vi.fn(),
  getFollowing: vi.fn(),
  getFollowers: vi.fn(),
}))

vi.mock('@/lib/actions/user-media', () => ({
  uploadAvatar: vi.fn(),
  uploadHeader: vi.fn(),
}))

vi.mock('@/lib/actions/user-account', () => ({
  deleteAccount: vi.fn(),
  changePassword: vi.fn(),
  changeEmail: vi.fn(),
}))

describe('lib/actions/user.ts (re-export module)', () => {
  it('user-profile のエクスポートが利用可能', async () => {
    const userModule = await import('@/lib/actions/user')
    expect(userModule).toHaveProperty('getUser')
    expect(userModule).toHaveProperty('getCurrentUser')
    expect(userModule).toHaveProperty('updateProfile')
    expect(userModule).toHaveProperty('updatePrivacy')
  })

  it('user-media のエクスポートが利用可能', async () => {
    const userModule = await import('@/lib/actions/user')
    expect(userModule).toHaveProperty('uploadAvatar')
    expect(userModule).toHaveProperty('uploadHeader')
  })

  it('user-account のエクスポートが利用可能', async () => {
    const userModule = await import('@/lib/actions/user')
    expect(userModule).toHaveProperty('deleteAccount')
  })

  it('re-export された関数が正しいモジュールから来ている', async () => {
    const userModule = await import('@/lib/actions/user')
    const profileModule = await import('@/lib/actions/user-profile')
    const mediaModule = await import('@/lib/actions/user-media')
    const accountModule = await import('@/lib/actions/user-account')

    expect(userModule.getUser).toBe(profileModule.getUser)
    expect(userModule.uploadAvatar).toBe(mediaModule.uploadAvatar)
    expect(userModule.deleteAccount).toBe(accountModule.deleteAccount)
  })
})
