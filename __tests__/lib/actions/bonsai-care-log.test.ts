// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BonsaiCareType } from '@prisma/client'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireActiveNonGuestUser = vi.fn()
vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/utils')>('@/lib/actions/utils')
  return {
    ...actual,
    requireActiveNonGuestUser: (...args: unknown[]) => mockRequireActiveNonGuestUser(...args),
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { care_log_write: { maxRequests: 10, windowMs: 60000 } },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}))

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

import {
  ERR_AUTH_REQUIRED,
  ERR_CARE_LOG_CREATE_FAILED,
  ERR_CARE_LOG_DELETE_FAILED,
  ERR_CARE_LOG_FUTURE_DATE,
  ERR_CARE_LOG_LIST_FAILED,
  ERR_CARE_LOG_NOT_FOUND,
  ERR_CARE_LOG_RANGE_TOO_LARGE,
  ERR_CARE_LOG_UPDATE_FAILED,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'
import { MAX_BONSAI_CARE_NOTE_LENGTH } from '@/lib/constants/limits'

async function importMod() {
  vi.resetModules()
  return import('@/lib/actions/bonsai-care-log')
}

describe('addBonsaiCareLog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証なら認証エラーを返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: ERR_AUTH_REQUIRED })
    const { addBonsaiCareLog } = await importMod()

    const r = await addBonsaiCareLog({
      type: BonsaiCareType.pesticide,
      performedAt: new Date(),
    })

    expect(r).toEqual({ success: false, error: ERR_AUTH_REQUIRED })
    expect(mockPrisma.bonsaiCareLog.create).not.toHaveBeenCalled()
  })

  it('Zod 失敗（不正な type）でエラー', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    const { addBonsaiCareLog } = await importMod()

    // @ts-expect-error: 意図的に不正な値
    const r = await addBonsaiCareLog({ type: 'invalid', performedAt: new Date() })

    expect(r).toEqual({ success: false, error: ERR_INVALID_INPUT })
    expect(mockPrisma.bonsaiCareLog.create).not.toHaveBeenCalled()
  })

  it('note 文字数超過で Zod 失敗', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    const { addBonsaiCareLog } = await importMod()

    const tooLong = 'a'.repeat(MAX_BONSAI_CARE_NOTE_LENGTH + 1)
    const r = await addBonsaiCareLog({
      type: BonsaiCareType.pesticide,
      performedAt: new Date(),
      note: tooLong,
    })

    expect(r).toEqual({ success: false, error: ERR_INVALID_INPUT })
  })

  it('未来日（+2日）で FUTURE_DATE エラー', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    const { addBonsaiCareLog } = await importMod()

    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const r = await addBonsaiCareLog({
      type: BonsaiCareType.pesticide,
      performedAt: future,
    })

    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_FUTURE_DATE })
    expect(mockPrisma.bonsaiCareLog.create).not.toHaveBeenCalled()
  })

  it('正常系: ユーザーID をサーバー側で注入し、id を返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsaiCareLog.create.mockResolvedValue({ id: 'log-1' })
    const { addBonsaiCareLog } = await importMod()

    const r = await addBonsaiCareLog({
      type: BonsaiCareType.pesticide,
      performedAt: new Date(2026, 3, 15),
      note: 'メモ',
    })

    expect(r).toEqual({ success: true, data: { id: 'log-1' } })
    const callArg = mockPrisma.bonsaiCareLog.create.mock.calls[0]?.[0]
    expect(callArg.data.userId).toBe('user-1')
    expect(callArg.data.type).toBe(BonsaiCareType.pesticide)
    expect(callArg.data.note).toBe('メモ')
  })

  it('クライアントから userId を渡しても無視される', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsaiCareLog.create.mockResolvedValue({ id: 'log-1' })
    const { addBonsaiCareLog } = await importMod()

    await addBonsaiCareLog({
      type: BonsaiCareType.pesticide,
      performedAt: new Date(2026, 3, 15),
      // @ts-expect-error: userId はクライアントから受け付けない
      userId: 'user-attacker',
    })

    const callArg = mockPrisma.bonsaiCareLog.create.mock.calls[0]?.[0]
    expect(callArg.data.userId).toBe('user-1')
  })

  it('DB 例外時は CREATE_FAILED', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    mockPrisma.bonsaiCareLog.create.mockRejectedValue(new Error('boom'))
    const { addBonsaiCareLog } = await importMod()

    const r = await addBonsaiCareLog({
      type: BonsaiCareType.pesticide,
      performedAt: new Date(),
    })

    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_CREATE_FAILED })
  })
})

