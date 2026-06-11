// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'
import { revalidatePath } from 'next/cache'

const mockPrisma = createMockPrismaClient()

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/db', () => ({
  get prisma() {
    return mockPrisma
  },
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// Import after mocks
let hidePost: typeof import('@/lib/actions/hide-post').hidePost
let getHiddenPostIds: typeof import('@/lib/actions/hide-post').getHiddenPostIds

beforeAll(async () => {
  const mod = await import('@/lib/actions/hide-post')
  hidePost = mod.hidePost
  getHiddenPostIds = mod.getHiddenPostIds
})

describe('hidePost', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('認証されていない場合エラーを返す', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await hidePost('post-1')

    expect(result).toEqual({ success: false, error: '認証が必要です' })
  })

  it('投稿が存在しない場合エラーを返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrisma.post.findUnique.mockResolvedValue(null)

    const result = await hidePost('post-1')

    expect(result).toEqual({ success: false, error: '投稿が見つかりません' })
  })

  it('自分の投稿を非表示にしようとするとエラーを返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', userId: 'user-1' })

    const result = await hidePost('post-1')

    expect(result).toEqual({ success: false, error: '自分の投稿は非表示にできません' })
  })

  it('正常に投稿を非表示にできる', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', userId: 'user-2' })
    mockPrisma.userHiddenPost.upsert.mockResolvedValue({})

    const result = await hidePost('post-1')

    expect(result).toEqual({ success: true })
    expect(mockPrisma.userHiddenPost.upsert).toHaveBeenCalledWith({
      where: {
        userId_postId: {
          userId: 'user-1',
          postId: 'post-1',
        },
      },
      create: {
        userId: 'user-1',
        postId: 'post-1',
      },
      update: {},
    })
    expect(revalidatePath).toHaveBeenCalledWith('/feed')
  })
})

describe('getHiddenPostIds', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('非表示にした投稿IDの配列を返す', async () => {
    mockPrisma.userHiddenPost.findMany.mockResolvedValue([
      { postId: 'post-1' },
      { postId: 'post-2' },
    ])

    const result = await getHiddenPostIds()

    expect(result).toEqual(['post-1', 'post-2'])
    expect(mockPrisma.userHiddenPost.findMany).toHaveBeenCalledWith({
      where: { userId: expect.any(String) },
      select: { postId: true },
    })
  })

  it('DBエラー時は空配列を返す（エラーリカバリ）', async () => {
    mockPrisma.userHiddenPost.findMany.mockRejectedValue(new Error('DB connection lost'))

    const result = await getHiddenPostIds()

    expect(result).toEqual([])
  })
})

describe('hidePost - edge cases', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('空文字のpostIdを渡すと入力不正エラーを返す', async () => {
    const result = await hidePost('')

    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })

  it('DBのupsertが例外をスローすると非表示失敗エラーを返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', userId: 'user-2' })
    mockPrisma.userHiddenPost.upsert.mockRejectedValue(new Error('DB write error'))

    const result = await hidePost('post-1')

    expect(result).toEqual({ success: false, error: '非表示に失敗しました' })
  })

  it('正常に投稿を非表示にするとrevalidatePathが呼ばれる', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', userId: 'user-2' })
    mockPrisma.userHiddenPost.upsert.mockResolvedValue({})

    await hidePost('post-1')

    expect(revalidatePath).toHaveBeenCalledWith('/feed')
    expect(revalidatePath).toHaveBeenCalledTimes(1)
  })
})
