// @vitest-environment node
/**
 * POST /api/v1/polls/[id]/vote — アンケート投票
 *
 * 200 / 400 / 401 / 403 / 404 / 429 の全分岐を検証する。
 * 期限切れ・二重投票・不正 optionId・ゲスト拒否を網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockCastVote = vi.fn()
vi.mock('@/lib/services/poll-vote-service', () => ({
  castVote: (...args: unknown[]) => mockCastVote(...args),
}))

const VALID_POLL_ID = 'cjld2cjxh0000qzrmn831i7rn'
const VALID_OPTION_ID = 'cjld2cjxh0001qzrmn831i7rn'
const USER_ID = 'cjld2cjxh0002qzrmn831i7rn'

const mockPollResult = {
  id: VALID_POLL_ID,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  isExpired: false,
  totalVotes: 5,
  userVoteOptionId: VALID_OPTION_ID,
  options: [
    { id: VALID_OPTION_ID, text: '選択肢A', voteCount: 3, percentage: 60 },
    { id: 'option-b', text: '選択肢B', voteCount: 2, percentage: 40 },
  ],
}

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  pollId = VALID_POLL_ID,
  body: unknown = { optionId: VALID_OPTION_ID },
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(`http://localhost/api/v1/polls/${pollId}/vote`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: pollId }) }]
}

describe('POST /api/v1/polls/[id]/vote', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockCastVote.mockResolvedValue({ ok: true, poll: mockPollResult })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 と PollVoteResponse（percentage 付き）を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(VALID_POLL_ID)
    expect(body.totalVotes).toBe(5)
    expect(body.options[0].percentage).toBe(60)
    expect(body.userVoteOptionId).toBe(VALID_OPTION_ID)
  })

  it('castVote に pollId・optionId・userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    await POST(req, params)

    expect(mockCastVote).toHaveBeenCalledWith(VALID_POLL_ID, VALID_OPTION_ID, USER_ID)
  })

  it('期限切れアンケート → 400 VALIDATION_ERROR（ERR_POLL_ENDED）', async () => {
    mockCastVote.mockResolvedValueOnce({ ok: false, error: 'このアンケートは終了しました', status: 400 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('二重投票 → 400 VALIDATION_ERROR（ERR_POLL_ALREADY_VOTED）', async () => {
    mockCastVote.mockResolvedValueOnce({ ok: false, error: 'すでにこのアンケートに投票済みです', status: 400 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な optionId → 400 VALIDATION_ERROR（ERR_POLL_INVALID_OPTION）', async () => {
    mockCastVote.mockResolvedValueOnce({ ok: false, error: '無効な選択肢です', status: 400 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('存在しないアンケート → 404 NOT_FOUND', async () => {
    mockCastVote.mockResolvedValueOnce({ ok: false, error: 'アンケートが見つかりません', status: 404 })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/polls/${VALID_POLL_ID}/vote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ optionId: VALID_OPTION_ID }),
    })
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_POLL_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/polls/${VALID_POLL_ID}/vote`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ optionId: VALID_OPTION_ID }),
    })
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_POLL_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('不正な pollId（31文字超）で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', invalidId)
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('optionId が空文字のとき 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com', VALID_POLL_ID, { optionId: '' })
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('リクエストボディが欠落している場合 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(USER_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/polls/${VALID_POLL_ID}/vote`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: 'not-json{',
    })
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_POLL_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('レスポンスの options に percentage が含まれる', async () => {
    const [req, params] = await makeAuthenticatedRequest(USER_ID, 'user@example.com')
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, params)

    const body = await res.json()
    for (const option of body.options) {
      expect(typeof option.percentage).toBe('number')
    }
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest(`http://localhost/api/v1/polls/${VALID_POLL_ID}/vote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ optionId: VALID_OPTION_ID }),
    })
    const { POST } = await import('@/app/api/v1/polls/[id]/vote/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_POLL_ID }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