describe('updateBonsaiCareLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未認証で拒否', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: ERR_AUTH_REQUIRED })
    const { updateBonsaiCareLog } = await importMod()
    const r = await updateBonsaiCareLog('log-1', { note: 'x' })
    expect(r).toEqual({ success: false, error: ERR_AUTH_REQUIRED })
  })

  it('空 ID は INVALID_INPUT', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    const { updateBonsaiCareLog } = await importMod()
    const r = await updateBonsaiCareLog('', { note: 'x' })
    expect(r).toEqual({ success: false, error: ERR_INVALID_INPUT })
  })

  it('未来日で FUTURE_DATE', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    const { updateBonsaiCareLog } = await importMod()
    const r = await updateBonsaiCareLog('log-1', {
      performedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_FUTURE_DATE })
  })

  it('他人のログは NOT_FOUND（IDOR 防御）', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'attacker' })
    mockPrisma.bonsaiCareLog.findFirst.mockResolvedValue(null)
    const { updateBonsaiCareLog } = await importMod()

    const r = await updateBonsaiCareLog('victim-log', { note: 'hacked' })

    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_NOT_FOUND })
    expect(mockPrisma.bonsaiCareLog.findFirst).toHaveBeenCalledWith({
      where: { id: 'victim-log', userId: 'attacker' },
      select: { id: true },
    })
    expect(mockPrisma.bonsaiCareLog.update).not.toHaveBeenCalled()
  })

  it('正常系: 自分のログは更新できる', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'owner' })
    mockPrisma.bonsaiCareLog.findFirst.mockResolvedValue({ id: 'log-1' })
    mockPrisma.bonsaiCareLog.update.mockResolvedValue({ id: 'log-1' })
    const { updateBonsaiCareLog } = await importMod()

    const r = await updateBonsaiCareLog('log-1', { note: '更新後' })

    expect(r).toEqual({ success: true })
    const callArg = mockPrisma.bonsaiCareLog.update.mock.calls[0]?.[0]
    expect(callArg.where).toEqual({ id: 'log-1' })
    expect(callArg.data.note).toBe('更新後')
  })

  it('note=null で消去できる', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'owner' })
    mockPrisma.bonsaiCareLog.findFirst.mockResolvedValue({ id: 'log-1' })
    mockPrisma.bonsaiCareLog.update.mockResolvedValue({ id: 'log-1' })
    const { updateBonsaiCareLog } = await importMod()

    await updateBonsaiCareLog('log-1', { note: null })

    const callArg = mockPrisma.bonsaiCareLog.update.mock.calls[0]?.[0]
    expect(callArg.data.note).toBeNull()
  })

  it('DB 例外で UPDATE_FAILED', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'owner' })
    mockPrisma.bonsaiCareLog.findFirst.mockResolvedValue({ id: 'log-1' })
    mockPrisma.bonsaiCareLog.update.mockRejectedValue(new Error('boom'))
    const { updateBonsaiCareLog } = await importMod()

    const r = await updateBonsaiCareLog('log-1', { note: 'x' })
    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_UPDATE_FAILED })
  })
})

