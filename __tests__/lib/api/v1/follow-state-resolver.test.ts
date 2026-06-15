// @vitest-environment node
/**
 * lib/api/v1/follow-state-resolver のユニットテスト
 *
 * resolveBlockMuteStateForOne の正常系・自己参照・エラー時フォールバックを検証する。
 * resolveFollowStates / resolveFollowStateForOne は既存テストで間接的に検証済み。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFollowFindMany = vi.fn()
const mockFollowRequestFindMany = vi.fn()
const mockBlockFindUnique = vi.fn()
const mockMuteFindUnique = vi.fn()
const mockUserFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    follow: {
      findMany: (...args: unknown[]) => mockFollowFindMany(...args),
    },
    followRequest: {
      findMany: (...args: unknown[]) => mockFollowRequestFindMany(...args),
    },
    block: {
      findUnique: (...args: unknown[]) => mockBlockFindUnique(...args),
    },
    mute: {
      findUnique: (...args: unknown[]) => mockMuteFindUnique(...args),
    },
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
    },
  },
}))

vi.mock('@/lib/constants/status', () => ({
  FOLLOW_REQUEST_STATUS: { PENDING: 'pending' },
}))

const VIEWER = 'viewer-id'
const TARGET = 'target-id'

describe('resolveBlockMuteStateForOne', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBlockFindUnique.mockResolvedValue(null)
    mockMuteFindUnique.mockResolvedValue(null)
    mockFollowFindMany.mockResolvedValue([])
    mockFollowRequestFindMany.mockResolvedValue([])
  })

  it('未ブロック・未ミュート時は { isBlocked: false, isMuted: false } を返す', async () => {
    mockBlockFindUnique.mockResolvedValueOnce(null)
    mockMuteFindUnique.mockResolvedValueOnce(null)
    const { resolveBlockMuteStateForOne } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStateForOne(VIEWER, TARGET)
    expect(result).toEqual({ isBlocked: false, isMuted: false })
  })

  it('ブロック済み時は { isBlocked: true, isMuted: false } を返す', async () => {
    mockBlockFindUnique.mockResolvedValueOnce({ blockerId: VIEWER })
    mockMuteFindUnique.mockResolvedValueOnce(null)
    const { resolveBlockMuteStateForOne } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStateForOne(VIEWER, TARGET)
    expect(result).toEqual({ isBlocked: true, isMuted: false })
  })

  it('ミュート済み時は { isBlocked: false, isMuted: true } を返す', async () => {
    mockBlockFindUnique.mockResolvedValueOnce(null)
    mockMuteFindUnique.mockResolvedValueOnce({ muterId: VIEWER })
    const { resolveBlockMuteStateForOne } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStateForOne(VIEWER, TARGET)
    expect(result).toEqual({ isBlocked: false, isMuted: true })
  })

  it('ブロックかつミュート時は { isBlocked: true, isMuted: true } を返す', async () => {
    mockBlockFindUnique.mockResolvedValueOnce({ blockerId: VIEWER })
    mockMuteFindUnique.mockResolvedValueOnce({ muterId: VIEWER })
    const { resolveBlockMuteStateForOne } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStateForOne(VIEWER, TARGET)
    expect(result).toEqual({ isBlocked: true, isMuted: true })
  })

  it('自分自身（viewerId === targetId）は { isBlocked: false, isMuted: false } を返す（DB クエリなし）', async () => {
    const { resolveBlockMuteStateForOne } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStateForOne(VIEWER, VIEWER)
    expect(result).toEqual({ isBlocked: false, isMuted: false })
    expect(mockBlockFindUnique).not.toHaveBeenCalled()
    expect(mockMuteFindUnique).not.toHaveBeenCalled()
  })

  it('DB クエリがエラーを投げた場合 { isBlocked: false, isMuted: false } にフォールバックする', async () => {
    mockBlockFindUnique.mockRejectedValueOnce(new Error('DB error'))
    const { resolveBlockMuteStateForOne } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStateForOne(VIEWER, TARGET)
    expect(result).toEqual({ isBlocked: false, isMuted: false })
  })

  it('block と mute の findUnique が並列実行される（Promise.all）', async () => {
    let blockResolved = false
    let muteResolved = false
    mockBlockFindUnique.mockImplementationOnce(() => {
      return new Promise((resolve) => setTimeout(() => {
        blockResolved = true
        resolve(null)
      }, 10))
    })
    mockMuteFindUnique.mockImplementationOnce(() => {
      return new Promise((resolve) => setTimeout(() => {
        muteResolved = true
        resolve(null)
      }, 10))
    })
    const { resolveBlockMuteStateForOne } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStateForOne(VIEWER, TARGET)
    expect(result).toEqual({ isBlocked: false, isMuted: false })
    expect(blockResolved).toBe(true)
    expect(muteResolved).toBe(true)
  })

  it('block.findUnique に正しい複合キーが渡される', async () => {
    const { resolveBlockMuteStateForOne } = await import('@/lib/api/v1/follow-state-resolver')
    await resolveBlockMuteStateForOne(VIEWER, TARGET)
    expect(mockBlockFindUnique).toHaveBeenCalledWith({
      where: { blockerId_blockedId: { blockerId: VIEWER, blockedId: TARGET } },
      select: { blockerId: true },
    })
  })

  it('mute.findUnique に正しい複合キーが渡される', async () => {
    const { resolveBlockMuteStateForOne } = await import('@/lib/api/v1/follow-state-resolver')
    await resolveBlockMuteStateForOne(VIEWER, TARGET)
    expect(mockMuteFindUnique).toHaveBeenCalledWith({
      where: { muterId_mutedId: { muterId: VIEWER, mutedId: TARGET } },
      select: { muterId: true },
    })
  })
})
