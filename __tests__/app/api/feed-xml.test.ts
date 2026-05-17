import { vi } from 'vitest'
/**
 * RSS Feed API テスト
 */

// グローバルResponseをモック
class MockHeaders {
  private headers: Map<string, string>

  constructor(init?: Record<string, string>) {
    this.headers = new Map(Object.entries(init ?? {}))
  }

  get(name: string): string | null {
    return this.headers.get(name) ?? null
  }

  set(name: string, value: string): void {
    this.headers.set(name, value)
  }
}

class MockResponse {
  body: string
  status: number
  headers: MockHeaders

  constructor(body: string, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body
    this.status = init?.status ?? 200
    this.headers = new MockHeaders(init?.headers)
  }

  text() {
    return Promise.resolve(this.body)
  }
}

// @ts-expect-error - グローバルResponseをモック
global.Response = MockResponse

const mockFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    post: {
      findMany: mockFindMany,
    },
  },
}))

describe('RSS Feed API', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.NEXT_PUBLIC_APP_URL = 'https://bon-log.com'
  })

  it('should return RSS feed with posts', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'post-1',
        content: 'テスト投稿です',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        user: { id: 'user-1', nickname: 'テストユーザー' },
        media: [],
      },
      {
        id: 'post-2',
        content: 'メディア付き投稿',
        createdAt: new Date('2024-01-02T00:00:00Z'),
        user: { id: 'user-2', nickname: 'ユーザー2' },
        media: [{ url: 'https://example.com/image.jpg', type: 'image', sortOrder: 0 }],
      },
    ])

    const { GET } = await import('@/app/feed.xml/route')
    const response = await GET()

    expect(response.headers.get('Content-Type')).toBe('application/rss+xml; charset=utf-8')

    const text = await response.text()
    expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(text).toContain('<rss version="2.0"')
    expect(text).toContain('<title>BON-LOG')
    expect(text).toContain('テスト投稿です')
    expect(text).toContain('テストユーザー')
    expect(text).toContain('/posts/post-1')
  })

  it('should truncate long content in title', async () => {
    const longContent = 'あ'.repeat(100)
    mockFindMany.mockResolvedValue([
      {
        id: 'post-long',
        content: longContent,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        user: { id: 'user-1', nickname: 'User' },
        media: [],
      },
    ])

    const { GET } = await import('@/app/feed.xml/route')
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('あ'.repeat(50) + '...')
  })

  it('should handle posts without content', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'post-empty',
        content: null,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        user: { id: 'user-1', nickname: 'User' },
        media: [],
      },
    ])

    const { GET } = await import('@/app/feed.xml/route')
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('<title>投稿</title>')
  })

  it('should include enclosure for image media', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'post-img',
        content: '画像投稿',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        user: { id: 'user-1', nickname: 'User' },
        media: [{ url: 'https://example.com/photo.jpg', type: 'image', sortOrder: 0 }],
      },
    ])

    const { GET } = await import('@/app/feed.xml/route')
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('enclosure')
    expect(text).toContain('type="image/jpeg"')
  })

  it('should include enclosure for video media', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'post-vid',
        content: '動画投稿',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        user: { id: 'user-1', nickname: 'User' },
        media: [{ url: 'https://example.com/video.mp4', type: 'video', sortOrder: 0 }],
      },
    ])

    const { GET } = await import('@/app/feed.xml/route')
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('enclosure')
    expect(text).toContain('type="video/mp4"')
  })

  it('should escape XML special characters', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'post-special',
        content: '<script>alert("XSS")</script> & "quotes" \'apostrophe\'',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        user: { id: 'user-1', nickname: 'User<Admin>' },
        media: [],
      },
    ])

    const { GET } = await import('@/app/feed.xml/route')
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('&lt;script&gt;')
    expect(text).toContain('&amp;')
    expect(text).toContain('&quot;')
    expect(text).toContain('&apos;')
    expect(text).not.toContain('<script>')
  })

  it('should return empty feed when no posts', async () => {
    mockFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/feed.xml/route')
    const response = await GET()
    const text = await response.text()

    expect(text).toContain('<channel>')
    expect(text).not.toContain('<item>')
  })

  it('should set cache headers', async () => {
    mockFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/feed.xml/route')
    const response = await GET()

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=3600')
  })
})