describe('deleteBonsaiCareLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未認証で拒否', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: ERR_AUTH_REQUIRED })
    const { deleteBonsaiCareLog } = await importMod()
    const r = await deleteBonsaiCareLog('log-1')
    expect(r).toEqual({ success: false, error: ERR_AUTH_REQUIRED })
  })

  it('空 ID は INVALID_INPUT', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    const { deleteBonsaiCareLog } = await importMod()
    const r = await deleteBonsaiCareLog('')
    expect(r).toEqual({ success: false, error: ERR_INVALID_INPUT })
  })

  it('他人のログは NOT_FOUND', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'attacker' })
    mockPrisma.bonsaiCareLog.findFirst.mockResolvedValue(null)
    const { deleteBonsaiCareLog } = await importMod()

    const r = await deleteBonsaiCareLog('victim-log')

    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_NOT_FOUND })
    expect(mockPrisma.bonsaiCareLog.delete).not.toHaveBeenCalled()
  })

  it('正常系で delete を呼ぶ', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'owner' })
    mockPrisma.bonsaiCareLog.findFirst.mockResolvedValue({ id: 'log-1' })
    mockPrisma.bonsaiCareLog.delete.mockResolvedValue({ id: 'log-1' })
    const { deleteBonsaiCareLog } = await importMod()

    const r = await deleteBonsaiCareLog('log-1')

    expect(r).toEqual({ success: true })
    expect(mockPrisma.bonsaiCareLog.delete).toHaveBeenCalledWith({ where: { id: 'log-1' } })
  })

  it('DB 例外で DELETE_FAILED', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'owner' })
    mockPrisma.bonsaiCareLog.findFirst.mockResolvedValue({ id: 'log-1' })
    mockPrisma.bonsaiCareLog.delete.mockRejectedValue(new Error('boom'))
    const { deleteBonsaiCareLog } = await importMod()

    const r = await deleteBonsaiCareLog('log-1')
    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_DELETE_FAILED })
  })
})

