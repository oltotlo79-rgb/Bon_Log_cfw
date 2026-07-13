// @vitest-environment node
/**
 * lib/services/bonsai-ownership のユニットテスト
 *
 * isOwnedBonsai は Web (lib/actions/post-validation.ts) と v1
 * (lib/services/post-write-service.ts) の両方から共有される IDOR 対策の
 * 中核ロジックのため、存在しない/他人所有/本人所有の 3 パターンを厳密に検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockBonsaiFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    bonsai: {
      findUnique: (...args: unknown[]) => mockBonsaiFindUnique(...args),
    },
  },
}))

const OWNER_ID = 'user-owner'
const OTHER_ID = 'user-other'
const BONSAI_ID = 'bonsai-1'

describe('isOwnedBonsai', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('本人所有の盆栽なら true を返す', async () => {
    mockBonsaiFindUnique.mockResolvedValue({ userId: OWNER_ID })
    const { isOwnedBonsai } = await import('@/lib/services/bonsai-ownership')

    const result = await isOwnedBonsai(BONSAI_ID, OWNER_ID)

    expect(result).toBe(true)
    expect(mockBonsaiFindUnique).toHaveBeenCalledWith({
      where: { id: BONSAI_ID },
      select: { userId: true },
    })
  })

  it('他人所有の盆栽なら false を返す（IDOR対策）', async () => {
    mockBonsaiFindUnique.mockResolvedValue({ userId: OTHER_ID })
    const { isOwnedBonsai } = await import('@/lib/services/bonsai-ownership')

    const result = await isOwnedBonsai(BONSAI_ID, OWNER_ID)

    expect(result).toBe(false)
  })

  it('存在しない盆栽なら false を返す（他人所有と区別せず秘匿する）', async () => {
    mockBonsaiFindUnique.mockResolvedValue(null)
    const { isOwnedBonsai } = await import('@/lib/services/bonsai-ownership')

    const result = await isOwnedBonsai('nonexistent-bonsai', OWNER_ID)

    expect(result).toBe(false)
  })
})
