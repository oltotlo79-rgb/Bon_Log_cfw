// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockBonsai, mockBonsaiRecord } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// revalidatePathモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const mockDeleteMediaFiles = vi.fn()
vi.mock('@/lib/services/media-cleanup', () => ({
  deleteMediaFiles: (...args: unknown[]) => mockDeleteMediaFiles(...args),
}))

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// レート制限モック
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))

// headersモック
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

/** ActionResult 成功レスポンスから data 部を取り出す（型安全） */
function unwrapOk<T>(result: { success: true; data?: unknown } | { success: false; error: string }): T {
  if (!result.success) throw new Error(`Expected success, got error: ${result.error}`)
  if (!result.data) throw new Error('Expected data to be defined')
  return result.data as T
}

describe('Bonsai Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // getBonsais
  // ============================================================

  describe('getBonsais', async () => {
    it('盆栽一覧を取得できる', async () => {
      const mockBonsais = [
        { ...mockBonsai, records: [], _count: { records: 5 } },
      ]
      mockPrisma.bonsai.findMany.mockResolvedValueOnce(mockBonsais)

      const { getBonsais } = await import('@/lib/actions/bonsai')
      const result = await getBonsais()

      const data = unwrapOk<{ bonsais: typeof mockBonsais }>(result)
      expect(data.bonsais).toHaveLength(1)
      expect(data.bonsais[0]!.name).toBe(mockBonsai.name)
    })

    it('引数 userId を信用せず認証済み本人の盆栽のみ取得する', async () => {
      const mockBonsais = [{ ...mockBonsai, records: [], _count: { records: 3 } }]
      mockPrisma.bonsai.findMany.mockResolvedValueOnce(mockBonsais)

      const { getBonsais } = await import('@/lib/actions/bonsai')
      // 旧シグネチャの他者ID引数を渡しても無視され、auth ユーザーで絞られる
      const result = await (getBonsais as unknown as (u: string) => ReturnType<typeof getBonsais>)('other-user-id')

      const data = unwrapOk<{ bonsais: typeof mockBonsais }>(result)
      expect(data.bonsais).toBeDefined()
      expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id },
        })
      )
    })

    it('未認証でユーザーID指定なしの場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getBonsais } = await import('@/lib/actions/bonsai')
      const result = await getBonsais()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('取得に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getBonsais } = await import('@/lib/actions/bonsai')
      const result = await getBonsais()

      expect(result).toMatchObject({ error: '盆栽一覧の取得に失敗しました' })
    })
  })

  // ============================================================
  // getBonsai
  // ============================================================

  describe('getBonsai', async () => {
    it('盆栽詳細を取得できる', async () => {
      mockPrisma.bonsai.findUnique.mockResolvedValueOnce({
        ...mockBonsai,
        user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
        records: [],
        _count: { records: 0 },
      })

      const { getBonsai } = await import('@/lib/actions/bonsai')
      const result = await getBonsai(mockBonsai.id)

      const data = unwrapOk<{ bonsai: { name: string } }>(result)
      expect(data.bonsai.name).toBe(mockBonsai.name)
    })

    it('盆栽が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsai.findUnique.mockResolvedValueOnce(null)

      const { getBonsai } = await import('@/lib/actions/bonsai')
      const result = await getBonsai('nonexistent-id')

      expect(result).toMatchObject({ error: '盆栽が見つかりません' })
    })

    it('非所有者には存在を秘匿してエラーを返す', async () => {
      mockPrisma.bonsai.findUnique.mockResolvedValueOnce({
        ...mockBonsai,
        userId: 'other-owner-id',
        user: { id: 'other-owner-id', nickname: 'Other', avatarUrl: null },
        records: [],
        _count: { records: 0 },
      })

      const { getBonsai } = await import('@/lib/actions/bonsai')
      const result = await getBonsai(mockBonsai.id)

      expect(result).toMatchObject({ error: '盆栽が見つかりません' })
    })

    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getBonsai } = await import('@/lib/actions/bonsai')
      const result = await getBonsai(mockBonsai.id)

      expect(result).toMatchObject({ success: false })
    })

    it('取得に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findUnique.mockRejectedValueOnce(new Error('Database error'))

      const { getBonsai } = await import('@/lib/actions/bonsai')
      const result = await getBonsai(mockBonsai.id)

      expect(result).toMatchObject({ error: '盆栽の取得に失敗しました' })
    })
  })

  // ============================================================
  // createBonsai
  // ============================================================

  describe('createBonsai', async () => {
    it('盆栽を登録できる', async () => {
      mockPrisma.bonsai.create.mockResolvedValueOnce(mockBonsai)

      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({
        name: '黒松',
        species: '黒松',
        description: 'テスト盆栽',
      })

      const data = unwrapOk<{ bonsai: typeof mockBonsai }>(result)
      expect(data.bonsai).toBeDefined()
      expect(mockPrisma.bonsai.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUser.id,
          name: '黒松',
        }),
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({ name: '黒松' })

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('登録に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.create.mockRejectedValueOnce(new Error('Database error'))

      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({ name: '黒松' })

      expect(result).toMatchObject({ error: '盆栽の登録に失敗しました' })
    })
  })

  // ============================================================
  // updateBonsai
  // ============================================================

  describe('updateBonsai', async () => {
    it('盆栽を更新できる', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(mockBonsai)
      mockPrisma.bonsai.update.mockResolvedValueOnce({ ...mockBonsai, name: '更新後の名前' })

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai(mockBonsai.id, { name: '更新後の名前' })

      const data = unwrapOk<{ bonsai: { name: string } }>(result)
      expect(data.bonsai.name).toBe('更新後の名前')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai(mockBonsai.id, { name: '更新' })

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('盆栽が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(null)

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai('nonexistent-id', { name: '更新' })

      expect(result).toMatchObject({ error: '盆栽が見つかりません' })
    })
  })

  // ============================================================
  // deleteBonsai
  // ============================================================

  describe('deleteBonsai', async () => {
    it('盆栽を削除でき、配下レコードのメディア実体も回収する', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce({
        ...mockBonsai,
        records: [
          { images: [{ url: 'https://cdn/rec1-a.webp' }] },
          { images: [{ url: 'https://cdn/rec2-a.webp' }, { url: 'https://cdn/rec2-b.webp' }] },
        ],
      })
      mockPrisma.bonsai.delete.mockResolvedValueOnce(mockBonsai)

      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai(mockBonsai.id)

      expect(result).toEqual({ success: true })
      expect(mockDeleteMediaFiles).toHaveBeenCalledWith([
        'https://cdn/rec1-a.webp',
        'https://cdn/rec2-a.webp',
        'https://cdn/rec2-b.webp',
      ])
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai(mockBonsai.id)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('盆栽が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(null)

      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai('nonexistent-id')

      expect(result).toMatchObject({ error: '盆栽が見つかりません' })
    })
  })

  // ============================================================
  // addBonsaiRecord
  // ============================================================

  describe('addBonsaiRecord', async () => {
    it('成長記録を追加できる', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(mockBonsai)
      mockPrisma.bonsaiRecord.create.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        images: [],
      })

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await addBonsaiRecord({
        bonsaiId: mockBonsai.id,
        content: '水やりしました',
      })

      const data = unwrapOk<{ record: typeof mockBonsaiRecord }>(result)
      expect(data.record).toBeDefined()
    })

    it('画像付きで記録を追加できる', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(mockBonsai)
      mockPrisma.bonsaiRecord.create.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        images: [{ url: '/image.jpg', sortOrder: 0 }],
      })

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await addBonsaiRecord({
        bonsaiId: mockBonsai.id,
        content: '水やりしました',
        imageUrls: ['/image.jpg'],
      })

      const data = unwrapOk<{ record: typeof mockBonsaiRecord }>(result)
      expect(data.record).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await addBonsaiRecord({ bonsaiId: mockBonsai.id })

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('盆栽が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(null)

      const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await addBonsaiRecord({ bonsaiId: 'nonexistent-id' })

      expect(result).toMatchObject({ error: '盆栽が見つかりません' })
    })
  })

  // ============================================================
  // updateBonsaiRecord
  // ============================================================

  describe('updateBonsaiRecord', async () => {
    it('成長記録を更新できる', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        bonsai: { userId: mockUser.id },
      })
      mockPrisma.bonsaiRecord.update.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        content: '更新された内容',
        images: [],
      })

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await updateBonsaiRecord(mockBonsaiRecord.id, { content: '更新された内容' })

      const data = unwrapOk<{ record: { content: string } }>(result)
      expect(data.record.content).toBe('更新された内容')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await updateBonsaiRecord(mockBonsaiRecord.id, { content: '更新' })

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('記録が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValueOnce(null)

      const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await updateBonsaiRecord('nonexistent-id', { content: '更新' })

      expect(result).toMatchObject({ error: '成長記録が見つかりません' })
    })
  })

  // ============================================================
  // deleteBonsaiRecord
  // ============================================================

  describe('deleteBonsaiRecord', async () => {
    it('成長記録を削除できる', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValueOnce({
        ...mockBonsaiRecord,
        bonsai: { userId: mockUser.id },
        bonsaiId: mockBonsai.id,
        images: [],
      })
      mockPrisma.bonsaiRecord.delete.mockResolvedValueOnce(mockBonsaiRecord)

      const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsaiRecord(mockBonsaiRecord.id)

      expect(result).toEqual({ success: true })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsaiRecord(mockBonsaiRecord.id)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('記録が見つからない場合、エラーを返す', async () => {
      mockPrisma.bonsaiRecord.findFirst.mockResolvedValueOnce(null)

      const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsaiRecord('nonexistent-id')

      expect(result).toMatchObject({ error: '成長記録が見つかりません' })
    })
  })

  // ============================================================
  // getBonsaiTimeline
  // ============================================================

  describe('getBonsaiTimeline', async () => {
    it('盆栽タイムラインを取得できる', async () => {
      const mockRecords = [
        {
          ...mockBonsaiRecord,
          bonsai: {
            ...mockBonsai,
            user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
          },
          images: [],
        },
      ]
      mockPrisma.bonsaiRecord.findMany.mockResolvedValueOnce(mockRecords)

      const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiTimeline()

      const data = unwrapOk<{ records: typeof mockRecords; nextCursor?: string }>(result)
      expect(data.records).toHaveLength(1)
    })

    it('エラー時は空配列を返す', async () => {
      mockPrisma.bonsaiRecord.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiTimeline()

      // 例外時もユーザー UX を壊さないため空配列を ActionResult で返却する
      expect(result).toEqual({ success: true, data: { records: [], nextCursor: undefined } })
    })
  })

  // ============================================================
  // getBonsaiRecords
  // ============================================================

  describe('getBonsaiRecords', async () => {
    beforeEach(() => {
      // 所有者一致を既定とする（マイ盆栽の所有者チェックを通過させる）
      mockPrisma.bonsai.findUnique.mockResolvedValue({ userId: mockUser.id })
    })

    it('特定盆栽の成長記録一覧を取得できる', async () => {
      const mockRecords = [{ ...mockBonsaiRecord, images: [] }]
      mockPrisma.bonsaiRecord.findMany.mockResolvedValueOnce(mockRecords)

      const { getBonsaiRecords } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiRecords(mockBonsai.id)

      const data = unwrapOk<{ records: typeof mockRecords; nextCursor?: string }>(result)
      expect(data.records).toHaveLength(1)
    })

    it('エラー時は空配列を返す', async () => {
      mockPrisma.bonsaiRecord.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getBonsaiRecords } = await import('@/lib/actions/bonsai')
      const result = await getBonsaiRecords(mockBonsai.id)

      expect(result).toEqual({ success: true, data: { records: [], nextCursor: undefined } })
    })
  })

  // ============================================================
  // searchBonsais
  // ============================================================

  describe('searchBonsais', async () => {
    it('盆栽を検索できる', async () => {
      const mockBonsais = [{ ...mockBonsai, records: [], _count: { records: 0 } }]
      mockPrisma.bonsai.findMany.mockResolvedValueOnce(mockBonsais)

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('黒松')

      const data = unwrapOk<{ bonsais: typeof mockBonsais }>(result)
      expect(data.bonsais).toHaveLength(1)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('黒松')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('クエリが長すぎる場合、エラーを返す', async () => {
      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('a'.repeat(101))

      // ActionResult エラー形式で返却される
      expect(result).toMatchObject({ success: false, error: '検索キーワードが長すぎます' })
    })

    it('空文字クエリの場合、全件返す（getBonsaisにフォールバック）', async () => {
      const mockBonsais = [{ ...mockBonsai, records: [], _count: { records: 0 } }]
      mockPrisma.bonsai.findMany.mockResolvedValueOnce(mockBonsais)

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('   ')

      const data = unwrapOk<{ bonsais: typeof mockBonsais }>(result)
      expect(data.bonsais).toBeDefined()
    })

    it('検索エラー時にエラーを返す', async () => {
      mockPrisma.bonsai.findMany.mockRejectedValueOnce(new Error('DB error'))

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      const result = await searchBonsais('黒松')

      expect(result).toMatchObject({ error: '盆栽の検索に失敗しました' })
    })

    it('検索結果が name/species/description の OR 条件で検索される', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValueOnce([])

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      await searchBonsais('テスト')

      expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.id,
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ contains: 'テスト' }) }),
              expect.objectContaining({ species: expect.objectContaining({ contains: 'テスト' }) }),
              expect.objectContaining({ description: expect.objectContaining({ contains: 'テスト' }) }),
            ]),
          }),
        })
      )
    })
  })

  // ============================================================
  // getBonsais - 追加テスト
  // ============================================================

  describe('getBonsais - additional', async () => {
    it('引数で他者IDを渡しても本人の盆栽のみ返す', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValueOnce([])

      const { getBonsais } = await import('@/lib/actions/bonsai')
      const result = await (getBonsais as unknown as (u: string) => ReturnType<typeof getBonsais>)('other-user-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: mockUser.id } }),
      )
    })
  })

  // ============================================================
  // getBonsai - 追加テスト
  // ============================================================

  describe('getBonsai - additional', async () => {
    it('無効なbonsaiIdの場合、エラーを返す', async () => {
      const { getBonsai } = await import('@/lib/actions/bonsai')
      const result = await getBonsai('')

      expect(result).toMatchObject({ error: '無効な盆栽IDです' })
    })
  })

  // ============================================================
  // createBonsai - 追加テスト
  // ============================================================

  describe('createBonsai - additional', async () => {
    it('名前が空の場合、バリデーションエラーを返す', async () => {
      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({ name: '' })

      expect(result).toMatchObject({ error: '入力データが不正です' })
    })

    it('名前が最大文字数を超える場合、バリデーションエラーを返す', async () => {
      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({ name: 'a'.repeat(101) })

      expect(result).toMatchObject({ error: '入力データが不正です' })
    })

    it('レート制限に達した場合、エラーを返す', async () => {
      const { checkUserRateLimit } = await import('@/lib/rate-limit')
      vi.mocked(checkUserRateLimit).mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() })

      const { createBonsai } = await import('@/lib/actions/bonsai')
      const result = await createBonsai({ name: '黒松' })

      expect(result).toMatchObject({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })
  })

  // ============================================================
  // updateBonsai - 追加テスト
  // ============================================================

  describe('updateBonsai - additional', async () => {
    it('無効なbonsaiIdの場合、エラーを返す', async () => {
      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai('', { name: '更新' })

      expect(result).toMatchObject({ error: '無効な盆栽IDです' })
    })

    it('レート制限に達した場合、エラーを返す', async () => {
      const { checkUserRateLimit } = await import('@/lib/rate-limit')
      vi.mocked(checkUserRateLimit).mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() })

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai(mockBonsai.id, { name: '更新' })

      expect(result).toMatchObject({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })

    it('更新に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(mockBonsai)
      mockPrisma.bonsai.update.mockRejectedValueOnce(new Error('DB error'))

      const { updateBonsai } = await import('@/lib/actions/bonsai')
      const result = await updateBonsai(mockBonsai.id, { name: '更新' })

      expect(result).toMatchObject({ error: '盆栽の更新に失敗しました' })
    })
  })

  // ============================================================
  // deleteBonsai - 追加テスト
  // ============================================================

  describe('deleteBonsai - additional', async () => {
    it('無効なbonsaiIdの場合、エラーを返す', async () => {
      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai('')

      expect(result).toMatchObject({ error: '無効な盆栽IDです' })
    })

    it('レート制限に達した場合、エラーを返す', async () => {
      const { checkUserRateLimit } = await import('@/lib/rate-limit')
      vi.mocked(checkUserRateLimit).mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() })

      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai(mockBonsai.id)

      expect(result).toMatchObject({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })

    it('削除に失敗した場合、エラーを返す', async () => {
      mockPrisma.bonsai.findFirst.mockResolvedValueOnce(mockBonsai)
      mockPrisma.bonsai.delete.mockRejectedValueOnce(new Error('DB error'))

      const { deleteBonsai } = await import('@/lib/actions/bonsai')
      const result = await deleteBonsai(mockBonsai.id)

      expect(result).toMatchObject({ error: '盆栽の削除に失敗しました' })
    })
  })
})
