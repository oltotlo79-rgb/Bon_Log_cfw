// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  default: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

describe('extractHashtags', () => {
  beforeEach(() => vi.clearAllMocks())

  it('英数字のハッシュタグを抽出する', async () => {
    const { extractHashtags } = await import('@/lib/services/hashtag-sync')
    expect(extractHashtags('Hello #bonsai #Garden world')).toEqual(['bonsai', 'garden'])
  })

  it('日本語（ひらがな・カタカナ・漢字）のハッシュタグを抽出する', async () => {
    const { extractHashtags } = await import('@/lib/services/hashtag-sync')
    expect(extractHashtags('今日の #盆栽 #カエデ #ぼんさい')).toEqual([
      '盆栽',
      'カエデ',
      'ぼんさい',
    ])
  })

  it('アンダースコア / 数字を含むタグも抽出する', async () => {
    const { extractHashtags } = await import('@/lib/services/hashtag-sync')
    expect(extractHashtags('#盆栽_入門 #Bonsai2024')).toEqual(['盆栽_入門', 'bonsai2024'])
  })

  it('小文字化される（大文字 → 小文字）', async () => {
    const { extractHashtags } = await import('@/lib/services/hashtag-sync')
    expect(extractHashtags('#BONSAI #Garden')).toEqual(['bonsai', 'garden'])
  })

  it('重複するタグは 1 件のみ返す', async () => {
    const { extractHashtags } = await import('@/lib/services/hashtag-sync')
    expect(extractHashtags('#bonsai #BONSAI #bonsai')).toEqual(['bonsai'])
  })

  it('空文字 / null は空配列', async () => {
    const { extractHashtags } = await import('@/lib/services/hashtag-sync')
    expect(extractHashtags('')).toEqual([])
    // 関数は string を要求するが、null チェックも実装にあるので確認
    expect(extractHashtags(null as unknown as string)).toEqual([])
  })

  it('# のみ・記号のみの不正タグは抽出しない', async () => {
    const { extractHashtags } = await import('@/lib/services/hashtag-sync')
    expect(extractHashtags('# #! #@bad #-')).toEqual([])
  })

  it('絵文字や対応外 Unicode（韓国語ハングルなど）は抽出範囲に含まれない', async () => {
    const { extractHashtags } = await import('@/lib/services/hashtag-sync')
    // ハングル（가-힯）は正規表現の Unicode 範囲外
    expect(extractHashtags('#안녕')).toEqual([])
    expect(extractHashtags('#🌳')).toEqual([])
  })

  it('文中・行頭・行末いずれの位置でも抽出できる', async () => {
    const { extractHashtags } = await import('@/lib/services/hashtag-sync')
    expect(extractHashtags('#first\nmiddle text #middle\n#last')).toEqual([
      'first',
      'middle',
      'last',
    ])
  })
})

