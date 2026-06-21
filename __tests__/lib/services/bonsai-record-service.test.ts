// @vitest-environment node
/**
 * lib/services/bonsai-record-service のユニットテスト
 *
 * listBonsaiRecordsV1 / createBonsaiRecordV1 / updateBonsaiRecordV1 / deleteBonsaiRecordV1
 * の所有者チェック・mediaUrls 検証・カーソル・カスケード削除・エラー系を網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockBonsaiFindUnique = vi.fn()
const mockBonsaiFindFirst = vi.fn()
const mockBonsaiRecordFindMany = vi.fn()
const mockBonsaiRecordFindFirst = vi.fn()
const mockBonsaiRecordCreate = vi.fn()
const mockBonsaiRecordUpdate = vi.fn()
const mockBonsaiRecordDelete = vi.fn()
const mockBonsaiRecordImageDeleteMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    bonsai: {
      findUnique: (...args: unknown[]) => mockBonsaiFindUnique(...args),
      findFirst: (...args: unknown[]) => mockBonsaiFindFirst(...args),
    },
    bonsaiRecord: {
      findMany: (...args: unknown[]) => mockBonsaiRecordFindMany(...args),
      findFirst: (...args: unknown[]) => mockBonsaiRecordFindFirst(...args),
      create: (...args: unknown[]) => mockBonsaiRecordCreate(...args),
      update: (...args: unknown[]) => mockBonsaiRecordUpdate(...args),
      delete: (...args: unknown[]) => mockBonsaiRecordDelete(...args),
    },
    bonsaiRecordImage: {
      deleteMany: (...args: unknown[]) => mockBonsaiRecordImageDeleteMany(...args),
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
// Mock: assertMediaUrlsFromOwnStorage
// ──────────────────────────────────────────────────
const mockAssertMediaUrls = vi.fn()
vi.mock('@/lib/services/media-url-validator', () => ({
  assertMediaUrlsFromOwnStorage: (...args: unknown[]) => mockAssertMediaUrls(...args),
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
const RECORD_ID = 'record-cjld2'

const baseRecord = {
  id: RECORD_ID,
  bonsaiId: BONSAI_ID,
  content: 'テスト記録',
  recordAt: new Date('2024-03-01'),
  images: [],
}

// ──────────────────────────────────────────────────
// listBonsaiRecordsV1
// ──────────────────────────────────────────────────
describe('listBonsaiRecordsV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiFindUnique.mockResolvedValue({ userId: OWNER_ID })
    mockBonsaiRecordFindMany.mockResolvedValue([])
  })

  it('正常系: items と nextCursor を返す', async () => {
    const records = [
      { ...baseRecord, images: [{ url: '/uploads/a.webp', sortOrder: 0 }] },
    ]
    mockBonsaiRecordFindMany.mockResolvedValue(records)

    const { listBonsaiRecordsV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await listBonsaiRecordsV1(OWNER_ID, BONSAI_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('expected ok')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.images[0]?.url).toBe('/uploads/a.webp')
    expect(result.nextCursor).toBeNull()
  })

  it('limit 件丁度返った場合 nextCursor が設定される', async () => {
    const limit = 2
    const records = Array.from({ length: limit }, (_, i) => ({
      ...baseRecord,
      id: `record-${i}`,
      images: [],
    }))
    mockBonsaiRecordFindMany.mockResolvedValue(records)

    const { listBonsaiRecordsV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await listBonsaiRecordsV1(OWNER_ID, BONSAI_ID, undefined, limit)

    if (!result.ok) throw new Error('expected ok')
    expect(result.nextCursor).toBe(`record-${limit - 1}`)
  })

  it('cursor を渡すと skip:1 + cursor が使われる', async () => {
    const { listBonsaiRecordsV1 } = await import('@/lib/services/bonsai-record-service')
    await listBonsaiRecordsV1(OWNER_ID, BONSAI_ID, 'cursor-abc', 10)

    expect(mockBonsaiRecordFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'cursor-abc' }, skip: 1 }),
    )
  })

  it('他人の bonsaiId → 404', async () => {
    mockBonsaiFindUnique.mockResolvedValue({ userId: OTHER_ID })

    const { listBonsaiRecordsV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await listBonsaiRecordsV1(OWNER_ID, BONSAI_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockBonsaiRecordFindMany).not.toHaveBeenCalled()
  })

  it('存在しない bonsaiId → 404', async () => {
    mockBonsaiFindUnique.mockResolvedValue(null)

    const { listBonsaiRecordsV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await listBonsaiRecordsV1(OWNER_ID, 'nonexistent')

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('prisma が例外を throw → { ok: false, status: 500 }', async () => {
    mockBonsaiRecordFindMany.mockRejectedValue(new Error('DB crash'))

    const { listBonsaiRecordsV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await listBonsaiRecordsV1(OWNER_ID, BONSAI_ID)

    expect(result).toMatchObject({ ok: false, status: 500 })
  })
})

// ──────────────────────────────────────────────────
// createBonsaiRecordV1
// ──────────────────────────────────────────────────
describe('createBonsaiRecordV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssertMediaUrls.mockReturnValue(true)
    mockBonsaiFindFirst.mockResolvedValue({ id: BONSAI_ID, userId: OWNER_ID })
    mockBonsaiRecordCreate.mockResolvedValue({ ...baseRecord, images: [] })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 作成した記録を返す（mediaUrls なし）', async () => {
    const { createBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await createBonsaiRecordV1(OWNER_ID, BONSAI_ID, {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: [],
    })

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('expected ok')
    expect(result.record.id).toBe(RECORD_ID)
    expect(mockBonsaiRecordCreate).toHaveBeenCalledTimes(1)
  })

  it('自社ストレージ URL は通る（assertMediaUrls が true）', async () => {
    vi.stubEnv('MOBILE_JWT_SECRET', 'a'.repeat(64))
    mockAssertMediaUrls.mockReturnValue(true)
    mockBonsaiRecordCreate.mockResolvedValue({
      ...baseRecord,
      images: [{ url: 'https://cdn.example.com/img.webp', sortOrder: 0 }],
    })

    const { createBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await createBonsaiRecordV1(OWNER_ID, BONSAI_ID, {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: ['https://cdn.example.com/img.webp'],
    })

    expect(result).toMatchObject({ ok: true })
  })

  it('外部 URL → 400（assertMediaUrls が false）', async () => {
    mockAssertMediaUrls.mockReturnValue(false)

    const { createBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await createBonsaiRecordV1(OWNER_ID, BONSAI_ID, {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: ['https://evil.example.com/spy.gif'],
    })

    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mockBonsaiRecordCreate).not.toHaveBeenCalled()
  })

  it('recordAt が未指定 → Zod エラー 400', async () => {
    const { createBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    // recordAt は必須フィールド。Zod ランタイム検証が型違反を弾くことを確認するため unknown 経由でキャスト
    const result = await createBonsaiRecordV1(
      OWNER_ID,
      BONSAI_ID,
      { mediaUrls: [] } as unknown as Parameters<typeof createBonsaiRecordV1>[2],
    )

    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('mediaUrls が 5 枚超過（MAX_BONSAI_RECORD_IMAGES = 4）→ 400', async () => {
    const { createBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    // assertMediaUrls はモックで true を返すが、Zod が配列長を先に弾く
    const result = await createBonsaiRecordV1(OWNER_ID, BONSAI_ID, {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: [
        'https://cdn.example.com/1.webp',
        'https://cdn.example.com/2.webp',
        'https://cdn.example.com/3.webp',
        'https://cdn.example.com/4.webp',
        'https://cdn.example.com/5.webp',
      ],
    })

    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mockBonsaiRecordCreate).not.toHaveBeenCalled()
  })

  it('他人の bonsaiId → 404', async () => {
    mockBonsaiFindFirst.mockResolvedValue(null)

    const { createBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await createBonsaiRecordV1(OTHER_ID, BONSAI_ID, {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: [],
    })

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockBonsaiRecordCreate).not.toHaveBeenCalled()
  })

  it('存在しない bonsaiId → 404', async () => {
    mockBonsaiFindFirst.mockResolvedValue(null)

    const { createBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await createBonsaiRecordV1(OWNER_ID, 'nonexistent', {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: [],
    })

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('prisma.bonsaiRecord.create が例外 → { ok: false, status: 500 }', async () => {
    mockBonsaiRecordCreate.mockRejectedValue(new Error('DB crash'))

    const { createBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await createBonsaiRecordV1(OWNER_ID, BONSAI_ID, {
      recordAt: '2024-03-01T00:00:00.000Z',
      mediaUrls: [],
    })

    expect(result).toMatchObject({ ok: false, status: 500 })
  })
})

// ──────────────────────────────────────────────────
// updateBonsaiRecordV1
// ──────────────────────────────────────────────────
describe('updateBonsaiRecordV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssertMediaUrls.mockReturnValue(true)
    mockBonsaiRecordFindFirst.mockResolvedValue({
      id: RECORD_ID,
      bonsaiId: BONSAI_ID,
      bonsai: { userId: OWNER_ID },
    })
    mockBonsaiRecordImageDeleteMany.mockResolvedValue(undefined)
    mockBonsaiRecordUpdate.mockResolvedValue({ ...baseRecord, images: [] })
  })

  it('正常系: 更新した記録を返す', async () => {
    const { updateBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await updateBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID, {
      content: '更新後',
    })

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('expected ok')
    expect(result.record.id).toBe(RECORD_ID)
  })

  it('他人の bonsai → 404（所有者チェック）', async () => {
    mockBonsaiRecordFindFirst.mockResolvedValue({
      id: RECORD_ID,
      bonsaiId: BONSAI_ID,
      bonsai: { userId: OTHER_ID },
    })

    const { updateBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await updateBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID, { content: '更新後' })

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockBonsaiRecordUpdate).not.toHaveBeenCalled()
  })

  it('bonsaiId パス改ざん（recordId の bonsaiId が一致しない）→ 404', async () => {
    mockBonsaiRecordFindFirst.mockResolvedValue({
      id: RECORD_ID,
      bonsaiId: 'other-bonsai-id',
      bonsai: { userId: OWNER_ID },
    })

    const { updateBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await updateBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID, { content: '更新後' })

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('存在しない recordId → 404', async () => {
    mockBonsaiRecordFindFirst.mockResolvedValue(null)

    const { updateBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await updateBonsaiRecordV1(OWNER_ID, BONSAI_ID, 'nonexistent', { content: '更新後' })

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('mediaUrls 指定時に既存画像が全削除（全置換）される', async () => {
    const { updateBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    await updateBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID, {
      mediaUrls: ['https://cdn.example.com/new.webp'],
    })

    expect(mockBonsaiRecordImageDeleteMany).toHaveBeenCalledWith({ where: { recordId: RECORD_ID } })
  })

  it('mediaUrls 未指定の場合 deleteMany は呼ばれない', async () => {
    const { updateBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    await updateBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID, { content: '更新後' })

    expect(mockBonsaiRecordImageDeleteMany).not.toHaveBeenCalled()
  })

  it('外部 URL → 400（assertMediaUrls が false）', async () => {
    mockAssertMediaUrls.mockReturnValue(false)

    const { updateBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await updateBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID, {
      mediaUrls: ['https://evil.example.com/spy.gif'],
    })

    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(mockBonsaiRecordUpdate).not.toHaveBeenCalled()
  })

  it('content が 2001 文字 → Zod エラー 400', async () => {
    const { updateBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await updateBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID, {
      content: 'a'.repeat(2001),
    })

    expect(result).toMatchObject({ ok: false, status: 400 })
  })

  it('prisma.bonsaiRecord.update が例外 → { ok: false, status: 500 }', async () => {
    mockBonsaiRecordUpdate.mockRejectedValue(new Error('DB crash'))

    const { updateBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await updateBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID, { content: '更新後' })

    expect(result).toMatchObject({ ok: false, status: 500 })
  })
})

// ──────────────────────────────────────────────────
// deleteBonsaiRecordV1
// ──────────────────────────────────────────────────
describe('deleteBonsaiRecordV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiRecordFindFirst.mockResolvedValue({
      id: RECORD_ID,
      bonsaiId: BONSAI_ID,
      bonsai: { userId: OWNER_ID },
      images: [{ url: '/uploads/rec-img.webp' }],
    })
    mockBonsaiRecordDelete.mockResolvedValue(undefined)
    mockDeleteMediaFiles.mockResolvedValue(undefined)
  })

  it('正常系: { ok: true } を返す', async () => {
    const { deleteBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await deleteBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID)

    expect(result).toEqual({ ok: true })
  })

  it('画像の R2 削除が行われる（deleteMediaFiles 呼び出し確認）', async () => {
    const { deleteBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    await deleteBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID)

    expect(mockDeleteMediaFiles).toHaveBeenCalledWith(['/uploads/rec-img.webp'])
  })

  it('画像なしの場合も deleteMediaFiles が空配列で呼ばれる', async () => {
    mockBonsaiRecordFindFirst.mockResolvedValue({
      id: RECORD_ID,
      bonsaiId: BONSAI_ID,
      bonsai: { userId: OWNER_ID },
      images: [],
    })

    const { deleteBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    await deleteBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID)

    expect(mockDeleteMediaFiles).toHaveBeenCalledWith([])
  })

  it('他人の bonsai → 404', async () => {
    mockBonsaiRecordFindFirst.mockResolvedValue({
      id: RECORD_ID,
      bonsaiId: BONSAI_ID,
      bonsai: { userId: OTHER_ID },
      images: [],
    })

    const { deleteBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await deleteBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
    expect(mockBonsaiRecordDelete).not.toHaveBeenCalled()
  })

  it('bonsaiId パス改ざん → 404', async () => {
    mockBonsaiRecordFindFirst.mockResolvedValue({
      id: RECORD_ID,
      bonsaiId: 'other-bonsai-id',
      bonsai: { userId: OWNER_ID },
      images: [],
    })

    const { deleteBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await deleteBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID)

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('存在しない recordId → 404', async () => {
    mockBonsaiRecordFindFirst.mockResolvedValue(null)

    const { deleteBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await deleteBonsaiRecordV1(OWNER_ID, BONSAI_ID, 'nonexistent')

    expect(result).toMatchObject({ ok: false, status: 404 })
  })

  it('prisma.bonsaiRecord.delete が例外 → { ok: false, status: 500 }', async () => {
    mockBonsaiRecordDelete.mockRejectedValue(new Error('FK constraint'))

    const { deleteBonsaiRecordV1 } = await import('@/lib/services/bonsai-record-service')
    const result = await deleteBonsaiRecordV1(OWNER_ID, BONSAI_ID, RECORD_ID)

    expect(result).toMatchObject({ ok: false, status: 500 })
  })
})