describe('getCareLogsInRange', () => {
  beforeEach(() => vi.clearAllMocks())

  it('未認証で拒否', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: ERR_AUTH_REQUIRED })
    const { getCareLogsInRange } = await importMod()
    const r = await getCareLogsInRange({
      fromIso: '2026-01-01T00:00:00.000Z',
      toIso: '2026-02-01T00:00:00.000Z',
    })
    expect(r).toEqual({ success: false, error: ERR_AUTH_REQUIRED })
  })

  it('Zod 失敗（不正 ISO）で INVALID_INPUT', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    const { getCareLogsInRange } = await importMod()
    const r = await getCareLogsInRange({ fromIso: 'not-iso', toIso: 'also-not-iso' })
    expect(r).toEqual({ success: false, error: ERR_INVALID_INPUT })
  })

  it('to <= from で INVALID_INPUT', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    const { getCareLogsInRange } = await importMod()
    const r = await getCareLogsInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-04-01T00:00:00.000Z',
    })
    expect(r).toEqual({ success: false, error: ERR_INVALID_INPUT })
  })

  it('範囲が 367 日超で RANGE_TOO_LARGE', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'u1' })
    const { getCareLogsInRange } = await importMod()
    const r = await getCareLogsInRange({
      fromIso: '2024-01-01T00:00:00.000Z',
      toIso: '2026-01-01T00:00:00.000Z',
    })
    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_RANGE_TOO_LARGE })
  })

  it('正常系: ログ配列を返す（userId スコープで検索）', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsaiCareLog.findMany.mockResolvedValue([
      { id: 'a', type: BonsaiCareType.pesticide, performedAt: new Date('2026-04-15'), note: null },
    ])
    const { getCareLogsInRange } = await importMod()

    const r = await getCareLogsInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })

    expect(r).toEqual({
      success: true,
      data: { logs: expect.any(Array) },
    })
    const where = mockPrisma.bonsaiCareLog.findMany.mock.calls[0]?.[0]?.where
    expect(where.userId).toBe('user-1')
    expect(where.performedAt.gte).toBeInstanceOf(Date)
    expect(where.performedAt.lt).toBeInstanceOf(Date)
  })

  it('cache 経由で performedAt が ISO 文字列になっても Date に再水和して返す', async () => {
    // unstable_cache は JSON シリアライズで Date を ISO 文字列に降格させる。
    // ここでは findMany が文字列を返すことでその挙動をシミュレートする。
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsaiCareLog.findMany.mockResolvedValue([
      {
        id: 'a',
        type: BonsaiCareType.pesticide,
        performedAt: '2026-04-15T03:00:00.000Z' as unknown as Date,
        note: null,
      },
    ])
    const { getCareLogsInRange } = await importMod()

    const r = await getCareLogsInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })

    expect(r.success).toBe(true)
    const log = r.success ? r.data?.logs?.[0] : null
    expect(log?.performedAt).toBeInstanceOf(Date)
    expect((log?.performedAt as Date).toISOString()).toBe('2026-04-15T03:00:00.000Z')
  })

  it('types フィルタ指定時は type:in 条件を含む', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsaiCareLog.findMany.mockResolvedValue([])
    const { getCareLogsInRange } = await importMod()

    await getCareLogsInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
      types: [BonsaiCareType.pesticide, BonsaiCareType.shading],
    })

    const where = mockPrisma.bonsaiCareLog.findMany.mock.calls[0]?.[0]?.where
    expect(where.type).toEqual({ in: ['pesticide', 'shading'] })
  })

  it('types 空でもフィルタは適用しない', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsaiCareLog.findMany.mockResolvedValue([])
    const { getCareLogsInRange } = await importMod()

    await getCareLogsInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
      types: [],
    })

    const where = mockPrisma.bonsaiCareLog.findMany.mock.calls[0]?.[0]?.where
    expect(where.type).toBeUndefined()
  })

  it('select は最小フィールド (id/type/performedAt/note) のみ', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsaiCareLog.findMany.mockResolvedValue([])
    const { getCareLogsInRange } = await importMod()

    await getCareLogsInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })

    const select = mockPrisma.bonsaiCareLog.findMany.mock.calls[0]?.[0]?.select
    expect(select).toEqual({ id: true, type: true, performedAt: true, note: true })
  })

  it('orderBy: performedAt 昇順', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsaiCareLog.findMany.mockResolvedValue([])
    const { getCareLogsInRange } = await importMod()

    await getCareLogsInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })

    const orderBy = mockPrisma.bonsaiCareLog.findMany.mock.calls[0]?.[0]?.orderBy
    expect(orderBy).toEqual({ performedAt: 'asc' })
  })

  it('DB 例外で LIST_FAILED', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsaiCareLog.findMany.mockRejectedValue(new Error('boom'))
    const { getCareLogsInRange } = await importMod()

    const r = await getCareLogsInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })

    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_LIST_FAILED })
  })
})

