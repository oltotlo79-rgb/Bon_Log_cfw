// @vitest-environment node
/**
 * lib/api/v1/follow-state-resolver のユニットテスト
 *
 * resolveBlockMuteStates（バッチ）と resolveBlockMuteStateForOne の
 * 正常系・自己参照・エラー時フォールバックを検証する。
 * resolveFollowStates / resolveFollowStateForOne は既存テストで間接的に検証済み。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFollowFindMany = vi.fn()
const mockFollowRequestFindMany = vi.fn()
const mockBlockFindUnique = vi.fn()
const mockMuteFindUnique = vi.fn()
const mockBlockFindMany = vi.fn()
const mockMuteFindMany = vi.fn()
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
      findMany: (...args: unknown[]) => mockBlockFindMany(...args),
    },
    mute: {
      findUnique: (...args: unknown[]) => mockMuteFindUnique(...args),
      findMany: (...args: unknown[]) => mockMuteFindMany(...args),
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

describe('resolveIsFollowedByStates', () => {
  const TARGET_A = 'target-a'
  const TARGET_B = 'target-b'

  beforeEach(() => {
    vi.clearAllMocks()
    mockFollowFindMany.mockResolvedValue([])
  })

  it('空配列を渡すと即座に空 Map を返す（DB クエリなし）', async () => {
    const { resolveIsFollowedByStates } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveIsFollowedByStates(VIEWER, [])
    expect(result.size).toBe(0)
    expect(mockFollowFindMany).not.toHaveBeenCalled()
  })

  it('相手が閲覧者をフォローしている場合 true を返す（ターゲット→viewer 方向）', async () => {
    mockFollowFindMany.mockResolvedValueOnce([{ followerId: TARGET_A }])
    const { resolveIsFollowedByStates } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveIsFollowedByStates(VIEWER, [TARGET_A, TARGET_B])
    expect(result.get(TARGET_A)).toBe(true)
    expect(result.get(TARGET_B)).toBe(false)
  })

  it('相互フォロー関係でも isFollowedBy は viewer→target 方向を混同しない', async () => {
    // Follow.findMany は followerId: targetIds, followingId: viewer の1方向のみを問い合わせる。
    // viewer が target をフォローしているかどうかは resolveFollowStates（別関数）の責務。
    mockFollowFindMany.mockResolvedValueOnce([{ followerId: TARGET_A }])
    const { resolveIsFollowedByStates } = await import('@/lib/api/v1/follow-state-resolver')
    await resolveIsFollowedByStates(VIEWER, [TARGET_A])
    expect(mockFollowFindMany).toHaveBeenCalledWith({
      where: { followerId: { in: [TARGET_A] }, followingId: VIEWER },
      select: { followerId: true },
    })
  })

  it('findMany は 1 回だけ呼ばれる（N+1 なし）', async () => {
    const { resolveIsFollowedByStates } = await import('@/lib/api/v1/follow-state-resolver')
    await resolveIsFollowedByStates(VIEWER, [TARGET_A, TARGET_B])
    expect(mockFollowFindMany).toHaveBeenCalledTimes(1)
  })

  it('どちらもフォローしていない場合は全 false を返す', async () => {
    const { resolveIsFollowedByStates } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveIsFollowedByStates(VIEWER, [TARGET_A, TARGET_B])
    expect(result.get(TARGET_A)).toBe(false)
    expect(result.get(TARGET_B)).toBe(false)
  })
})

describe('resolveBlockMuteStateForOne', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBlockFindUnique.mockResolvedValue(null)
    mockMuteFindUnique.mockResolvedValue(null)
    mockBlockFindMany.mockResolvedValue([])
    mockMuteFindMany.mockResolvedValue([])
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

describe('resolveBlockMuteStates（バッチ）', () => {
  const TARGET_A = 'target-a'
  const TARGET_B = 'target-b'
  const TARGET_C = 'target-c'

  beforeEach(() => {
    vi.clearAllMocks()
    mockBlockFindMany.mockResolvedValue([])
    mockMuteFindMany.mockResolvedValue([])
    mockFollowFindMany.mockResolvedValue([])
    mockFollowRequestFindMany.mockResolvedValue([])
  })

  it('空配列を渡すと即座に空 Map を返す（DB クエリなし）', async () => {
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStates(VIEWER, [])
    expect(result.size).toBe(0)
    expect(mockBlockFindMany).not.toHaveBeenCalled()
    expect(mockMuteFindMany).not.toHaveBeenCalled()
  })

  it('未ブロック・未ミュートの id は { isBlocked: false, isMuted: false } を返す', async () => {
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStates(VIEWER, [TARGET_A, TARGET_B])
    expect(result.get(TARGET_A)).toEqual({ isBlocked: false, isMuted: false })
    expect(result.get(TARGET_B)).toEqual({ isBlocked: false, isMuted: false })
  })

  it('block テーブルにある id は isBlocked:true になる', async () => {
    mockBlockFindMany.mockResolvedValueOnce([{ blockedId: TARGET_A }])
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStates(VIEWER, [TARGET_A, TARGET_B])
    expect(result.get(TARGET_A)).toEqual({ isBlocked: true, isMuted: false })
    expect(result.get(TARGET_B)).toEqual({ isBlocked: false, isMuted: false })
  })

  it('mute テーブルにある id は isMuted:true になる', async () => {
    mockMuteFindMany.mockResolvedValueOnce([{ mutedId: TARGET_B }])
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStates(VIEWER, [TARGET_A, TARGET_B])
    expect(result.get(TARGET_A)).toEqual({ isBlocked: false, isMuted: false })
    expect(result.get(TARGET_B)).toEqual({ isBlocked: false, isMuted: true })
  })

  it('複数 id の一括解決: block.findMany / mute.findMany がそれぞれ 1 回だけ呼ばれる', async () => {
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    await resolveBlockMuteStates(VIEWER, [TARGET_A, TARGET_B, TARGET_C])
    expect(mockBlockFindMany).toHaveBeenCalledTimes(1)
    expect(mockMuteFindMany).toHaveBeenCalledTimes(1)
  })

  it('重複 id は内部で排除され findMany は一意な id セットで呼ばれる', async () => {
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStates(VIEWER, [TARGET_A, TARGET_A, TARGET_B, TARGET_A])
    expect(mockBlockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          blockedId: expect.objectContaining({ in: expect.arrayContaining([TARGET_A, TARGET_B]) }),
        }),
      }),
    )
    expect(result.size).toBe(2)
    expect(result.get(TARGET_A)).toEqual({ isBlocked: false, isMuted: false })
    expect(result.get(TARGET_B)).toEqual({ isBlocked: false, isMuted: false })
  })

  it('DB エラー（findMany reject）時は fail-open で空 Map を返す', async () => {
    mockBlockFindMany.mockRejectedValueOnce(new Error('DB connection error'))
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    const result = await resolveBlockMuteStates(VIEWER, [TARGET_A, TARGET_B])
    expect(result.size).toBe(0)
  })

  it('block と mute が並列実行される（Promise.all）', async () => {
    let blockResolved = false
    let muteResolved = false
    mockBlockFindMany.mockImplementationOnce(() =>
      new Promise((resolve) => setTimeout(() => {
        blockResolved = true
        resolve([])
      }, 10)),
    )
    mockMuteFindMany.mockImplementationOnce(() =>
      new Promise((resolve) => setTimeout(() => {
        muteResolved = true
        resolve([])
      }, 10)),
    )
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    await resolveBlockMuteStates(VIEWER, [TARGET_A])
    expect(blockResolved).toBe(true)
    expect(muteResolved).toBe(true)
  })

  it('block.findMany に正しいクエリが渡される', async () => {
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    await resolveBlockMuteStates(VIEWER, [TARGET_A, TARGET_B])
    expect(mockBlockFindMany).toHaveBeenCalledWith({
      where: { blockerId: VIEWER, blockedId: { in: expect.arrayContaining([TARGET_A, TARGET_B]) } },
      select: { blockedId: true },
    })
  })

  it('mute.findMany に正しいクエリが渡される', async () => {
    const { resolveBlockMuteStates } = await import('@/lib/api/v1/follow-state-resolver')
    await resolveBlockMuteStates(VIEWER, [TARGET_A, TARGET_B])
    expect(mockMuteFindMany).toHaveBeenCalledWith({
      where: { muterId: VIEWER, mutedId: { in: expect.arrayContaining([TARGET_A, TARGET_B]) } },
      select: { mutedId: true },
    })
  })
})
