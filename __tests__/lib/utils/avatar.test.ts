// @vitest-environment node

import { getDefaultAvatarPath } from '@/lib/utils/avatar'

describe('getDefaultAvatarPath', () => {
  it('returns a valid avatar path for a typical user ID', () => {
    const path = getDefaultAvatarPath('user-abc-123')
    expect(path).toMatch(/^\/images\/generated\/avatars\/enso-avatar-[1-5]\.webp$/)
  })

  it('returns the same path for the same user ID (deterministic)', () => {
    const path1 = getDefaultAvatarPath('consistent-user-id')
    const path2 = getDefaultAvatarPath('consistent-user-id')
    expect(path1).toBe(path2)
  })

  it('returns an index between 1 and 5 for various user IDs', () => {
    const ids = [
      'cuid-abc123',
      'cuid-def456',
      'cuid-ghi789',
      'short',
      'a-very-long-user-id-that-is-much-longer-than-usual',
      '12345',
      'UPPERCASE-ID',
      'user_with_underscore',
    ]

    for (const id of ids) {
      const path = getDefaultAvatarPath(id)
      const match = path.match(/enso-avatar-(\d+)\.webp$/)
      expect(match).not.toBeNull()
      const index = parseInt(match![1], 10)
      expect(index).toBeGreaterThanOrEqual(1)
      expect(index).toBeLessThanOrEqual(5)
    }
  })

  it('produces different avatars for different user IDs (distribution check)', () => {
    const paths = new Set<string>()
    // With enough IDs we should get at least 2 distinct avatars
    for (let i = 0; i < 20; i++) {
      paths.add(getDefaultAvatarPath(`user-${i}`))
    }
    expect(paths.size).toBeGreaterThanOrEqual(2)
  })

  it('handles an empty string without throwing', () => {
    const path = getDefaultAvatarPath('')
    expect(path).toMatch(/^\/images\/generated\/avatars\/enso-avatar-[1-5]\.webp$/)
  })

  it('handles single-character IDs', () => {
    const path = getDefaultAvatarPath('x')
    expect(path).toMatch(/^\/images\/generated\/avatars\/enso-avatar-[1-5]\.webp$/)
  })

  it('handles IDs with special characters', () => {
    const path = getDefaultAvatarPath('user@#$%^&*()')
    expect(path).toMatch(/^\/images\/generated\/avatars\/enso-avatar-[1-5]\.webp$/)
  })

  it('handles IDs with unicode characters', () => {
    const path = getDefaultAvatarPath('ユーザー太郎')
    expect(path).toMatch(/^\/images\/generated\/avatars\/enso-avatar-[1-5]\.webp$/)
  })
})
