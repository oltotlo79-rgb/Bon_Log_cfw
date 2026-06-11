// @vitest-environment node
/**
 * バリデーション・レート制限失敗パスのテスト
 *
 * 各Server Actionの認証→Zodバリデーション→レート制限の順序と、
 * 具体的なエラーメッセージ定数を検証する。
 *
 * 対象:
 * - bonsai.ts: createBonsai / updateBonsai / deleteBonsai
 * - bonsai-record.ts: addBonsaiRecord / updateBonsaiRecord / deleteBonsaiRecord
 * - feed.ts: getTimeline / getRecommendedUsers
 * - message.ts: sendMessage
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ============================================================
// 共通モック
// ============================================================

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}))

vi.mock('@/lib/actions/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
  deleteNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
  deleteNotification: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/services/analytics-recording', () => ({
  recordLikeReceivedService: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/actions/post-include', () => ({
  POST_LIST_INCLUDE: {},
  formatPostForClient: vi.fn((post: unknown) => post),
}))


/**
 * `ActionResult<T>` を旧フラット形状に展開する互換ヘルパー（feed 移行用）。
 * 成功時は data を展開し、失敗時は { error, posts: [], nextCursor: undefined, isGuest: false } を返す。
 * 旧テストの `result.posts` / `result.error` のいずれのスタイルも書き換えずに動作する。
 */
type FeedLegacyShape = {
  success?: boolean
  error?: string
  posts?: unknown[]
  nextCursor?: string
  isGuest?: boolean
}
function unwrap<T>(result: import('@/types/action-result').ActionResult<T>): (T extends object ? T : Record<string, never>) & FeedLegacyShape {
  if (result.success) {
    return { success: true, ...(result.data ?? {}) } as (T extends object ? T : Record<string, never>) & FeedLegacyShape
  }
  return {
    success: false,
    error: result.error,
    posts: [],
    nextCursor: undefined,
    isGuest: false,
  } as unknown as (T extends object ? T : Record<string, never>) & FeedLegacyShape
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockAuth.mockResolvedValue({ user: { id: mockUser.id, email: 'test@example.com' } })
  mockCheckUserRateLimit.mockResolvedValue({ success: true })
})

// ============================================================
// bonsai.ts — Zodバリデーション失敗パス
// ============================================================

