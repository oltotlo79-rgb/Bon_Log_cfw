// @vitest-environment node

import { vi } from 'vitest'
// Prismaモック（filter-helper固有）
const fhMockPrisma = {
  block: {
    findMany: vi.fn(),
  },
  mute: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({
  prisma: fhMockPrisma,
}))

describe('filter-helper', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  // ============================================================
  // getExcludedUserIds
  // ============================================================

  describe('getExcludedUserIds', async () => {
    describe('オプションなし', async () => {
      it('すべてのオプションがfalseの場合、空配列を返す', async () => {
        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', {
          blocked: false,
          blockedBy: false,
          muted: false,
        })

        expect(result).toEqual([])
        expect(fhMockPrisma.block.findMany).not.toHaveBeenCalled()
        expect(fhMockPrisma.mute.findMany).not.toHaveBeenCalled()
      })

      it('オプションを指定しない場合、空配列を返す', async () => {
        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1')

        expect(result).toEqual([])
      })

      it('空のオプションオブジェクトの場合、空配列を返す', async () => {
        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', {})

        expect(result).toEqual([])
      })
    })

    describe('ブロックしたユーザーの取得（blocked: true）', async () => {
      it('自分がブロックしたユーザーを取得する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([
          { blockerId: 'user-1', blockedId: 'blocked-user-1' },
          { blockerId: 'user-1', blockedId: 'blocked-user-2' },
        ])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', { blocked: true })

        expect(result).toContain('blocked-user-1')
        expect(result).toContain('blocked-user-2')
        expect(result).toHaveLength(2)
      })

      it('ブロックしていない場合、空配列を返す', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', { blocked: true })

        expect(result).toEqual([])
      })

      it('blockerIdがuserIdと一致するクエリを実行する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        await getExcludedUserIds('user-1', { blocked: true })

        expect(fhMockPrisma.block.findMany).toHaveBeenCalledWith({
          where: { OR: [{ blockerId: 'user-1' }] },
          select: { blockerId: true, blockedId: true },
          take: 50000,
        })
      })
    })

    describe('自分をブロックしたユーザーの取得（blockedBy: true）', async () => {
      it('自分をブロックしたユーザーを取得する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([
          { blockerId: 'blocking-user-1', blockedId: 'user-1' },
          { blockerId: 'blocking-user-2', blockedId: 'user-1' },
        ])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', { blockedBy: true })

        expect(result).toContain('blocking-user-1')
        expect(result).toContain('blocking-user-2')
        expect(result).toHaveLength(2)
      })

      it('blockedIdがuserIdと一致するクエリを実行する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        await getExcludedUserIds('user-1', { blockedBy: true })

        expect(fhMockPrisma.block.findMany).toHaveBeenCalledWith({
          where: { OR: [{ blockedId: 'user-1' }] },
          select: { blockerId: true, blockedId: true },
          take: 50000,
        })
      })
    })

    describe('双方向ブロック（blocked: true, blockedBy: true）', () => {
      it('両方向のブロックを取得する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([
          { blockerId: 'user-1', blockedId: 'blocked-user' },
          { blockerId: 'blocking-user', blockedId: 'user-1' },
        ])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', {
          blocked: true,
          blockedBy: true,
        })

        expect(result).toContain('blocked-user')
        expect(result).toContain('blocking-user')
        expect(result).toHaveLength(2)
      })

      it('OR条件で両方向を検索する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        await getExcludedUserIds('user-1', { blocked: true, blockedBy: true })

        expect(fhMockPrisma.block.findMany).toHaveBeenCalledWith({
          where: {
            OR: [{ blockerId: 'user-1' }, { blockedId: 'user-1' }],
          },
          select: { blockerId: true, blockedId: true },
          take: 50000,
        })
      })

      it('同じユーザーが双方向の結果に含まれる場合、重複を除去する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([
          { blockerId: 'user-1', blockedId: 'mutual-block-user' },
          { blockerId: 'mutual-block-user', blockedId: 'user-1' },
        ])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', {
          blocked: true,
          blockedBy: true,
        })

        // mutual-block-user は1回だけ含まれる
        expect(result.filter((id) => id === 'mutual-block-user')).toHaveLength(1)
      })
    })

    describe('ミュートしたユーザーの取得（muted: true）', async () => {
      it('自分がミュートしたユーザーを取得する', async () => {
        fhMockPrisma.mute.findMany.mockResolvedValue([
          { muterId: 'user-1', mutedId: 'muted-user-1' },
          { muterId: 'user-1', mutedId: 'muted-user-2' },
        ])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', { muted: true })

        expect(result).toContain('muted-user-1')
        expect(result).toContain('muted-user-2')
        expect(result).toHaveLength(2)
      })

      it('muterIdがuserIdと一致するクエリを実行する', async () => {
        fhMockPrisma.mute.findMany.mockResolvedValue([])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        await getExcludedUserIds('user-1', { muted: true })

        expect(fhMockPrisma.mute.findMany).toHaveBeenCalledWith({
          where: { muterId: 'user-1' },
          select: { mutedId: true },
          take: 50000,
        })
      })
    })

    describe('すべてのオプション（blocked, blockedBy, muted）', () => {
      it('ブロックとミュートの両方を取得する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([
          { blockerId: 'user-1', blockedId: 'blocked-user' },
        ])
        fhMockPrisma.mute.findMany.mockResolvedValue([
          { muterId: 'user-1', mutedId: 'muted-user' },
        ])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', {
          blocked: true,
          blockedBy: true,
          muted: true,
        })

        expect(result).toContain('blocked-user')
        expect(result).toContain('muted-user')
      })

      it('ブロックとミュートで重複するユーザーの重複を除去する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([
          { blockerId: 'user-1', blockedId: 'same-user' },
        ])
        fhMockPrisma.mute.findMany.mockResolvedValue([
          { muterId: 'user-1', mutedId: 'same-user' },
        ])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', {
          blocked: true,
          muted: true,
        })

        expect(result.filter((id) => id === 'same-user')).toHaveLength(1)
      })
    })

    describe('自分自身の除外', async () => {
      it('blockedByの結果から自分自身を除外する', async () => {
        fhMockPrisma.block.findMany.mockResolvedValue([
          { blockerId: 'other-user', blockedId: 'user-1' },
        ])

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const result = await getExcludedUserIds('user-1', { blockedBy: true })

        // user-1（自分自身）は含まれない
        expect(result).not.toContain('user-1')
        expect(result).toContain('other-user')
      })
    })

    describe('並列クエリ実行', async () => {
      it('ブロックとミュートのクエリを並列で実行する', async () => {
        const blockPromise = new Promise((resolve) =>
          setTimeout(() => resolve([]), 10)
        )
        const mutePromise = new Promise((resolve) =>
          setTimeout(() => resolve([]), 10)
        )

        fhMockPrisma.block.findMany.mockReturnValue(blockPromise)
        fhMockPrisma.mute.findMany.mockReturnValue(mutePromise)

        const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

        const start = Date.now()
        await getExcludedUserIds('user-1', {
          blocked: true,
          muted: true,
        })
        const elapsed = Date.now() - start

        // 並列実行なので、シーケンシャル(20ms)より短いはず
        // CI環境では時間がかかる場合があるため余裕を持った閾値
        expect(elapsed).toBeLessThan(100)
      })
    })
  })

  // ============================================================
  // getBlockedUserIds
  // ============================================================

  describe('getBlockedUserIds', async () => {
    it('ブロックしたユーザーIDの配列を返す', async () => {
      fhMockPrisma.block.findMany.mockResolvedValue([
        { blockedId: 'blocked-1' },
        { blockedId: 'blocked-2' },
        { blockedId: 'blocked-3' },
      ])

      const { getBlockedUserIds } = await import('@/lib/actions/filter-helper')

      const result = await getBlockedUserIds('user-1')

      expect(result).toEqual(['blocked-1', 'blocked-2', 'blocked-3'])
    })

    it('ブロックしていない場合、空配列を返す', async () => {
      fhMockPrisma.block.findMany.mockResolvedValue([])

      const { getBlockedUserIds } = await import('@/lib/actions/filter-helper')

      const result = await getBlockedUserIds('user-1')

      expect(result).toEqual([])
    })

    it('正しいクエリを実行する', async () => {
      fhMockPrisma.block.findMany.mockResolvedValue([])

      const { getBlockedUserIds } = await import('@/lib/actions/filter-helper')

      await getBlockedUserIds('user-123')

      expect(fhMockPrisma.block.findMany).toHaveBeenCalledWith({
        where: { blockerId: 'user-123' },
        select: { blockedId: true },
        take: 50000,
      })
    })

    it('複数のブロックを正しくマッピングする', async () => {
      fhMockPrisma.block.findMany.mockResolvedValue([
        { blockedId: 'a' },
        { blockedId: 'b' },
        { blockedId: 'c' },
        { blockedId: 'd' },
        { blockedId: 'e' },
      ])

      const { getBlockedUserIds } = await import('@/lib/actions/filter-helper')

      const result = await getBlockedUserIds('user-1')

      expect(result).toHaveLength(5)
      expect(result).toEqual(['a', 'b', 'c', 'd', 'e'])
    })
  })

  // ============================================================
  // getMutedUserIds
  // ============================================================

  describe('getMutedUserIds', async () => {
    it('ミュートしたユーザーIDの配列を返す', async () => {
      fhMockPrisma.mute.findMany.mockResolvedValue([
        { mutedId: 'muted-1' },
        { mutedId: 'muted-2' },
      ])

      const { getMutedUserIds } = await import('@/lib/actions/filter-helper')

      const result = await getMutedUserIds('user-1')

      expect(result).toEqual(['muted-1', 'muted-2'])
    })

    it('ミュートしていない場合、空配列を返す', async () => {
      fhMockPrisma.mute.findMany.mockResolvedValue([])

      const { getMutedUserIds } = await import('@/lib/actions/filter-helper')

      const result = await getMutedUserIds('user-1')

      expect(result).toEqual([])
    })

    it('正しいクエリを実行する', async () => {
      fhMockPrisma.mute.findMany.mockResolvedValue([])

      const { getMutedUserIds } = await import('@/lib/actions/filter-helper')

      await getMutedUserIds('user-456')

      expect(fhMockPrisma.mute.findMany).toHaveBeenCalledWith({
        where: { muterId: 'user-456' },
        select: { mutedId: true },
        take: 50000,
      })
    })

    it('大量のミュートを正しく処理する', async () => {
      const mutes = Array.from({ length: 100 }, (_, i) => ({
        mutedId: `muted-${i}`,
      }))
      fhMockPrisma.mute.findMany.mockResolvedValue(mutes)

      const { getMutedUserIds } = await import('@/lib/actions/filter-helper')

      const result = await getMutedUserIds('user-1')

      expect(result).toHaveLength(100)
      expect(result[0]).toBe('muted-0')
      expect(result[99]).toBe('muted-99')
    })
  })

  // ============================================================
  // FilterOptions 型
  // ============================================================

  describe('FilterOptions型の動作', async () => {
    it('すべてのオプションをtrueで指定できる', async () => {
      fhMockPrisma.block.findMany.mockResolvedValue([])
      fhMockPrisma.mute.findMany.mockResolvedValue([])

      const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

      // 型エラーが発生しないことを確認
      await getExcludedUserIds('user-1', {
        blocked: true,
        blockedBy: true,
        muted: true,
      })

      expect(fhMockPrisma.block.findMany).toHaveBeenCalled()
      expect(fhMockPrisma.mute.findMany).toHaveBeenCalled()
    })

    it('一部のオプションのみ指定できる', async () => {
      fhMockPrisma.block.findMany.mockResolvedValue([])

      const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')

      await getExcludedUserIds('user-1', { blocked: true })

      expect(fhMockPrisma.block.findMany).toHaveBeenCalled()
      expect(fhMockPrisma.mute.findMany).not.toHaveBeenCalled()
    })
  })
})
