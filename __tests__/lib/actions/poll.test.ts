// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/poll')
import { revalidatePath as _revalidatePath } from 'next/cache'

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const getModule = () => import('@/lib/actions/poll')

/** ActionResult 成功レスポンスから data 部を取り出す（型安全） */
function unwrapOk<T>(result: { success: true; data?: T } | { success: false; error: string }): T {
  if (!result.success) throw new Error(`Expected success, got error: ${result.error}`)
  if (!result.data) throw new Error('Expected data to be defined')
  return result.data
}

interface PollResult {
  poll: {
    id: string
    expiresAt: Date
    isExpired: boolean
    totalVotes: number
    userVoteOptionId: string | null
    options: { id: string; text: string; voteCount: number }[]
  }
}

describe('Poll Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ================================================================
  // votePoll
  // ================================================================
  describe('votePoll', () => {
    const mockPoll = {
      id: 'poll-1',
      expiresAt: new Date(Date.now() + 86400000),
      options: [
        { id: 'opt-1' },
        { id: 'opt-2' },
        { id: 'opt-3' },
      ],
    }

    it('未認証の場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)
      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-1')
      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('セッションにユーザーIDがない場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: {} })
      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-1')
      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('存在しないアンケートの場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(null)
      const { votePoll } = await getModule()
      const result = await votePoll('nonexistent', 'opt-1')
      expect(result).toMatchObject({ error: 'アンケートが見つかりません' })
    })

    it('期限切れのアンケートの場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce({
        ...mockPoll,
        expiresAt: new Date(Date.now() - 86400000),
      })
      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-1')
      expect(result).toMatchObject({ error: 'このアンケートは終了しています' })
    })

    it('無効な選択肢の場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPoll)
      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'invalid-option')
      expect(result).toMatchObject({ error: '無効な選択肢です' })
    })

    it('既に投票済みの場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPoll)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce({
        pollId: 'poll-1',
        userId: mockUser.id,
        optionId: 'opt-1',
      })
      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-1')
      expect(result).toMatchObject({ error: '既に投票済みです' })
    })

    it('正常に投票できる', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPoll)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce(null)
      mockPrisma.pollVote.create.mockResolvedValueOnce({
        pollId: 'poll-1',
        optionId: 'opt-1',
        userId: mockUser.id,
      })

      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-1')
      expect(result).toEqual({ success: true })
      expect(mockPrisma.pollVote.create).toHaveBeenCalledWith({
        data: {
          pollId: 'poll-1',
          optionId: 'opt-1',
          userId: mockUser.id,
        },
      })
    })

    it('投票後にrevalidatePathが呼ばれる', async () => {
      const revalidatePath = _revalidatePath as unknown as ReturnType<typeof vi.fn>
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPoll)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce(null)
      mockPrisma.pollVote.create.mockResolvedValueOnce({})

      const { votePoll } = await getModule()
      await votePoll('poll-1', 'opt-1')
      expect(revalidatePath).toHaveBeenCalledWith('/feed')
    })

    it('最初の選択肢に投票できる', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPoll)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce(null)
      mockPrisma.pollVote.create.mockResolvedValueOnce({})

      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-1')
      expect(result).toEqual({ success: true })
    })

    it('最後の選択肢に投票できる', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPoll)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce(null)
      mockPrisma.pollVote.create.mockResolvedValueOnce({})

      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-3')
      expect(result).toEqual({ success: true })
    })

    it('pollIdが正しくprismaに渡される', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPoll)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce(null)
      mockPrisma.pollVote.create.mockResolvedValueOnce({})

      const { votePoll } = await getModule()
      await votePoll('poll-1', 'opt-2')
      expect(mockPrisma.poll.findUnique).toHaveBeenCalledWith({
        where: { id: 'poll-1' },
        select: { expiresAt: true, options: { select: { id: true } } },
      })
    })

    it('投票チェックで正しいcomposite keyが使われる', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPoll)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce(null)
      mockPrisma.pollVote.create.mockResolvedValueOnce({})

      const { votePoll } = await getModule()
      await votePoll('poll-1', 'opt-1')
      expect(mockPrisma.pollVote.findUnique).toHaveBeenCalledWith({
        where: { pollId_userId: { pollId: 'poll-1', userId: mockUser.id } },
      })
    })

    it('期限がちょうど過去の場合は期限切れ扱い', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce({
        ...mockPoll,
        expiresAt: new Date(Date.now() - 1),
      })
      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-1')
      expect(result).toMatchObject({ error: 'このアンケートは終了しています' })
    })

    it('選択肢が空のアンケートには投票できない', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce({
        ...mockPoll,
        options: [],
      })
      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-1')
      expect(result).toMatchObject({ error: '無効な選択肢です' })
    })

    it('DB作成エラーが発生した場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPoll)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce(null)
      mockPrisma.pollVote.create.mockRejectedValueOnce(new Error('DB error'))

      const { votePoll } = await getModule()
      const result = await votePoll('poll-1', 'opt-1')
      expect(result).toMatchObject({ error: '投票に失敗しました' })
    })
  })

  // ================================================================
  // getPollResults
  // ================================================================
  describe('getPollResults', () => {
    const mockPollWithResults = {
      id: 'poll-1',
      expiresAt: new Date(Date.now() + 86400000),
      options: [
        { id: 'opt-1', text: '選択肢1', sortOrder: 0, _count: { votes: 5 } },
        { id: 'opt-2', text: '選択肢2', sortOrder: 1, _count: { votes: 3 } },
        { id: 'opt-3', text: '選択肢3', sortOrder: 2, _count: { votes: 2 } },
      ],
      _count: { votes: 10 },
    }

    it('存在しないアンケートの場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(null)
      const { getPollResults } = await getModule()
      const result = await getPollResults('nonexistent')
      expect(result).toMatchObject({ error: 'アンケートが見つかりません' })
    })

    it('認証済みユーザーの投票状態を含む結果を返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce({ optionId: 'opt-1' })

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll).toBeDefined()
      expect(data.poll.userVoteOptionId).toBe('opt-1')
    })

    it('未投票ユーザーの場合userVoteOptionIdがnull', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce(null)

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.userVoteOptionId).toBeNull()
    })

    it('未認証ユーザーでも結果を取得できる', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll).toBeDefined()
      expect(data.poll.userVoteOptionId).toBeNull()
    })

    it('各選択肢の投票数が正しく返される', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.options).toEqual([
        { id: 'opt-1', text: '選択肢1', voteCount: 5 },
        { id: 'opt-2', text: '選択肢2', voteCount: 3 },
        { id: 'opt-3', text: '選択肢3', voteCount: 2 },
      ])
    })

    it('総投票数が正しく返される', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.totalVotes).toBe(10)
    })

    it('期限切れフラグが正しく設定される（未期限切れ）', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.isExpired).toBe(false)
    })

    it('期限切れフラグが正しく設定される（期限切れ）', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce({
        ...mockPollWithResults,
        expiresAt: new Date(Date.now() - 86400000),
      })

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.isExpired).toBe(true)
    })

    it('選択肢が0票のアンケート結果を取得できる', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce({
        ...mockPollWithResults,
        options: [
          { id: 'opt-1', text: '選択肢1', sortOrder: 0, _count: { votes: 0 } },
          { id: 'opt-2', text: '選択肢2', sortOrder: 1, _count: { votes: 0 } },
        ],
        _count: { votes: 0 },
      })

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.totalVotes).toBe(0)
      expect(data.poll.options[0].voteCount).toBe(0)
    })

    it('pollIdが正しくクエリに渡される', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)

      const { getPollResults } = await getModule()
      await getPollResults('poll-123')
      expect(mockPrisma.poll.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'poll-123' },
        })
      )
    })

    it('セッションにユーザーIDがない場合も結果を取得できる', async () => {
      mockAuth.mockResolvedValueOnce({ user: {} })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll).toBeDefined()
      expect(data.poll.userVoteOptionId).toBeNull()
    })

    it('expiresAtが結果に含まれる', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.expiresAt).toBeDefined()
    })

    it('idが結果に含まれる', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.id).toBe('poll-1')
    })

    it('DB読み取りエラーが発生した場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockRejectedValueOnce(new Error('DB read error'))

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      expect(result).toMatchObject({ error: 'アンケートが見つかりません' })
    })

    it('2つの選択肢のアンケート結果を取得できる', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce({
        id: 'poll-2',
        expiresAt: new Date(Date.now() + 86400000),
        options: [
          { id: 'a', text: 'はい', sortOrder: 0, _count: { votes: 10 } },
          { id: 'b', text: 'いいえ', sortOrder: 1, _count: { votes: 5 } },
        ],
        _count: { votes: 15 },
      })

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-2')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.options).toHaveLength(2)
      expect(data.poll.totalVotes).toBe(15)
    })

    it('4つの選択肢のアンケート結果を取得できる', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce({
        id: 'poll-3',
        expiresAt: new Date(Date.now() + 86400000),
        options: [
          { id: 'a', text: 'A', sortOrder: 0, _count: { votes: 1 } },
          { id: 'b', text: 'B', sortOrder: 1, _count: { votes: 2 } },
          { id: 'c', text: 'C', sortOrder: 2, _count: { votes: 3 } },
          { id: 'd', text: 'D', sortOrder: 3, _count: { votes: 4 } },
        ],
        _count: { votes: 10 },
      })

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-3')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.options).toHaveLength(4)
    })

    it('認証済みで投票済みの場合optionIdが返される', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce({ optionId: 'opt-2' })

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.userVoteOptionId).toBe('opt-2')
    })

    it('認証済みで投票済みの場合opt-3も返せる', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: mockUser.id } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce({ optionId: 'opt-3' })

      const { getPollResults } = await getModule()
      const result = await getPollResults('poll-1')
      const data = unwrapOk<PollResult>(result)
      expect(data.poll.userVoteOptionId).toBe('opt-3')
    })

    it('pollVoteのwhereに正しいuserIdが含まれる', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'custom-user' } })
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)
      mockPrisma.pollVote.findUnique.mockResolvedValueOnce(null)

      const { getPollResults } = await getModule()
      await getPollResults('poll-1')
      expect(mockPrisma.pollVote.findUnique).toHaveBeenCalledWith({
        where: { pollId_userId: { pollId: 'poll-1', userId: 'custom-user' } },
        select: { optionId: true },
      })
    })

    it('includeでoptionsとcountが正しくリクエストされる', async () => {
      mockAuth.mockResolvedValueOnce(null)
      mockPrisma.poll.findUnique.mockResolvedValueOnce(mockPollWithResults)

      const { getPollResults } = await getModule()
      await getPollResults('poll-1')
      expect(mockPrisma.poll.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            options: expect.objectContaining({
              orderBy: { sortOrder: 'asc' },
            }),
            _count: { select: { votes: true } },
          }),
        })
      )
    })
  })
})