describe('getBonsaiCalendarOverlaysInRange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証なら認証エラーを返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: ERR_AUTH_REQUIRED })
    const { getBonsaiCalendarOverlaysInRange } = await importMod()
    const r = await getBonsaiCalendarOverlaysInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })
    expect(r).toEqual({ success: false, error: ERR_AUTH_REQUIRED })
  })

  it('範囲が逆転していれば INVALID_INPUT', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    const { getBonsaiCalendarOverlaysInRange } = await importMod()
    const r = await getBonsaiCalendarOverlaysInRange({
      fromIso: '2026-05-01T00:00:00.000Z',
      toIso: '2026-04-01T00:00:00.000Z',
    })
    expect(r).toEqual({ success: false, error: ERR_INVALID_INPUT })
  })

  it('範囲が大きすぎれば RANGE_TOO_LARGE', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    const { getBonsaiCalendarOverlaysInRange } = await importMod()
    const r = await getBonsaiCalendarOverlaysInRange({
      fromIso: '2024-01-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })
    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_RANGE_TOO_LARGE })
  })

  it('所有盆栽が 0 件なら records / posts は空（DB クエリも実行しない）', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsai.findMany.mockResolvedValue([])
    const { getBonsaiCalendarOverlaysInRange } = await importMod()
    const r = await getBonsaiCalendarOverlaysInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })
    expect(r).toMatchObject({ success: true, data: { records: [], posts: [] } })
    expect(mockPrisma.bonsaiRecord.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.post.findMany).not.toHaveBeenCalled()
  })

  it('所有盆栽の records / posts を整形して返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsai.findMany.mockResolvedValue([
      { id: 'b1', name: '黒松' },
      { id: 'b2', name: '五葉松' },
    ])
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([
      {
        id: 'r1',
        bonsaiId: 'b1',
        content: '剪定',
        recordAt: new Date('2026-04-15T03:00:00.000Z'),
        _count: { images: 2 },
      },
    ])
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        bonsaiId: 'b2',
        content: '日光浴',
        createdAt: new Date('2026-04-20T09:00:00.000Z'),
        _count: { media: 1 },
      },
    ])
    const { getBonsaiCalendarOverlaysInRange } = await importMod()
    const r = await getBonsaiCalendarOverlaysInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data?.records).toEqual([
      {
        id: 'r1',
        bonsaiId: 'b1',
        bonsaiName: '黒松',
        content: '剪定',
        recordAt: new Date('2026-04-15T03:00:00.000Z'),
        imageCount: 2,
      },
    ])
    expect(r.data?.posts).toEqual([
      {
        id: 'p1',
        bonsaiId: 'b2',
        bonsaiName: '五葉松',
        content: '日光浴',
        createdAt: new Date('2026-04-20T09:00:00.000Z'),
        mediaCount: 1,
      },
    ])
  })

  it('Post クエリには isHidden=false が含まれる（モデレーション中の投稿は除外）', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsai.findMany.mockResolvedValue([{ id: 'b1', name: '黒松' }])
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])
    mockPrisma.post.findMany.mockResolvedValue([])
    const { getBonsaiCalendarOverlaysInRange } = await importMod()
    await getBonsaiCalendarOverlaysInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })
    const where = mockPrisma.post.findMany.mock.calls[0]?.[0]?.where
    expect(where.isHidden).toBe(false)
    expect(where.bonsaiId).toEqual({ in: ['b1'] })
  })

  it('cache 経由で recordAt / createdAt が ISO 文字列になっても Date に再水和して返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsai.findMany.mockResolvedValue([{ id: 'b1', name: '黒松' }])
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([
      {
        id: 'r1',
        bonsaiId: 'b1',
        content: null,
        recordAt: '2026-04-15T03:00:00.000Z' as unknown as Date,
        _count: { images: 0 },
      },
    ])
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        bonsaiId: 'b1',
        content: null,
        createdAt: '2026-04-20T09:00:00.000Z' as unknown as Date,
        _count: { media: 0 },
      },
    ])
    const { getBonsaiCalendarOverlaysInRange } = await importMod()
    const r = await getBonsaiCalendarOverlaysInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })
    expect(r.success).toBe(true)
    if (!r.success) return
    expect(r.data?.records?.[0]?.recordAt).toBeInstanceOf(Date)
    expect(r.data?.posts?.[0]?.createdAt).toBeInstanceOf(Date)
  })

  it('DB 例外で LIST_FAILED', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    mockPrisma.bonsai.findMany.mockRejectedValue(new Error('boom'))
    const { getBonsaiCalendarOverlaysInRange } = await importMod()
    const r = await getBonsaiCalendarOverlaysInRange({
      fromIso: '2026-04-01T00:00:00.000Z',
      toIso: '2026-05-01T00:00:00.000Z',
    })
    expect(r).toEqual({ success: false, error: ERR_CARE_LOG_LIST_FAILED })
  })
})
