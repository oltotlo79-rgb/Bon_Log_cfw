// @vitest-environment node
/**
 * lib/api/v1/schemas/response — postPollSchema / postSchema.poll のユニットテスト
 *
 * postPollSchema（Prisma 生形の JSON 表現）が safeParse 成功する代表ケースと
 * postSchema.poll が nullable であることを検証する。
 * votes フィールドが optional（未認証ゲスト時は省略）かつ空配列を許容することも確認する。
 */
import { describe, it, expect } from 'vitest'
import {
  postPollSchema,
  postPollOptionSchema,
  postPollVoteRecordSchema,
  postSchema,
} from '@/lib/api/v1/schemas/response'

const POLL_ID = 'poll-id-001'
const POST_ID = 'post-id-001'
const OPTION_A_ID = 'option-id-001'
const OPTION_B_ID = 'option-id-002'
const USER_ID = 'user-id-001'

const validOption = {
  id: OPTION_A_ID,
  pollId: POLL_ID,
  text: '選択肢A',
  sortOrder: 0,
  _count: { votes: 10 },
}

const validVoteRecord = {
  id: 'vote-id-001',
  pollId: POLL_ID,
  optionId: OPTION_A_ID,
  userId: USER_ID,
  createdAt: '2026-01-01T00:00:00.000Z',
}

/** 完全な poll オブジェクト（認証ユーザー・投票済みの代表形） */
const validPoll = {
  id: POLL_ID,
  postId: POST_ID,
  duration: 86400,
  expiresAt: '2026-01-02T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  options: [
    validOption,
    { id: OPTION_B_ID, pollId: POLL_ID, text: '選択肢B', sortOrder: 1, _count: { votes: 5 } },
  ],
  votes: [validVoteRecord],
  _count: { votes: 15 },
}

/** postSchema の poll フィールドテスト用に必要な最小投稿オブジェクト */
const basePost = {
  id: 'post-abc',
  content: 'テスト投稿',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  userId: USER_ID,
  bonsaiId: null,
  user: { id: USER_ID, nickname: 'TestUser', avatarUrl: null, isBlocked: false, isMuted: false },
  media: [],
  genres: [],
  likeCount: 0,
  commentCount: 0,
  repostCount: 0,
  isLiked: false,
  isBookmarked: false,
  isReposted: false,
  quotePost: null,
  repostPost: null,
  mentionedUsers: [],
}

describe('postPollOptionSchema', () => {
  it('正常なオプションオブジェクトが safeParse 成功する', () => {
    const result = postPollOptionSchema.safeParse(validOption)
    expect(result.success).toBe(true)
  })
})

describe('postPollVoteRecordSchema', () => {
  it('正常な投票レコードオブジェクトが safeParse 成功する', () => {
    const result = postPollVoteRecordSchema.safeParse(validVoteRecord)
    expect(result.success).toBe(true)
  })
})

describe('postPollSchema', () => {
  it('正常系: 実形（votes 付き・投票済み）が safeParse 成功する', () => {
    const result = postPollSchema.safeParse(validPoll)
    expect(result.success).toBe(true)
  })

  it('votes を省略（undefined）しても safeParse 成功する（ゲスト非認証時相当）', () => {
    const { votes: _votes, ...pollWithoutVotes } = validPoll
    const result = postPollSchema.safeParse(pollWithoutVotes)
    expect(result.success).toBe(true)
  })

  it('votes が空配列でも safeParse 成功する（未投票・認証ユーザー相当）', () => {
    const result = postPollSchema.safeParse({ ...validPoll, votes: [] })
    expect(result.success).toBe(true)
  })

  it('options が複数あっても safeParse 成功する', () => {
    const poll = {
      ...validPoll,
      options: [
        validOption,
        { id: OPTION_B_ID, pollId: POLL_ID, text: '選択肢B', sortOrder: 1, _count: { votes: 5 } },
        { id: 'option-c', pollId: POLL_ID, text: '選択肢C', sortOrder: 2, _count: { votes: 0 } },
      ],
    }
    const result = postPollSchema.safeParse(poll)
    expect(result.success).toBe(true)
  })

  it('duration が整数でない場合は safeParse 失敗する', () => {
    const result = postPollSchema.safeParse({ ...validPoll, duration: 1.5 })
    expect(result.success).toBe(false)
  })

  it('expiresAt が datetime 形式でない場合は safeParse 失敗する', () => {
    const result = postPollSchema.safeParse({ ...validPoll, expiresAt: '2026-01-02' })
    expect(result.success).toBe(false)
  })
})

describe('postSchema — poll フィールドの nullable', () => {
  it('poll が null のとき safeParse 成功する', () => {
    const result = postSchema.safeParse({ ...basePost, poll: null })
    expect(result.success).toBe(true)
  })

  it('poll に有効なオブジェクト（votes なし）を渡すと safeParse 成功する', () => {
    const { votes: _votes, ...pollWithoutVotes } = validPoll
    const result = postSchema.safeParse({ ...basePost, poll: pollWithoutVotes })
    expect(result.success).toBe(true)
  })

  it('poll に有効なオブジェクト（votes: [] 空配列）を渡すと safeParse 成功する', () => {
    const result = postSchema.safeParse({ ...basePost, poll: { ...validPoll, votes: [] } })
    expect(result.success).toBe(true)
  })
})
