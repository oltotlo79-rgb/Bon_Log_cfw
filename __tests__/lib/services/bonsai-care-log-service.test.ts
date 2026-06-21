// @vitest-environment node
/**
 * lib/services/bonsai-care-log-service のユニットテスト
 *
 * listCareLogsV1 / getCareLogV1 / createCareLogV1 / updateCareLogV1 / deleteCareLogV1 の
 * 正常系・バリデーション・所有者チェック・未来日・期間超過・DB エラーを検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BonsaiCareType } from '@prisma/client'

// --- Prisma モック ---
const mockFindFirst = vi.fn()
const mockFindMany = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    bonsaiCareLog: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

// --- logger モック ---
vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// --- server-only モック ---
vi.mock('server-only', () => ({}))

// ──────────────────────────────────────────────────
// テスト用定数
// ──────────────────────────────────────────────────
const USER_ID = 'user-owner-1'
const OTHER_USER_ID = 'user-other-2'
const LOG_ID = 'log-abc-123'

const PAST_DATE = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
const FAR_FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

function makeLog(overrides: Partial<{
  id: string
  type: BonsaiCareType
  performedAt: Date
  note: string | null
}> = {}) {
  return {
    id: LOG_ID,
    type: BonsaiCareType.pesticide,
    performedAt: new Date(PAST_DATE),
    note: null,
    ...overrides,
  }
}

// ===================================================================
// listCareLogsV1
// ===================================================================
describe('listCareLogsV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([])
  })

  it('正常系: ok: true + items 配列を返す', async () => {
    const items = [makeLog(), makeLog({ id: 'log-2' })]
    mockFindMany.mockResolvedValue(items)

    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await listCareLogsV1(USER_ID, {})

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('result not ok')
    expect(result.items).toHaveLength(2)
  })

  it('空の場合 items: [] nextCursor: null を返す', async () => {
    mockFindMany.mockResolvedValue([])

    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await listCareLogsV1(USER_ID, {})

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('result not ok')
    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('件数が limit と等しいとき nextCursor が設定される', async () => {
    const items = Array.from({ length: 20 }, (_, i) => makeLog({ id: `log-${i}` }))
    mockFindMany.mockResolvedValue(items)

    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await listCareLogsV1(USER_ID, { limit: 20 })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('result not ok')
    expect(result.nextCursor).toBe('log-19')
  })

  it('件数が limit 未満のとき nextCursor が null', async () => {
    mockFindMany.mockResolvedValue([makeLog()])

    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await listCareLogsV1(USER_ID, { limit: 20 })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('result not ok')
    expect(result.nextCursor).toBeNull()
  })

  it('from と to の両方指定でフィルタが有効になる', async () => {
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const to = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()

    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await listCareLogsV1(USER_ID, { from, to })

    expect(result.ok).toBe(true)
    const callArg = mockFindMany.mock.calls[0]?.[0] as {
      where: { performedAt?: { gte: Date; lt: Date } }
    }
    expect(callArg.where.performedAt).toBeDefined()
  })

  it('from > to のとき 400 ERR_INVALID_INPUT を返す', async () => {
    const from = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    const to = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await listCareLogsV1(USER_ID, { from, to })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
  })

  it('期間が 367 日超のとき 400 ERR_CARE_LOG_RANGE_TOO_LARGE を返す', async () => {
    const from = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    const to = new Date().toISOString()

    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await listCareLogsV1(USER_ID, { from, to })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
    const { ERR_CARE_LOG_RANGE_TOO_LARGE } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_RANGE_TOO_LARGE)
  })

  it('367 日以内の期間は 200 OK を返す', async () => {
    const from = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000).toISOString()
    const to = new Date().toISOString()

    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await listCareLogsV1(USER_ID, { from, to })

    expect(result.ok).toBe(true)
  })

  it('DB エラー時は 500 ERR_CARE_LOG_LIST_FAILED を返す', async () => {
    mockFindMany.mockRejectedValue(new Error('DB Error'))

    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await listCareLogsV1(USER_ID, {})

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(500)
    const { ERR_CARE_LOG_LIST_FAILED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_LIST_FAILED)
  })

  it('cursor が渡されると findMany に cursor/skip が設定される', async () => {
    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    await listCareLogsV1(USER_ID, { cursor: 'log-cursor-x' })

    const callArg = mockFindMany.mock.calls[0]?.[0] as {
      cursor?: { id: string }
      skip?: number
    }
    expect(callArg.cursor).toEqual({ id: 'log-cursor-x' })
    expect(callArg.skip).toBe(1)
  })

  it('findMany には userId フィルタが渡される', async () => {
    const { listCareLogsV1 } = await import('@/lib/services/bonsai-care-log-service')
    await listCareLogsV1(USER_ID, {})

    const callArg = mockFindMany.mock.calls[0]?.[0] as { where: { userId: string } }
    expect(callArg.where.userId).toBe(USER_ID)
  })
})

// ===================================================================
// getCareLogV1
// ===================================================================
describe('getCareLogV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常系: ok: true + log を返す', async () => {
    const log = makeLog()
    mockFindFirst.mockResolvedValue(log)

    const { getCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await getCareLogV1(USER_ID, LOG_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('result not ok')
    expect(result.log.id).toBe(LOG_ID)
  })

  it('不存在の場合 404 ERR_CARE_LOG_NOT_FOUND を返す', async () => {
    mockFindFirst.mockResolvedValue(null)

    const { getCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await getCareLogV1(USER_ID, 'nonexistent-id')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(404)
    const { ERR_CARE_LOG_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_NOT_FOUND)
  })

  it('他人の logId を指定した場合も 404 を返す（所有者チェック）', async () => {
    // findFirst に userId + id の複合条件が渡るため、他人のログなら null が返る
    mockFindFirst.mockResolvedValue(null)

    const { getCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await getCareLogV1(OTHER_USER_ID, LOG_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(404)
  })

  it('findFirst に userId と id の両方が渡される', async () => {
    mockFindFirst.mockResolvedValue(null)

    const { getCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    await getCareLogV1(USER_ID, LOG_ID)

    const callArg = mockFindFirst.mock.calls[0]?.[0] as {
      where: { id: string; userId: string }
    }
    expect(callArg.where.id).toBe(LOG_ID)
    expect(callArg.where.userId).toBe(USER_ID)
  })

  it('DB エラー時は 500 を返す', async () => {
    mockFindFirst.mockRejectedValue(new Error('DB Error'))

    const { getCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await getCareLogV1(USER_ID, LOG_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(500)
  })
})

// ===================================================================
// createCareLogV1
// ===================================================================
describe('createCareLogV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate.mockResolvedValue({ id: LOG_ID })
  })

  it('正常系: ok: true + id を返す', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: BonsaiCareType.pesticide,
      performedAt: PAST_DATE,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('result not ok')
    expect(result.id).toBe(LOG_ID)
  })

  it('全 BonsaiCareType の各値で正常に作成される', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')

    const types: BonsaiCareType[] = [
      BonsaiCareType.pesticide,
      BonsaiCareType.solid_fertilizer,
      BonsaiCareType.liquid_fertilizer,
      BonsaiCareType.rotate,
      BonsaiCareType.shading,
      BonsaiCareType.muro_in,
      BonsaiCareType.muro_out,
      BonsaiCareType.other,
    ]

    for (const type of types) {
      vi.clearAllMocks()
      mockCreate.mockResolvedValue({ id: `log-${type}` })
      const result = await createCareLogV1(USER_ID, { type, performedAt: PAST_DATE })
      expect(result.ok).toBe(true)
    }
  })

  it('不正な type の場合 400 ERR_INVALID_INPUT を返す', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: 'invalid_type' as BonsaiCareType,
      performedAt: PAST_DATE,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
    const { ERR_INVALID_INPUT } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_INVALID_INPUT)
  })

  it('performedAt 未指定の場合 400 ERR_INVALID_INPUT を返す', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: BonsaiCareType.pesticide,
      performedAt: undefined as unknown as string,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
  })

  it('performedAt が不正フォーマットの場合 400 を返す', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: BonsaiCareType.pesticide,
      performedAt: 'not-a-datetime',
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
  })

  it('note が 500 文字以内の場合は正常', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: BonsaiCareType.other,
      performedAt: PAST_DATE,
      note: 'a'.repeat(500),
    })

    expect(result.ok).toBe(true)
  })

  it('note が 500 文字超の場合 400 ERR_INVALID_INPUT を返す', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: BonsaiCareType.other,
      performedAt: PAST_DATE,
      note: 'a'.repeat(501),
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
  })

  it('performedAt が 1 日超の未来日の場合 400 ERR_CARE_LOG_FUTURE_DATE を返す', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: BonsaiCareType.pesticide,
      performedAt: FAR_FUTURE_DATE,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
    const { ERR_CARE_LOG_FUTURE_DATE } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_FUTURE_DATE)
  })

  it('performedAt が過去日の場合は正常', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: BonsaiCareType.pesticide,
      performedAt: PAST_DATE,
    })

    expect(result.ok).toBe(true)
  })

  it('note なし（undefined）で作成できる', async () => {
    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: BonsaiCareType.rotate,
      performedAt: PAST_DATE,
    })

    expect(result.ok).toBe(true)
    const callArg = mockCreate.mock.calls[0]?.[0] as { data: { note: null } }
    expect(callArg.data.note).toBeNull()
  })

  it('DB エラー時は 500 ERR_CARE_LOG_CREATE_FAILED を返す', async () => {
    mockCreate.mockRejectedValue(new Error('DB Error'))

    const { createCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await createCareLogV1(USER_ID, {
      type: BonsaiCareType.pesticide,
      performedAt: PAST_DATE,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(500)
    const { ERR_CARE_LOG_CREATE_FAILED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_CREATE_FAILED)
  })
})

// ===================================================================
// updateCareLogV1
// ===================================================================
describe('updateCareLogV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindFirst.mockResolvedValue({ id: LOG_ID })
    mockUpdate.mockResolvedValue({})
  })

  it('正常系: ok: true を返す', async () => {
    const { updateCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await updateCareLogV1(USER_ID, LOG_ID, {
      type: BonsaiCareType.solid_fertilizer,
    })

    expect(result.ok).toBe(true)
  })

  it('note を null に更新できる', async () => {
    const { updateCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await updateCareLogV1(USER_ID, LOG_ID, { note: null })

    expect(result.ok).toBe(true)
    const updateArg = mockUpdate.mock.calls[0]?.[0] as { data: { note: null | undefined } }
    expect(updateArg.data.note).toBeNull()
  })

  it('note が 500 文字超の場合 400 を返す', async () => {
    const { updateCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await updateCareLogV1(USER_ID, LOG_ID, { note: 'x'.repeat(501) })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
  })

  it('不正な type で更新しようとすると 400 を返す', async () => {
    const { updateCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await updateCareLogV1(USER_ID, LOG_ID, {
      type: 'invalid_type' as BonsaiCareType,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
  })

  it('performedAt が 1 日超の未来日の場合 400 ERR_CARE_LOG_FUTURE_DATE を返す', async () => {
    const { updateCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await updateCareLogV1(USER_ID, LOG_ID, {
      performedAt: FAR_FUTURE_DATE,
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(400)
    const { ERR_CARE_LOG_FUTURE_DATE } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_FUTURE_DATE)
  })

  it('不存在または他人の logId のとき 404 ERR_CARE_LOG_NOT_FOUND を返す', async () => {
    mockFindFirst.mockResolvedValue(null)

    const { updateCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await updateCareLogV1(USER_ID, 'nonexistent-id', {})

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(404)
    const { ERR_CARE_LOG_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_NOT_FOUND)
  })

  it('他人の userId では 404 を返す（所有者チェック）', async () => {
    mockFindFirst.mockResolvedValue(null)

    const { updateCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await updateCareLogV1(OTHER_USER_ID, LOG_ID, {})

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(404)
  })

  it('findFirst に userId と logId の両方が渡される', async () => {
    const { updateCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    await updateCareLogV1(USER_ID, LOG_ID, {})

    const callArg = mockFindFirst.mock.calls[0]?.[0] as {
      where: { id: string; userId: string }
    }
    expect(callArg.where.id).toBe(LOG_ID)
    expect(callArg.where.userId).toBe(USER_ID)
  })

  it('DB エラー時は 500 ERR_CARE_LOG_UPDATE_FAILED を返す', async () => {
    mockUpdate.mockRejectedValue(new Error('DB Error'))

    const { updateCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await updateCareLogV1(USER_ID, LOG_ID, { type: BonsaiCareType.other })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(500)
    const { ERR_CARE_LOG_UPDATE_FAILED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_UPDATE_FAILED)
  })
})

// ===================================================================
// deleteCareLogV1
// ===================================================================
describe('deleteCareLogV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFindFirst.mockResolvedValue({ id: LOG_ID })
    mockDelete.mockResolvedValue({})
  })

  it('正常系: ok: true を返す', async () => {
    const { deleteCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await deleteCareLogV1(USER_ID, LOG_ID)

    expect(result.ok).toBe(true)
  })

  it('不存在の logId のとき 404 ERR_CARE_LOG_NOT_FOUND を返す', async () => {
    mockFindFirst.mockResolvedValue(null)

    const { deleteCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await deleteCareLogV1(USER_ID, 'nonexistent-id')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(404)
    const { ERR_CARE_LOG_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_NOT_FOUND)
  })

  it('他人の userId では 404 を返す（所有者チェック）', async () => {
    mockFindFirst.mockResolvedValue(null)

    const { deleteCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await deleteCareLogV1(OTHER_USER_ID, LOG_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(404)
  })

  it('findFirst に userId と logId の両方が渡される', async () => {
    const { deleteCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    await deleteCareLogV1(USER_ID, LOG_ID)

    const callArg = mockFindFirst.mock.calls[0]?.[0] as {
      where: { id: string; userId: string }
    }
    expect(callArg.where.id).toBe(LOG_ID)
    expect(callArg.where.userId).toBe(USER_ID)
  })

  it('削除後に prisma.bonsaiCareLog.delete が呼ばれる', async () => {
    const { deleteCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    await deleteCareLogV1(USER_ID, LOG_ID)

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: LOG_ID } })
  })

  it('DB エラー時は 500 ERR_CARE_LOG_DELETE_FAILED を返す', async () => {
    mockDelete.mockRejectedValue(new Error('DB Error'))

    const { deleteCareLogV1 } = await import('@/lib/services/bonsai-care-log-service')
    const result = await deleteCareLogV1(USER_ID, LOG_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error')
    expect(result.status).toBe(500)
    const { ERR_CARE_LOG_DELETE_FAILED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_CARE_LOG_DELETE_FAILED)
  })
})