describe('attachHashtagsToPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('content が null の場合は何もしない', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    await attachHashtagsToPost('post-1', null)
    expect(mockPrisma.hashtag.upsert).not.toHaveBeenCalled()
    expect(mockPrisma.postHashtag.upsert).not.toHaveBeenCalled()
  })

  it('content にハッシュタグが無ければ何もしない', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    await attachHashtagsToPost('post-1', 'just text without tags')
    expect(mockPrisma.hashtag.upsert).not.toHaveBeenCalled()
  })

  it('抽出したタグを upsert（count を increment）し、PostHashtag も upsert する', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')

    mockPrisma.hashtag.upsert
      .mockResolvedValueOnce({ id: 'h-bonsai', name: 'bonsai', count: 1 })
      .mockResolvedValueOnce({ id: 'h-garden', name: 'garden', count: 1 })

    await attachHashtagsToPost('post-1', 'My #Bonsai #Garden')

    expect(mockPrisma.hashtag.upsert).toHaveBeenCalledTimes(2)
    expect(mockPrisma.hashtag.upsert).toHaveBeenNthCalledWith(1, {
      where: { name: 'bonsai' },
      update: { count: { increment: 1 } },
      create: { name: 'bonsai', count: 1 },
    })
    expect(mockPrisma.hashtag.upsert).toHaveBeenNthCalledWith(2, {
      where: { name: 'garden' },
      update: { count: { increment: 1 } },
      create: { name: 'garden', count: 1 },
    })

    expect(mockPrisma.postHashtag.upsert).toHaveBeenCalledTimes(2)
    expect(mockPrisma.postHashtag.upsert).toHaveBeenNthCalledWith(1, {
      where: { postId_hashtagId: { postId: 'post-1', hashtagId: 'h-bonsai' } },
      update: {},
      create: { postId: 'post-1', hashtagId: 'h-bonsai' },
    })
    expect(mockPrisma.postHashtag.upsert).toHaveBeenNthCalledWith(2, {
      where: { postId_hashtagId: { postId: 'post-1', hashtagId: 'h-garden' } },
      update: {},
      create: { postId: 'post-1', hashtagId: 'h-garden' },
    })

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2)
  })

  it('Prisma エラーは握り潰され logger.error に出力される（投稿作成をブロックしない）', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')

    const dbError = new Error('db connection refused')
    mockPrisma.hashtag.upsert.mockRejectedValue(dbError)

    await expect(attachHashtagsToPost('post-1', 'test #bonsai')).resolves.toBeUndefined()
    expect(mockLoggerError).toHaveBeenCalledWith('Attach hashtags error:', dbError)
  })
})

describe('detachHashtagsFromPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('紐付くタグが無い場合でも例外なく終わる', async () => {
    mockPrisma.postHashtag.findMany.mockResolvedValue([])
    mockPrisma.postHashtag.deleteMany.mockResolvedValue({ count: 0 })

    const { detachHashtagsFromPost } = await import('@/lib/services/hashtag-sync')
    await detachHashtagsFromPost('post-1')

    expect(mockPrisma.postHashtag.deleteMany).toHaveBeenCalledWith({ where: { postId: 'post-1' } })
    // タグが無いため $transaction の追加処理は呼ばれない
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('全タグの count を decrement し、count<=0 の行を deleteMany でまとめて削除する', async () => {
    mockPrisma.postHashtag.findMany.mockResolvedValue([
      { hashtagId: 'h-bonsai', hashtag: { id: 'h-bonsai', name: 'bonsai', count: 1 } },
      { hashtagId: 'h-garden', hashtag: { id: 'h-garden', name: 'garden', count: 5 } },
    ])
    mockPrisma.postHashtag.deleteMany.mockResolvedValue({ count: 2 })
    mockPrisma.hashtag.update.mockResolvedValue({})
    mockPrisma.hashtag.deleteMany.mockResolvedValue({ count: 1 })

    const { detachHashtagsFromPost } = await import('@/lib/services/hashtag-sync')
    await detachHashtagsFromPost('post-1')

    expect(mockPrisma.postHashtag.deleteMany).toHaveBeenCalledWith({ where: { postId: 'post-1' } })
    expect(mockPrisma.hashtag.update).toHaveBeenCalledTimes(2)
    expect(mockPrisma.hashtag.update).toHaveBeenCalledWith({
      where: { id: 'h-bonsai' },
      data: { count: { decrement: 1 } },
    })
    expect(mockPrisma.hashtag.update).toHaveBeenCalledWith({
      where: { id: 'h-garden' },
      data: { count: { decrement: 1 } },
    })
    expect(mockPrisma.hashtag.deleteMany).toHaveBeenCalledWith({ where: { count: { lte: 0 } } })

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('Prisma エラーは握り潰され logger.error に出力される', async () => {
    const dbError = new Error('db down')
    mockPrisma.postHashtag.findMany.mockRejectedValue(dbError)

    const { detachHashtagsFromPost } = await import('@/lib/services/hashtag-sync')
    await expect(detachHashtagsFromPost('post-1')).resolves.toBeUndefined()
    expect(mockLoggerError).toHaveBeenCalledWith('Detach hashtags error:', dbError)
  })
})
