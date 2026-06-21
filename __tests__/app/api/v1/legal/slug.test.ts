// @vitest-environment node
/**
 * GET /api/v1/legal/{slug} — 法的文章詳細（ゲスト可）
 *
 * 200 / 400 / 401 / 429 の全分岐・slug 3種・ゲスト可・
 * sections フォーマット・価格定数埋め込みを検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

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

const mockGetLegalDocument = vi.fn()
vi.mock('@/lib/services/legal-service', () => ({
  getLegalDocument: (...args: unknown[]) => mockGetLegalDocument(...args),
  listLegalDocuments: vi.fn(),
}))

const mockDocuments: Record<string, { slug: string; title: string; updatedAt: string; sections: { heading: string; body: string }[] }> = {
  tokushoho: {
    slug: 'tokushoho',
    title: '特定商取引法に基づく表記',
    updatedAt: '2026-01-01',
    sections: [
      { heading: '販売業者', body: 'BON-LOG運営' },
      { heading: '販売価格', body: '月額プラン: 350円（税込）\n年額プラン: 3,500円（税込）' },
    ],
  },
  terms: {
    slug: 'terms',
    title: '利用規約',
    updatedAt: '2026-01-01',
    sections: [
      { heading: '前文', body: '本利用規約は...' },
      { heading: '第1条（適用）', body: '本規約は...' },
    ],
  },
  privacy: {
    slug: 'privacy',
    title: 'プライバシーポリシー',
    updatedAt: '2026-01-01',
    sections: [
      { heading: '前文', body: 'BON-LOG運営は...' },
      { heading: '第1条（収集する情報）', body: '当方は...' },
    ],
  },
}

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  slug: string,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest(`http://localhost/api/v1/legal/${slug}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

function makeParams(slug: string): { params: Promise<{ slug: string }> } {
  return { params: Promise.resolve({ slug }) }
}

describe('GET /api/v1/legal/{slug}', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetLegalDocument.mockImplementation((slug: string) => {
      const doc = mockDocuments[slug]
      if (doc) return { ok: true, document: doc }
      return { ok: false, notFound: true }
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('slug=tokushoho で 200 { slug, title, updatedAt, sections } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'tokushoho')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('tokushoho'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slug).toBe('tokushoho')
    expect(body.title).toBe('特定商取引法に基づく表記')
    expect(typeof body.updatedAt).toBe('string')
    expect(Array.isArray(body.sections)).toBe(true)
  })

  it('slug=terms で 200 を返す・title が「利用規約」', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'terms')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('terms'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slug).toBe('terms')
    expect(body.title).toBe('利用規約')
  })

  it('slug=privacy で 200 を返す・title が「プライバシーポリシー」', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'privacy')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('privacy'))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slug).toBe('privacy')
    expect(body.title).toBe('プライバシーポリシー')
  })

  it('sections が {heading, body} の配列であること', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'tokushoho')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('tokushoho'))

    const body = await res.json()
    expect(body.sections.length).toBeGreaterThan(0)
    for (const section of body.sections) {
      expect(section).toMatchObject({
        heading: expect.any(String),
        body: expect.any(String),
      })
    }
  })

  it('tokushoho の sections に価格 (350円) が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'tokushoho')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('tokushoho'))

    const body = await res.json()
    const allBody = (body.sections as { heading: string; body: string }[]).map((s) => s.body).join('\n')
    expect(allBody).toContain('350')
  })

  it('tokushoho の sections に年額価格 (3,500) が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'tokushoho')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('tokushoho'))

    const body = await res.json()
    const allBody = (body.sections as { heading: string; body: string }[]).map((s) => s.body).join('\n')
    expect(allBody).toContain('3,500')
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, 'terms')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('terms'))

    expect(res.status).toBe(200)
  })

  it('不正 slug (unknown) で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'unknown')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('unknown'))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正 slug (foo-bar) で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'foo-bar')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('foo-bar'))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/legal/terms')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('terms'))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/legal/terms', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('terms'))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/legal/terms', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('terms'))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'terms')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('terms'))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } }', async () => {
    const req = new NextRequest('http://localhost/api/v1/legal/terms')
    const { GET } = await import('@/app/api/v1/legal/[slug]/route')
    const res = await GET(req, makeParams('terms'))

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
