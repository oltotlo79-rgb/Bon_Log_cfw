// @vitest-environment node
/**
 * lib/services/bonsai-service のユニットテスト
 *
 * listBonsaiV1 / getBonsaiV1 / createBonsaiV1 / updateBonsaiV1 / deleteBonsaiV1
 * の所有者チェック・カーソル・バリデーション・メディア削除・エラー系を網羅する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockBonsaiFindMany = vi.fn()
const mockBonsaiFindUnique = vi.fn()
const mockBonsaiFindFirst = vi.fn()
const mockBonsaiCreate = vi.fn()
const mockBonsaiUpdate = vi.fn()
const mockBonsaiDelete = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    bonsai: {
      findMany: (...args: unknown[]) => mockBonsaiFindMany(...args),
      findUnique: (...args: unknown[]) => mockBonsaiFindUnique(...args),
      findFirst: (...args: unknown[]) => mockBonsaiFindFirst(...args),
      create: (...args: unknown[]) => mockBonsaiCreate(...args),
      update: (...args: unknown[]) => mockBonsaiUpdate(...args),
      delete: (...args: unknown[]) => mockBonsaiDelete(...args),
    },
  },
}))

// ──────────────────────────────────────────────────
// Mock: deleteMediaFiles
// ──────────────────────────────────────────────────
const mockDeleteMediaFiles = vi.fn()
vi.mock('@/lib/services/media-cleanup', () => ({
  deleteMediaFiles: (...args: unknown[]) => mockDeleteMediaFiles(...args),
}))

// ──────────────────────────────────────────────────
// Mock: logger
// ──────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ──────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────
const OWNER_ID = 'user-owner'
const OTHER_ID = 'user-other'
const BONSAI_ID = 'bonsai-cjld2'

const baseBonsai = {
  id: BONSAI_ID,
  userId: OWNER_ID,
  name: '黒松',
  species: '黒松',
  acquiredAt: new Date('2020-01-01'),
  description: 'テスト盆栽',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  _count: { records: 3 },
}

// ──────────────────────────────────────────────────
// listBonsaiV1
// ──────────────────────────────────────────────────
describe('listBonsaiV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常系: items と nextCursor を返す', async () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      ...baseBonsai,
      id: `bonsai-${i}`,
      records: [],
      _count: { records: 0 },
    }))
    mockBonsaiFindMany.mockResolvedValue(items)

    const { listBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await listBonsaiV1(OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('expected ok')
    expect(result.items).toHaveLength(3)
    expect(result.nextCursor).toBeNull()
  })

  it('limit と同数が返った場合 nextCursor が設定される', async () => {
    const limit = 2
    const items = Array.from({ length: limit }, (_, i) => ({
      ...baseBonsai,
      id: `bonsai-${i}`,
      records: [],
      _count: { records: 0 },
    }))
    mockBonsaiFindMany.mockResolvedValue(items)

    const { listBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await listBonsaiV1(OWNER_ID, undefined, limit)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('expected ok')
    expect(result.nextCursor).toBe(`bonsai-${limit - 1}`)
  })

  it('cursor を渡すと skip:1 + cursor が使われる', async () => {
    mockBonsaiFindMany.mockResolvedValue([])

    const { listBonsaiV1 } = await import('@/lib/services/bonsai-service')
    await listBonsaiV1(OWNER_ID, 'cursor-abc', 10)

    expect(mockBonsaiFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'cursor-abc' }, skip: 1 }),
    )
  })

  it('latestRecord がある場合にマッピングされる', async () => {
    const bonsaiWithRecord = {
      ...baseBonsai,
      _count: { records: 1 },
      records: [
        {
          id: 'record-1',
          content: 'テスト記録',
          recordAt: new Date('2024-03-01'),
          images: [{ url: '/uploads/thumb.webp', sortOrder: 0 }],
        },
      ],
    }
    mockBonsaiFindMany.mockResolvedValue([bonsaiWithRecord])

    const { listBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await listBonsaiV1(OWNER_ID)

    if (!result.ok) throw new Error('expected ok')
    expect(result.items[0]?.latestRecord).toMatchObject({
      id: 'record-1',
      content: 'テスト記録',
      thumbnailUrl: '/uploads/thumb.webp',
    })
  })

  it('latestRecord が画像なしの場合 thumbnailUrl が null', async () => {
    const bonsaiWithRecord = {
      ...baseBonsai,
      _count: { records: 1 },
      records: [
        {
          id: 'record-1',
          content: 'テスト記録',
          recordAt: new Date('2024-03-01'),
          images: [],
        },
      ],
    }
    mockBonsaiFindMany.mockResolvedValue([bonsaiWithRecord])

    const { listBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await listBonsaiV1(OWNER_ID)

    if (!result.ok) throw new Error('expected ok')
    expect(result.items[0]?.latestRecord?.thumbnailUrl).toBeNull()
  })

  it('prisma が例外を throw → { ok: false, status: 500 }', async () => {
    mockBonsaiFindMany.mockRejectedValue(new Error('DB crash'))

    const { listBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await listBonsaiV1(OWNER_ID)

    expect(result).toMatchObject({ ok: false, status: 500 })
  })

  it('records の orderBy が recordAt desc + id desc の複合キー配列である（recordAt 同時刻のタイブレーク、項目9）', async () => {
    mockBonsaiFindMany.mockResolvedValue([])

    const { listBonsaiV1 } = await import('@/lib/services/bonsai-service')
    await listBonsaiV1(OWNER_ID)

    const call = mockBonsaiFindMany.mock.calls[0]?.[0] as {
      include: { records: { orderBy: unknown } }
    }
    expect(call.include.records.orderBy).toEqual([{ recordAt: 'desc' }, { id: 'desc' }])
  })
})

// ──────────────────────────────────────────────────
// getBonsaiV1
// ──────────────────────────────────────────────────
describe('getBonsaiV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常系: 盆栽詳細を返す', async () => {
    mockBonsaiFindUnique.mockResolvedValue({ ...baseBonsai })

    const { getBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await getBonsaiV1(OWNER_ID, BONSAI_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('expected ok')
    expect(result.bonsai.id).toBe(BONSAI_ID)
    expect(result.bonsai.name).toBe('黒松')
  })

  it('存在しない ID → 404', async () => {
    mockBonsaiFindUnique.mockResolvedValue(null)

    const { getBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await getBonsaiV1(OWNER_ID, 'nonexistent')

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('他人の盆栽 → 404（IDOR 秘匿）', async () => {
    mockBonsaiFindUnique.mockResolvedValue({ ...baseBonsai })

    const { getBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await getBonsaiV1(OTHER_ID, BONSAI_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('prisma が例外を throw → { ok: false, status: 500 }', async () => {
    mockBonsaiFindUnique.mockRejectedValue(new Error('DB crash'))

    const { getBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await getBonsaiV1(OWNER_ID, BONSAI_ID)

    expect(result).toMatchObject({ ok: false, status: 500 })
  })
})

// ──────────────────────────────────────────────────
// createBonsaiV1
// ──────────────────────────────────────────────────
describe('createBonsaiV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiCreate.mockResolvedValue({ ...baseBonsai })
  })

  it('正常系: 作成した盆栽を返す', async () => {
    const { createBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await createBonsaiV1(OWNER_ID, { name: '黒松' })

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('expected ok')
    expect(result.bonsai.name).toBe('黒松')
    expect(mockBonsaiCreate).toHaveBeenCalledTimes(1)
  })

  it('name が空文字 → 400（Zod バリデーション失敗）', async () => {
    const { createBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await createBonsaiV1(OWNER_ID, { name: '' })

    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mockBonsaiCreate).not.toHaveBeenCalled()
  })

  it('name が 101 文字 → 400（MAX_BONSAI_NAME_LENGTH = 100）', async () => {
    const { createBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await createBonsaiV1(OWNER_ID, { name: 'a'.repeat(101) })

    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mockBonsaiCreate).not.toHaveBeenCalled()
  })

  it('name が 100 文字 → 正常系', async () => {
    const { createBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await createBonsaiV1(OWNER_ID, { name: 'a'.repeat(100) })

    expect(result).toMatchObject({ ok: true })
  })

  it('species が 101 文字 → 400', async () => {
    const { createBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await createBonsaiV1(OWNER_ID, { name: '黒松', species: 'a'.repeat(101) })

    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('description が 2001 文字 → 400（MAX_BONSAI_DESCRIPTION_LENGTH = 2000）', async () => {
    const { createBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await createBonsaiV1(OWNER_ID, {
      name: '黒松',
      description: 'a'.repeat(2001),
    })

    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('acquiredAt に有効な ISO 日時文字列を渡すと DB に Date として保存される', async () => {
    const { createBonsaiV1 } = await import('@/lib/services/bonsai-service')
    await createBonsaiV1(OWNER_ID, { name: '黒松', acquiredAt: '2020-01-01T00:00:00.000Z' })

    expect(mockBonsaiCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acquiredAt: new Date('2020-01-01T00:00:00.000Z'),
        }),
      }),
    )
  })

  it('prisma.bonsai.create が例外を throw → { ok: false, status: 500 }', async () => {
    mockBonsaiCreate.mockRejectedValue(new Error('DB crash'))

    const { createBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await createBonsaiV1(OWNER_ID, { name: '黒松' })

    expect(result).toMatchObject({ ok: false, status: 500 })
  })
})

// ──────────────────────────────────────────────────
// updateBonsaiV1
// ──────────────────────────────────────────────────
describe('updateBonsaiV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiFindFirst.mockResolvedValue({ ...baseBonsai })
    mockBonsaiUpdate.mockResolvedValue({ ...baseBonsai, name: '更新後' })
  })

  it('正常系: 更新した盆栽を返す', async () => {
    const { updateBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await updateBonsaiV1(OWNER_ID, BONSAI_ID, { name: '更新後' })

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('expected ok')
    expect(result.bonsai.name).toBe('更新後')
  })

  it('他人の盆栽（findFirst が null） → 404', async () => {
    mockBonsaiFindFirst.mockResolvedValue(null)

    const { updateBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await updateBonsaiV1(OTHER_ID, BONSAI_ID, { name: '更新後' })

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockBonsaiUpdate).not.toHaveBeenCalled()
  })

  it('acquiredAt: null を渡すと DB 上の値をクリアする', async () => {
    const { updateBonsaiV1 } = await import('@/lib/services/bonsai-service')
    await updateBonsaiV1(OWNER_ID, BONSAI_ID, { acquiredAt: null })

    expect(mockBonsaiUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acquiredAt: null }),
      }),
    )
  })

  it('acquiredAt: undefined の場合は DB 上の値を変更しない', async () => {
    const { updateBonsaiV1 } = await import('@/lib/services/bonsai-service')
    await updateBonsaiV1(OWNER_ID, BONSAI_ID, { name: '更新後' })

    const callArg = mockBonsaiUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArg?.data.acquiredAt).toBeUndefined()
  })

  it('name が 101 文字 → Zod エラー 400', async () => {
    const { updateBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await updateBonsaiV1(OWNER_ID, BONSAI_ID, { name: 'a'.repeat(101) })

    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mockBonsaiUpdate).not.toHaveBeenCalled()
  })

  it('prisma.bonsai.update が例外を throw → { ok: false, status: 500 }', async () => {
    mockBonsaiUpdate.mockRejectedValue(new Error('DB crash'))

    const { updateBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await updateBonsaiV1(OWNER_ID, BONSAI_ID, { name: '更新後' })

    expect(result).toMatchObject({ ok: false, status: 500 })
  })
})

// ──────────────────────────────────────────────────
// deleteBonsaiV1
// ──────────────────────────────────────────────────
describe('deleteBonsaiV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiFindFirst.mockResolvedValue({
      ...baseBonsai,
      records: [
        { images: [{ url: '/uploads/img1.webp' }, { url: '/uploads/img2.webp' }] },
        { images: [] },
      ],
    })
    mockBonsaiDelete.mockResolvedValue(undefined)
    mockDeleteMediaFiles.mockResolvedValue(undefined)
  })

  it('正常系: { ok: true } を返す', async () => {
    const { deleteBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await deleteBonsaiV1(OWNER_ID, BONSAI_ID)

    expect(result).toEqual({ ok: true })
  })

  it('他人の盆栽（findFirst が null） → 404', async () => {
    mockBonsaiFindFirst.mockResolvedValue(null)

    const { deleteBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await deleteBonsaiV1(OTHER_ID, BONSAI_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockBonsaiDelete).not.toHaveBeenCalled()
  })

  it('存在しない ID → 404', async () => {
    mockBonsaiFindFirst.mockResolvedValue(null)

    const { deleteBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await deleteBonsaiV1(OWNER_ID, 'nonexistent')

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('deleteMediaFiles が記録の全画像 URL で呼ばれる（カスケード検証）', async () => {
    const { deleteBonsaiV1 } = await import('@/lib/services/bonsai-service')
    await deleteBonsaiV1(OWNER_ID, BONSAI_ID)

    expect(mockDeleteMediaFiles).toHaveBeenCalledWith(['/uploads/img1.webp', '/uploads/img2.webp'])
  })

  it('画像が存在しない場合も deleteMediaFiles が空配列で呼ばれる', async () => {
    mockBonsaiFindFirst.mockResolvedValue({
      ...baseBonsai,
      records: [],
    })

    const { deleteBonsaiV1 } = await import('@/lib/services/bonsai-service')
    await deleteBonsaiV1(OWNER_ID, BONSAI_ID)

    expect(mockDeleteMediaFiles).toHaveBeenCalledWith([])
  })

  it('prisma.bonsai.delete が例外を throw → { ok: false, status: 500 }', async () => {
    mockBonsaiDelete.mockRejectedValue(new Error('FK constraint'))

    const { deleteBonsaiV1 } = await import('@/lib/services/bonsai-service')
    const result = await deleteBonsaiV1(OWNER_ID, BONSAI_ID)

    expect(result).toMatchObject({ ok: false, status: 500 })
  })
})
