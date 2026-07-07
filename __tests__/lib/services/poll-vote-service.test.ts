// @vitest-environment node
/**
 * lib/services/poll-vote-service の castVote ユニットテスト。
 *
 * 期限切れ・無効な選択肢・二重投票（事前チェック + 並行リクエストによる P2002）・
 * 集計結果（percentage 計算・totalVotes 0 件時のゼロ割回避）を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockPollFindUnique = vi.fn()
const mockPollVoteFindUnique = vi.fn()
const mockPollVoteCreate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    poll: {
      findUnique: (...args: unknown[]) => mockPollFindUnique(...args),
    },
    pollVote: {
      findUnique: (...args: unknown[]) => mockPollVoteFindUnique(...args),
      create: (...args: unknown[]) => mockPollVoteCreate(...args),
    },
  },
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  default: { error: (...args: unknown[]) => mockLoggerError(...args) },
}))

// 対象リソース認可（見えない投稿の poll には投票不可）。
// デフォルトは可視（true）にし、非可視ケースのみ個別テストで false を返す。
const mockAssertCanViewPost = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/services/post-visibility', () => ({
  assertCanViewPost: (...args: unknown[]) => mockAssertCanViewPost(...args),
}))

const USER_ID = 'user-001'
const POLL_ID = 'poll-001'
const POST_ID = 'post-001'
const OPTION_A = 'option-a'
const OPTION_B = 'option-b'

const FUTURE_DATE = new Date(Date.now() + 24 * 60 * 60 * 1000)
const PAST_DATE = new Date(Date.now() - 24 * 60 * 60 * 1000)

const makePoll = (overrides: Record<string, unknown> = {}) => ({
  id: POLL_ID,
  postId: POST_ID,
  expiresAt: FUTURE_DATE,
  options: [
    { id: OPTION_A, text: '選択肢A', _count: { votes: 0 } },
    { id: OPTION_B, text: '選択肢B', _count: { votes: 0 } },
  ],
  _count: { votes: 0 },
  ...overrides,
})

describe('castVote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssertCanViewPost.mockResolvedValue(true)
  })

  it('非公開/フォロー限定/ブロック著者などで見えない投稿のpollは404 POLL_NOT_FOUNDを返す', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockAssertCanViewPost.mockResolvedValueOnce(false)

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
    if (result.ok) throw new Error('ok=true')
    const { ERR_POLL_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_POLL_NOT_FOUND)
    // 可視性チェックで弾かれた場合、期限/選択肢チェックまで進まない
    expect(mockPollVoteFindUnique).not.toHaveBeenCalled()
  })

  it('assertCanViewPostにuserIdとpoll.postIdが渡される', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockPollVoteFindUnique.mockResolvedValueOnce(null)
    mockPollVoteCreate.mockResolvedValueOnce({ pollId: POLL_ID, optionId: OPTION_A, userId: USER_ID })
    mockPollFindUnique.mockResolvedValueOnce(makePoll())

    const { castVote } = await import('@/lib/services/poll-vote-service')
    await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(mockAssertCanViewPost).toHaveBeenCalledWith(USER_ID, POST_ID)
  })

  it('アンケートが存在しない場合は 404 POLL_NOT_FOUND を返す', async () => {
    mockPollFindUnique.mockResolvedValueOnce(null)

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
    if (result.ok) throw new Error('ok=true')
    expect(mockPollVoteFindUnique).not.toHaveBeenCalled()
  })

  it('期限切れの場合は 400 POLL_ENDED を返す', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll({ expiresAt: PAST_DATE }))

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 400 })
    if (result.ok) throw new Error('ok=true')
    const { ERR_POLL_ENDED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_POLL_ENDED)
  })

  it('無効な選択肢の場合は 400 POLL_INVALID_OPTION を返す', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, 'not-an-option', USER_ID)

    expect(result).toMatchObject({ ok: false, status: 400 })
    if (result.ok) throw new Error('ok=true')
    const { ERR_POLL_INVALID_OPTION } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_POLL_INVALID_OPTION)
    expect(mockPollVoteCreate).not.toHaveBeenCalled()
  })

  it('事前チェックで既に投票済みの場合は 400 POLL_ALREADY_VOTED を返す', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockPollVoteFindUnique.mockResolvedValueOnce({ pollId: POLL_ID, userId: USER_ID, optionId: OPTION_A })

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 400 })
    if (result.ok) throw new Error('ok=true')
    const { ERR_POLL_ALREADY_VOTED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_POLL_ALREADY_VOTED)
    expect(mockPollVoteCreate).not.toHaveBeenCalled()
  })

  it('並行リクエストによる P2002（unique constraint）は POLL_ALREADY_VOTED にフォールバックする', async () => {
    const { Prisma } = await import('@prisma/client')
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
      meta: { target: ['pollId', 'userId'] },
    })
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockPollVoteFindUnique.mockResolvedValueOnce(null)
    mockPollVoteCreate.mockRejectedValueOnce(p2002)

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 400 })
    if (result.ok) throw new Error('ok=true')
    const { ERR_POLL_ALREADY_VOTED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_POLL_ALREADY_VOTED)
  })

  it('P2002 以外の DB エラーは 500 POLL_VOTE_FAILED を返しログに記録する', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockPollVoteFindUnique.mockResolvedValueOnce(null)
    mockPollVoteCreate.mockRejectedValueOnce(new Error('DB connection lost'))

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 500 })
    if (result.ok) throw new Error('ok=true')
    const { ERR_POLL_VOTE_FAILED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_POLL_VOTE_FAILED)
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('投票成功後に再取得した poll が消えていた場合は 500 POLL_VOTE_FAILED を返す', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockPollVoteFindUnique.mockResolvedValueOnce(null)
    mockPollVoteCreate.mockResolvedValueOnce({ pollId: POLL_ID, optionId: OPTION_A, userId: USER_ID })
    mockPollFindUnique.mockResolvedValueOnce(null)

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result).toMatchObject({ ok: false, status: 500 })
  })

  it('正常系: 投票後の集計結果を返し userVoteOptionId が投票した選択肢になる', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockPollVoteFindUnique.mockResolvedValueOnce(null)
    mockPollVoteCreate.mockResolvedValueOnce({ pollId: POLL_ID, optionId: OPTION_A, userId: USER_ID })
    mockPollFindUnique.mockResolvedValueOnce(
      makePoll({
        options: [
          { id: OPTION_A, text: '選択肢A', _count: { votes: 3 } },
          { id: OPTION_B, text: '選択肢B', _count: { votes: 1 } },
        ],
        _count: { votes: 4 },
      }),
    )

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.poll.userVoteOptionId).toBe(OPTION_A)
    expect(result.poll.totalVotes).toBe(4)
    expect(result.poll.isExpired).toBe(false)
  })

  it('percentage は小数第1位までの正しい割合になる（3/4=75.0, 1/4=25.0）', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockPollVoteFindUnique.mockResolvedValueOnce(null)
    mockPollVoteCreate.mockResolvedValueOnce({ pollId: POLL_ID, optionId: OPTION_A, userId: USER_ID })
    mockPollFindUnique.mockResolvedValueOnce(
      makePoll({
        options: [
          { id: OPTION_A, text: '選択肢A', _count: { votes: 3 } },
          { id: OPTION_B, text: '選択肢B', _count: { votes: 1 } },
        ],
        _count: { votes: 4 },
      }),
    )

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.poll.options.find((o) => o.id === OPTION_A)?.percentage).toBe(75)
    expect(result.poll.options.find((o) => o.id === OPTION_B)?.percentage).toBe(25)
  })

  it('totalVotes が 0 のとき全選択肢の percentage は 0（ゼロ割回避）', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockPollVoteFindUnique.mockResolvedValueOnce(null)
    mockPollVoteCreate.mockResolvedValueOnce({ pollId: POLL_ID, optionId: OPTION_A, userId: USER_ID })
    mockPollFindUnique.mockResolvedValueOnce(makePoll({ _count: { votes: 0 } }))

    const { castVote } = await import('@/lib/services/poll-vote-service')
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    for (const option of result.poll.options) {
      expect(option.percentage).toBe(0)
    }
  })

  it('isExpired は再取得時の expiresAt を基準に判定される', async () => {
    mockPollFindUnique.mockResolvedValueOnce(makePoll())
    mockPollVoteFindUnique.mockResolvedValueOnce(null)
    mockPollVoteCreate.mockResolvedValueOnce({ pollId: POLL_ID, optionId: OPTION_A, userId: USER_ID })
    mockPollFindUnique.mockResolvedValueOnce(makePoll({ expiresAt: PAST_DATE }))

    const { castVote } = await import('@/lib/services/poll-vote-service')
    // 投票時点では期限内だが、再取得までの間に期限が過ぎたケース（境界ケース）
    const result = await castVote(POLL_ID, OPTION_A, USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.poll.isExpired).toBe(true)
  })
})