describe('bonsai.ts — createBonsai バリデーション', () => {
  const importModule = () => import('@/lib/actions/bonsai')

  it('名前が空文字の場合 ERR_INVALID_INPUT を返す', async () => {
    const { createBonsai } = await importModule()
    const result = await createBonsai({ name: '' })
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('名前が100文字を超える場合 ERR_INVALID_INPUT を返す', async () => {
    const { createBonsai } = await importModule()
    const result = await createBonsai({ name: 'a'.repeat(101) })
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('説明が2000文字を超える場合 ERR_INVALID_INPUT を返す', async () => {
    const { createBonsai } = await importModule()
    const result = await createBonsai({ name: 'テスト盆栽', description: 'a'.repeat(2001) })
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('バリデーション失敗時はDBに書き込まない', async () => {
    const { createBonsai } = await importModule()
    await createBonsai({ name: '' })
    expect(mockPrisma.bonsai.create).not.toHaveBeenCalled()
  })

  it('説明がちょうど2000文字の場合はバリデーションを通過する', async () => {
    const { createBonsai } = await importModule()
    // バリデーション通過→認証後のレート制限で通過するところまで確認
    // (実際のDB操作は別テストでカバー済み)
    const result = await createBonsai({ name: 'テスト盆栽', description: 'a'.repeat(2000) })
    // バリデーションエラーではないことを確認（ERR_INVALID_INPUTが返らない）
    if (!result.success) {
      expect(result.error).not.toBe('入力データが不正です')
    }
  })
})

describe('bonsai.ts — updateBonsai バリデーション', () => {
  const importModule = () => import('@/lib/actions/bonsai')

  it('盆栽IDが空の場合 ERR_INVALID_BONSAI_ID を返す', async () => {
    const { updateBonsai } = await importModule()
    const result = await updateBonsai('', { name: 'テスト' })
    expect(result).toEqual({ success: false, error: '無効な盆栽IDです' })
  })

  it('名前が100文字を超える場合 ERR_INVALID_INPUT を返す', async () => {
    const { updateBonsai } = await importModule()
    const result = await updateBonsai('b1', { name: 'a'.repeat(101) })
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('バリデーション失敗時はDBに書き込まない', async () => {
    const { updateBonsai } = await importModule()
    await updateBonsai('', { name: 'テスト' })
    expect(mockPrisma.bonsai.update).not.toHaveBeenCalled()
  })
})

describe('bonsai.ts — deleteBonsai レート制限', () => {
  const importModule = () => import('@/lib/actions/bonsai')

  it('レート制限超過時に ERR_RATE_LIMIT_OPERATION を返す', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { deleteBonsai } = await importModule()
    const result = await deleteBonsai('b1')
    expect(result).toEqual({
      success: false,
      error: '操作が多すぎます。しばらく待ってから再試行してください',
    })
  })

  it('レート制限超過時はDBに書き込まない', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { deleteBonsai } = await importModule()
    await deleteBonsai('b1')
    expect(mockPrisma.bonsai.delete).not.toHaveBeenCalled()
  })

  it('IDが空の場合 ERR_INVALID_BONSAI_ID を返す', async () => {
    const { deleteBonsai } = await importModule()
    const result = await deleteBonsai('')
    expect(result).toEqual({ success: false, error: '無効な盆栽IDです' })
  })
})

// ============================================================
// bonsai-record.ts — バリデーション・レート制限失敗パス
// ============================================================

describe('bonsai-record.ts — addBonsaiRecord バリデーション', () => {
  const importModule = () => import('@/lib/actions/bonsai-record')

  it('bonsaiIdが空の場合 ERR_INVALID_INPUT を返す', async () => {
    const { addBonsaiRecord } = await importModule()
    const result = await addBonsaiRecord({ bonsaiId: '' })
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('contentが2000文字を超える場合 ERR_INVALID_INPUT を返す', async () => {
    const { addBonsaiRecord } = await importModule()
    const result = await addBonsaiRecord({ bonsaiId: 'b1', content: 'a'.repeat(2001) })
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('画像が上限（4枚）を超える場合 ERR_INVALID_INPUT を返す', async () => {
    const { addBonsaiRecord } = await importModule()
    const result = await addBonsaiRecord({
      bonsaiId: 'b1',
      imageUrls: Array.from({ length: 5 }, (_, i) => `https://example.com/img${i}.jpg`),
    })
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('バリデーション失敗時はDBに書き込まない', async () => {
    const { addBonsaiRecord } = await importModule()
    await addBonsaiRecord({ bonsaiId: '' })
    expect(mockPrisma.bonsaiRecord.create).not.toHaveBeenCalled()
  })

  it('画像4枚ちょうどはバリデーションを通過する（ERR_INVALID_INPUTにならない）', async () => {
    const { addBonsaiRecord } = await importModule()
    const result = await addBonsaiRecord({
      bonsaiId: 'b1',
      imageUrls: Array.from({ length: 4 }, (_, i) => `https://example.com/img${i}.jpg`),
    })
    // 画像枚数バリデーションは通過（後続の認証・所有権チェックでエラーの可能性あり）
    if (!result.success) {
      expect(result.error).not.toBe('入力データが不正です')
    }
  })

  it('画像URLに空文字が含まれる場合 ERR_INVALID_INPUT を返す', async () => {
    const { addBonsaiRecord } = await importModule()
    const result = await addBonsaiRecord({
      bonsaiId: 'b1',
      imageUrls: ['https://example.com/img.jpg', ''],
    })
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })
})

describe('bonsai-record.ts — updateBonsaiRecord バリデーション・レート制限', () => {
  const importModule = () => import('@/lib/actions/bonsai-record')

  it('recordIdが空の場合 ERR_INVALID_INPUT を返す', async () => {
    const { updateBonsaiRecord } = await importModule()
    const result = await updateBonsaiRecord('', { content: 'test' })
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('レート制限超過時に ERR_RATE_LIMIT_OPERATION を返す', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { updateBonsaiRecord } = await importModule()
    const result = await updateBonsaiRecord('r1', { content: 'test' })
    expect(result).toEqual({
      success: false,
      error: '操作が多すぎます。しばらく待ってから再試行してください',
    })
  })

  it('レート制限超過時はDBに書き込まない', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { updateBonsaiRecord } = await importModule()
    await updateBonsaiRecord('r1', { content: 'test' })
    expect(mockPrisma.bonsaiRecord.update).not.toHaveBeenCalled()
  })
})

describe('bonsai-record.ts — deleteBonsaiRecord バリデーション・レート制限', () => {
  const importModule = () => import('@/lib/actions/bonsai-record')

  it('recordIdが空の場合 ERR_INVALID_INPUT を返す', async () => {
    const { deleteBonsaiRecord } = await importModule()
    const result = await deleteBonsaiRecord('')
    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('レート制限超過時に ERR_RATE_LIMIT_OPERATION を返す', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { deleteBonsaiRecord } = await importModule()
    const result = await deleteBonsaiRecord('r1')
    expect(result).toEqual({
      success: false,
      error: '操作が多すぎます。しばらく待ってから再試行してください',
    })
  })

  it('レート制限超過時はDBに書き込まない', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { deleteBonsaiRecord } = await importModule()
    await deleteBonsaiRecord('r1')
    expect(mockPrisma.bonsaiRecord.delete).not.toHaveBeenCalled()
  })
})

// ============================================================
// feed.ts — レート制限失敗パス
// ============================================================

describe('feed.ts — getTimeline レート制限', () => {
  const importModule = () => import('@/lib/actions/feed')

  it('レート制限超過時にposts空配列とエラーメッセージを返す', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { getTimeline } = await importModule()
    const result = unwrap(await getTimeline())

    expect(result.posts).toEqual([])
    expect(result.error).toBe('操作が多すぎます。しばらく待ってから再試行してください')
    expect(result.nextCursor).toBeUndefined()
  })
})

describe('feed.ts — getRecommendedUsers レート制限', () => {
  const importModule = () => import('@/lib/actions/feed')

  it('レート制限超過時にusers空配列を返す（サイレントフェイルバック）', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { getRecommendedUsers } = await importModule()
    const result = await getRecommendedUsers()

    expect(result).toEqual({ users: [] })
    // DBクエリは発行されないことを確認
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
  })
})

// ============================================================
// message.ts — sendMessage レート制限失敗パス
// ============================================================

describe('message.ts — sendMessage レート制限', () => {
  const importModule = () => import('@/lib/actions/message')

  it('レート制限超過時に ERR_RATE_LIMIT_OPERATION を返す', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'テストメッセージ')
    expect(result).toEqual({
      success: false,
      error: '操作が多すぎます。しばらく待ってから再試行してください',
    })
  })

  it('レート制限超過時はメッセージをDBに保存しない', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { sendMessage } = await importModule()
    await sendMessage('conv-1', 'テストメッセージ')
    expect(mockPrisma.message.create).not.toHaveBeenCalled()
  })
})
