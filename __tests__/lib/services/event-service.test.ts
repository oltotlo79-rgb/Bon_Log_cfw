// @vitest-environment node
/**
 * lib/services/event-service のユニットテスト
 *
 * listEventsV1 / getEventV1 / createEventV1 / updateEventV1 / deleteEventV1 の
 * 正常系・権限ガード・404・バリデーション・フィルタ・カーソルを網羅する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockEventFindMany = vi.fn()
const mockEventFindUnique = vi.fn()
const mockEventCreate = vi.fn()
const mockEventUpdate = vi.fn()
const mockEventDelete = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    event: {
      findMany: (...args: unknown[]) => mockEventFindMany(...args),
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
      create: (...args: unknown[]) => mockEventCreate(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
      delete: (...args: unknown[]) => mockEventDelete(...args),
    },
  },
}))

// ──────────────────────────────────────────────────
// Mock: logger
// ──────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ──────────────────────────────────────────────────
// Mock: sanitize
// ──────────────────────────────────────────────────
vi.mock('@/lib/sanitize', () => ({
  sanitizeText: (s: string) => s,
  sanitizeUrl: (s: string) => s,
}))

// ──────────────────────────────────────────────────
// テスト用定数
// ──────────────────────────────────────────────────
const OWNER_ID = 'user-owner-id'
const OTHER_ID = 'user-other-id'
const EVENT_ID = 'event-cjld2cyuq001'

const makeEventRecord = (overrides: Record<string, unknown> = {}) => ({
  id: EVENT_ID,
  title: 'テストイベント',
  description: 'テスト説明',
  startDate: new Date('2025-06-01T09:00:00Z'),
  endDate: new Date('2025-06-02T17:00:00Z'),
  prefecture: '東京都',
  city: '渋谷区',
  venue: 'テスト会場',
  organizer: 'テスト主催者',
  admissionFee: '無料',
  hasSales: false,
  externalUrl: 'https://example.com/event',
  isHidden: false,
  createdBy: OWNER_ID,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  creator: {
    id: OWNER_ID,
    nickname: 'オーナー',
    avatarUrl: null,
  },
  ...overrides,
})

// ──────────────────────────────────────────────────
// listEventsV1
// ──────────────────────────────────────────────────
describe('listEventsV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常系: イベント一覧を返す', async () => {
    const record = makeEventRecord()
    mockEventFindMany.mockResolvedValue([record])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    const result = await listEventsV1({})

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: EVENT_ID,
      title: 'テストイベント',
    })
    expect(result.nextCursor).toBeNull()
  })

  it('カーソルページネーション: limit+1 件返されたとき nextCursor を設定する', async () => {
    const records = Array.from({ length: 21 }, (_, i) =>
      makeEventRecord({ id: `event-${i}`, title: `イベント${i}` }),
    )
    mockEventFindMany.mockResolvedValue(records)

    const { listEventsV1 } = await import('@/lib/services/event-service')
    const result = await listEventsV1({ limit: 20 })

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('event-19')
  })

  it('件数がlimit以下なら nextCursor は null', async () => {
    mockEventFindMany.mockResolvedValue([makeEventRecord()])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    const result = await listEventsV1({ limit: 20 })

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.nextCursor).toBeNull()
  })

  it('region フィルタ: isRegionName が true のとき where に prefecture: { in: [...] } を含める', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    await listEventsV1({ region: '関東' })

    const callArgs = mockEventFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(callArgs?.where).toMatchObject({
      prefecture: { in: expect.arrayContaining(['東京都', '神奈川県', '埼玉県']) },
    })
  })

  it('prefecture フィルタ: prefecture 指定時は where に prefecture: { in: [prefecture] } を含める', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    await listEventsV1({ prefecture: '東京都' })

    const callArgs = mockEventFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(callArgs?.where).toMatchObject({
      prefecture: { in: ['東京都'] },
    })
  })

  it('prefecture と region 両方指定時は prefecture が優先される', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    await listEventsV1({ prefecture: '大阪府', region: '関東' })

    const callArgs = mockEventFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    // prefecture: { in: ['大阪府'] } であり、関東の都道府県群ではない
    expect(callArgs?.where).toMatchObject({
      prefecture: { in: ['大阪府'] },
    })
  })

  it('showPast=false（デフォルト）: startDate に { gte: today } が含まれる', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    await listEventsV1({})

    const callArgs = mockEventFindMany.mock.calls[0]?.[0] as {
      where: { startDate?: { gte?: Date } }
    }
    expect(callArgs?.where?.startDate?.gte).toBeInstanceOf(Date)
  })

  it('showPast=true: startDate フィルタが含まれない', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    await listEventsV1({ showPast: 'true' })

    const callArgs = mockEventFindMany.mock.calls[0]?.[0] as {
      where: { startDate?: unknown }
    }
    expect(callArgs?.where?.startDate).toBeUndefined()
  })

  it('year/month 指定: startDate に月範囲フィルタが含まれる', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    await listEventsV1({ year: 2025, month: 5 })

    const callArgs = mockEventFindMany.mock.calls[0]?.[0] as {
      where: { startDate?: { gte?: Date; lt?: Date } }
    }
    const filter = callArgs?.where?.startDate
    expect(filter?.gte).toBeInstanceOf(Date)
    expect(filter?.lt).toBeInstanceOf(Date)
    // 2025年6月1日始まり、7月1日未満
    expect(filter?.gte?.getFullYear()).toBe(2025)
    expect(filter?.gte?.getMonth()).toBe(5)
    expect(filter?.lt?.getMonth()).toBe(6)
  })

  it('isHidden: false が where に含まれる', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    await listEventsV1({})

    const callArgs = mockEventFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(callArgs?.where?.isHidden).toBe(false)
  })

  it('cursor 指定: where に id: { lt: cursor } が含まれる', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    await listEventsV1({ cursor: 'cursor-event-id' })

    const callArgs = mockEventFindMany.mock.calls[0]?.[0] as {
      where: { id?: { lt: string } }
    }
    expect(callArgs?.where?.id).toEqual({ lt: 'cursor-event-id' })
  })

  it('orderBy は startDate 昇順', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    await listEventsV1({})

    const callArgs = mockEventFindMany.mock.calls[0]?.[0] as {
      orderBy: Array<Record<string, string>>
    }
    expect(callArgs?.orderBy?.[0]).toEqual({ startDate: 'asc' })
  })

  it('空リスト: items が [] で nextCursor が null', async () => {
    mockEventFindMany.mockResolvedValue([])

    const { listEventsV1 } = await import('@/lib/services/event-service')
    const result = await listEventsV1({})

    expect(result).toMatchObject({ ok: true, items: [], nextCursor: null })
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockEventFindMany.mockRejectedValue(new Error('DB error'))

    const { listEventsV1 } = await import('@/lib/services/event-service')
    const result = await listEventsV1({})

    expect(result).toMatchObject({ ok: false })
  })
})

// ──────────────────────────────────────────────────
// getEventV1
// ──────────────────────────────────────────────────
describe('getEventV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常系: イベントが存在すれば ok: true と event を返す', async () => {
    const record = makeEventRecord()
    mockEventFindUnique.mockResolvedValue(record)

    const { getEventV1 } = await import('@/lib/services/event-service')
    const result = await getEventV1(EVENT_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.event.id).toBe(EVENT_ID)
    expect(result.event.creator).toBeTruthy()
  })

  it('isHidden: false が where に含まれる（非表示イベントを取得しない）', async () => {
    mockEventFindUnique.mockResolvedValue(null)

    const { getEventV1 } = await import('@/lib/services/event-service')
    await getEventV1(EVENT_ID)

    const callArgs = mockEventFindUnique.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
    }
    expect(callArgs?.where?.isHidden).toBe(false)
  })

  it('イベントが存在しない: ok: false と ERR_EVENT_NOT_FOUND を返す', async () => {
    mockEventFindUnique.mockResolvedValue(null)

    const { getEventV1 } = await import('@/lib/services/event-service')
    const result = await getEventV1('nonexistent-id')

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_EVENT_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_EVENT_NOT_FOUND)
  })

  it('formatEventForApi: startDate と endDate が ISO 文字列で返る', async () => {
    const record = makeEventRecord()
    mockEventFindUnique.mockResolvedValue(record)

    const { getEventV1 } = await import('@/lib/services/event-service')
    const result = await getEventV1(EVENT_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(typeof result.event.startDate).toBe('string')
    expect(typeof result.event.endDate).toBe('string')
  })

  it('creator が null のイベントでも ok: true を返す', async () => {
    const record = makeEventRecord({ creator: null })
    mockEventFindUnique.mockResolvedValue(record)

    const { getEventV1 } = await import('@/lib/services/event-service')
    const result = await getEventV1(EVENT_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.event.creator).toBeNull()
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockEventFindUnique.mockRejectedValue(new Error('DB error'))

    const { getEventV1 } = await import('@/lib/services/event-service')
    const result = await getEventV1(EVENT_ID)

    expect(result).toMatchObject({ ok: false })
  })
})

// ──────────────────────────────────────────────────
// createEventV1
// ──────────────────────────────────────────────────
describe('createEventV1', () => {
  const validInput = {
    title: 'テストイベント',
    startDate: '2025-06-01',
    hasSales: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockEventCreate.mockResolvedValue(makeEventRecord())
  })

  it('正常系: ok: true と作成済みイベントを返す', async () => {
    const { createEventV1 } = await import('@/lib/services/event-service')
    const result = await createEventV1(validInput, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.event.id).toBe(EVENT_ID)
    expect(mockEventCreate).toHaveBeenCalledTimes(1)
  })

  it('userId が data.createdBy として渡される', async () => {
    const { createEventV1 } = await import('@/lib/services/event-service')
    await createEventV1(validInput, OWNER_ID)

    const callArgs = mockEventCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArgs?.data?.createdBy).toBe(OWNER_ID)
  })

  it('startDate が不正な日付文字列なら ok: false と ERR_INVALID_START_DATE', async () => {
    const { createEventV1 } = await import('@/lib/services/event-service')
    const result = await createEventV1({ ...validInput, startDate: 'not-a-date' }, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_INVALID_START_DATE } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_INVALID_START_DATE)
  })

  it('endDate < startDate なら ok: false と ERR_END_BEFORE_START', async () => {
    const { createEventV1 } = await import('@/lib/services/event-service')
    const result = await createEventV1(
      { ...validInput, startDate: '2025-06-10', endDate: '2025-06-01' },
      OWNER_ID,
    )

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_END_BEFORE_START } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_END_BEFORE_START)
  })

  it('endDate が不正な日付文字列なら ok: false と ERR_INVALID_END_DATE', async () => {
    const { createEventV1 } = await import('@/lib/services/event-service')
    const result = await createEventV1(
      { ...validInput, endDate: 'bad-date' },
      OWNER_ID,
    )

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_INVALID_END_DATE } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_INVALID_END_DATE)
  })

  it('endDate === startDate は通る（境界値）', async () => {
    const { createEventV1 } = await import('@/lib/services/event-service')
    const result = await createEventV1(
      { ...validInput, startDate: '2025-06-01', endDate: '2025-06-01' },
      OWNER_ID,
    )

    expect(result).toMatchObject({ ok: true })
  })

  it('externalUrl が null のイベントは ok: true', async () => {
    mockEventCreate.mockResolvedValue(makeEventRecord({ externalUrl: null, endDate: null }))

    const { createEventV1 } = await import('@/lib/services/event-service')
    const result = await createEventV1({ ...validInput, externalUrl: null }, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockEventCreate.mockRejectedValue(new Error('DB error'))

    const { createEventV1 } = await import('@/lib/services/event-service')
    const result = await createEventV1(validInput, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
  })
})

// ──────────────────────────────────────────────────
// updateEventV1
// ──────────────────────────────────────────────────
describe('updateEventV1', () => {
  const existingRecord = {
    createdBy: OWNER_ID,
    startDate: new Date('2025-06-01T00:00:00Z'),
    endDate: new Date('2025-06-02T00:00:00Z'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockEventFindUnique.mockResolvedValue(existingRecord)
    mockEventUpdate.mockResolvedValue(makeEventRecord({ title: '更新後' }))
  })

  it('正常系: ok: true と更新済みイベントを返す', async () => {
    const { updateEventV1 } = await import('@/lib/services/event-service')
    const result = await updateEventV1(EVENT_ID, { title: '更新後' }, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    expect(mockEventUpdate).toHaveBeenCalledTimes(1)
  })

  it('作成者でないユーザーは ERR_EDIT_PERMISSION_DENIED / ok: false', async () => {
    const { updateEventV1 } = await import('@/lib/services/event-service')
    const result = await updateEventV1(EVENT_ID, { title: '変更' }, OTHER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_EDIT_PERMISSION_DENIED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_EDIT_PERMISSION_DENIED)
    expect(mockEventUpdate).not.toHaveBeenCalled()
  })

  it('イベントが存在しない場合 ERR_EVENT_NOT_FOUND / ok: false', async () => {
    mockEventFindUnique.mockResolvedValue(null)

    const { updateEventV1 } = await import('@/lib/services/event-service')
    const result = await updateEventV1('nonexistent', { title: '変更' }, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_EVENT_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_EVENT_NOT_FOUND)
  })

  it('startDate が不正な日付文字列なら ok: false と ERR_INVALID_START_DATE', async () => {
    const { updateEventV1 } = await import('@/lib/services/event-service')
    const result = await updateEventV1(EVENT_ID, { startDate: 'bad' }, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_INVALID_START_DATE } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_INVALID_START_DATE)
  })

  it('endDate < startDate なら ok: false と ERR_END_BEFORE_START', async () => {
    const { updateEventV1 } = await import('@/lib/services/event-service')
    const result = await updateEventV1(
      EVENT_ID,
      { startDate: '2025-06-10', endDate: '2025-06-01' },
      OWNER_ID,
    )

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_END_BEFORE_START } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_END_BEFORE_START)
  })

  it('title のみ更新: updateData に title が含まれる', async () => {
    const { updateEventV1 } = await import('@/lib/services/event-service')
    await updateEventV1(EVENT_ID, { title: '新タイトル' }, OWNER_ID)

    const callArgs = mockEventUpdate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(callArgs?.data?.title).toBe('新タイトル')
  })

  it('endDate を null に更新できる', async () => {
    const { updateEventV1 } = await import('@/lib/services/event-service')
    await updateEventV1(EVENT_ID, { endDate: null }, OWNER_ID)

    const callArgs = mockEventUpdate.mock.calls[0]?.[0] as {
      data: Record<string, unknown>
    }
    expect(callArgs?.data?.endDate).toBeNull()
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockEventUpdate.mockRejectedValue(new Error('DB error'))

    const { updateEventV1 } = await import('@/lib/services/event-service')
    const result = await updateEventV1(EVENT_ID, { title: '更新' }, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
  })
})

// ──────────────────────────────────────────────────
// deleteEventV1
// ──────────────────────────────────────────────────
describe('deleteEventV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEventFindUnique.mockResolvedValue({ createdBy: OWNER_ID })
    mockEventDelete.mockResolvedValue({ id: EVENT_ID })
  })

  it('正常系: ok: true を返す', async () => {
    const { deleteEventV1 } = await import('@/lib/services/event-service')
    const result = await deleteEventV1(EVENT_ID, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    expect(mockEventDelete).toHaveBeenCalledTimes(1)
  })

  it('event.delete に正しい eventId が渡される', async () => {
    const { deleteEventV1 } = await import('@/lib/services/event-service')
    await deleteEventV1(EVENT_ID, OWNER_ID)

    const callArgs = mockEventDelete.mock.calls[0]?.[0] as { where: { id: string } }
    expect(callArgs?.where?.id).toBe(EVENT_ID)
  })

  it('作成者でないユーザーは ERR_PERMISSION_DENIED / ok: false', async () => {
    const { deleteEventV1 } = await import('@/lib/services/event-service')
    const result = await deleteEventV1(EVENT_ID, OTHER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_PERMISSION_DENIED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_PERMISSION_DENIED)
    expect(mockEventDelete).not.toHaveBeenCalled()
  })

  it('イベントが存在しない場合 ERR_EVENT_NOT_FOUND / ok: false', async () => {
    mockEventFindUnique.mockResolvedValue(null)

    const { deleteEventV1 } = await import('@/lib/services/event-service')
    const result = await deleteEventV1('nonexistent', OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_EVENT_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_EVENT_NOT_FOUND)
  })

  it('403 と 404 が区別される（存在しない→404、他人→403）', async () => {
    const { deleteEventV1 } = await import('@/lib/services/event-service')

    // 他人 → 403相当
    const result403 = await deleteEventV1(EVENT_ID, OTHER_ID)
    expect(result403).toMatchObject({ ok: false })
    if (result403.ok) throw new Error('ok=true')
    const { ERR_PERMISSION_DENIED, ERR_EVENT_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result403.error).toBe(ERR_PERMISSION_DENIED)

    // 存在しない → 404相当
    mockEventFindUnique.mockResolvedValue(null)
    const result404 = await deleteEventV1('nonexistent', OWNER_ID)
    expect(result404).toMatchObject({ ok: false })
    if (result404.ok) throw new Error('ok=true')
    expect(result404.error).toBe(ERR_EVENT_NOT_FOUND)
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockEventDelete.mockRejectedValue(new Error('DB error'))

    const { deleteEventV1 } = await import('@/lib/services/event-service')
    const result = await deleteEventV1(EVENT_ID, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
  })
})

// ──────────────────────────────────────────────────
// formatEventForApi（スナップショット相当の構造検証）
// ──────────────────────────────────────────────────
describe('formatEventForApi', () => {
  it('Date フィールドを ISO 文字列に変換する', async () => {
    const record = {
      id: EVENT_ID,
      title: 'テスト',
      description: null,
      startDate: new Date('2025-06-01T00:00:00Z'),
      endDate: new Date('2025-06-02T00:00:00Z'),
      prefecture: null,
      city: null,
      venue: null,
      organizer: null,
      admissionFee: null,
      hasSales: false,
      externalUrl: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      creator: { id: OWNER_ID, nickname: 'オーナー', avatarUrl: null },
    }

    const { formatEventForApi } = await import('@/lib/services/event-service')
    const formatted = formatEventForApi(record as Parameters<typeof formatEventForApi>[0])

    expect(formatted.startDate).toBe('2025-06-01T00:00:00.000Z')
    expect(formatted.endDate).toBe('2025-06-02T00:00:00.000Z')
    expect(formatted.createdAt).toBe('2025-01-01T00:00:00.000Z')
  })

  it('endDate が null のとき null を返す', async () => {
    const record = {
      id: EVENT_ID,
      title: 'テスト',
      description: null,
      startDate: new Date('2025-06-01T00:00:00Z'),
      endDate: null,
      prefecture: null,
      city: null,
      venue: null,
      organizer: null,
      admissionFee: null,
      hasSales: false,
      externalUrl: null,
      createdAt: new Date('2025-01-01T00:00:00Z'),
      creator: null,
    }

    const { formatEventForApi } = await import('@/lib/services/event-service')
    const formatted = formatEventForApi(record as Parameters<typeof formatEventForApi>[0])

    expect(formatted.endDate).toBeNull()
    expect(formatted.creator).toBeNull()
  })
})
