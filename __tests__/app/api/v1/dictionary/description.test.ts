// @vitest-environment node
/**
 * GET /api/v1/dictionary — description フィールドの検証（G-2）
 *
 * listDictionaryTerms は description を Prisma で select している。
 * ルートは result をそのまま返すため、レスポンスの items[].description が
 * 文字列として含まれることを検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const USER_ID = 'user-dict-desc'

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

const mockListDictionaryTerms = vi.fn()
vi.mock('@/lib/services/dictionary-read-service', () => ({
  dictionaryListQuerySchema: {
    safeParse: (input: Record<string, unknown>) => {
      const validCategories = ['樹形', '技術・作業', '管理・育成', '道具・用品', '盆器・鉢', '用土・肥料', '展示・鑑賞']
      const validRows = ['あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行']
      if (input.category !== undefined && !validCategories.includes(input.category as string)) {
        return { success: false, error: { issues: [{ message: '無効なカテゴリです' }] } }
      }
      if (input.row !== undefined && !validRows.includes(input.row as string)) {
        return { success: false, error: { issues: [{ message: '無効な行フィルタです' }] } }
      }
      const limit = input.limit !== undefined ? Number(input.limit) : 20
      return {
        success: true,
        data: {
          cursor: input.cursor,
          limit,
          search: input.search,
          category: input.category,
          row: input.row,
        },
      }
    },
  },
  listDictionaryTerms: (...args: unknown[]) => mockListDictionaryTerms(...args),
}))

const MOCK_TERMS_WITH_DESCRIPTION = [
  {
    id: 't1',
    slug: 'bunjingi',
    term: '文人木',
    reading: 'ぶんじんぎ',
    category: '樹形',
    description: '幹が細く曲がりくねり、枝が少ない樹形。',
  },
  {
    id: 't2',
    slug: 'chokkan',
    term: '直幹',
    reading: 'ちょっかん',
    category: '樹形',
    description: '幹が直立している樹形。模様木の対義。',
  },
]

async function makeRequest(userId: string, searchParams = ''): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email: 'user@example.com' })
  const url = `http://localhost/api/v1/dictionary${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/dictionary — G-2 description フィールド検証', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListDictionaryTerms.mockResolvedValue({ items: MOCK_TERMS_WITH_DESCRIPTION, nextCursor: null })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('items[].description が文字列として含まれる', async () => {
    const req = await makeRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.items[0].description).toBe('string')
  })

  it('description が正しい内容で返される', async () => {
    const req = await makeRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0].description).toBe('幹が細く曲がりくねり、枝が少ない樹形。')
    expect(body.items[1].description).toBe('幹が直立している樹形。模様木の対義。')
  })

  it('全 items に description が含まれる', async () => {
    const req = await makeRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    const body = await res.json()
    for (const item of body.items) {
      expect(item).toHaveProperty('description')
      expect(typeof item.description).toBe('string')
    }
  })

  it('description 付きでも id/slug/term/reading/category が揃っている', async () => {
    const req = await makeRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    const body = await res.json()
    const item = body.items[0]
    expect(item).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      term: expect.any(String),
      reading: expect.any(String),
      category: expect.any(String),
      description: expect.any(String),
    })
  })

  it('ルートは listDictionaryTerms の結果をそのまま返す（変換なし）', async () => {
    const req = await makeRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.nextCursor).toBeNull()
  })

  it('description が空文字列の場合もそのまま返される', async () => {
    mockListDictionaryTerms.mockResolvedValueOnce({
      items: [{ id: 't3', slug: 'test', term: 'テスト', reading: 'てすと', category: '技術・作業', description: '' }],
      nextCursor: null,
    })
    const req = await makeRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/dictionary/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0].description).toBe('')
  })
})
