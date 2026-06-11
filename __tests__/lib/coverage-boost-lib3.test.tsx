import { vi } from 'vitest'
/**
 * Coverage boost tests for uncovered branches
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// Mock recharts globally for StatsCharts tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: ({ name, dataKey }: any) => <div data-testid={`line-${dataKey}`}>{name}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: ({ name, dataKey }: any) => <div data-testid={`area-${dataKey}`}>{name}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ name, dataKey }: any) => <div data-testid={`bar-${dataKey}`}>{name}</div>,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}))

// ============================================================
// PART 1: app/api/admin/usage/route.ts - uncovered branches
// ============================================================

describe('api/admin/usage/route - uncovered branches', async () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  const mockRequireAdmin = vi.fn()
  const mockPrisma = {
    $queryRaw: vi.fn(),
    user: { count: vi.fn() },
    post: { findMany: vi.fn() },
    report: { findMany: vi.fn() },
  }
  const mockSend = vi.fn()
  const mockGetFlyioUsage = vi.fn()
  const mockGetResendUsage = vi.fn()

  function setupMocks() {
    vi.doMock('next/server', () => ({
      NextResponse: {
        json: (data: unknown, init?: { status?: number }) => ({
          json: () => Promise.resolve(data),
          status: init?.status || 200,
        }),
      },
    }))
    vi.doMock('@/lib/actions/utils', () => ({ requireAdmin: () => mockRequireAdmin() }))
    vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
    vi.doMock('@/lib/storage/s3-sign', () => ({
      listObjects: (...args: unknown[]) => mockSend(...args),
    }))
    vi.doMock('@/lib/services/usage', () => ({
      getFlyioUsage: () => mockGetFlyioUsage(),
      getResendUsage: () => mockGetResendUsage(),
    }))
  }

  function setupAdmin() {
    mockRequireAdmin.mockResolvedValue({ userId: 'admin-id', role: 'admin' })
    mockGetFlyioUsage.mockResolvedValue({ name: 'fly.io', status: 'ok', dashboardUrl: '#', lastUpdated: '' })
    mockGetResendUsage.mockResolvedValue({ name: 'Resend', status: 'ok', dashboardUrl: '#', lastUpdated: '' })
  }

  function setupR2Env() {
    process.env.R2_ACCOUNT_ID = 'acc'
    process.env.R2_ACCESS_KEY_ID = 'key'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    process.env.R2_BUCKET_NAME = 'bucket'
  }

  it('partial R2 env: only some vars set lists specific missing vars', async () => {
    setupMocks()
    setupAdmin()
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(1000) }])
    mockPrisma.user.count.mockResolvedValue(1)

    process.env.R2_ACCOUNT_ID = 'acc'
    process.env.R2_ACCESS_KEY_ID = 'key'
    delete process.env.R2_SECRET_ACCESS_KEY
    delete process.env.R2_BUCKET_NAME

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const r2 = data.data.find((d: any) => d.name === 'Cloudflare R2')
    expect(r2.status).toBe('unconfigured')
    expect(r2.error).toContain('R2_SECRET_ACCESS_KEY')
    expect(r2.error).toContain('R2_BUCKET_NAME')
    expect(r2.error).not.toContain('R2_ACCOUNT_ID')
  })

  it('extractProjectRef returns undefined for malformed DATABASE_URL', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockSend.mockResolvedValue({ Contents: [], IsTruncated: false })
    delete process.env.SUPABASE_PROJECT_REF
    delete process.env.SUPABASE_ACCESS_TOKEN
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/mydb'
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(500000) }])
    mockPrisma.user.count.mockResolvedValue(5)

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('extractProjectRef returns undefined when DATABASE_URL is not set', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockSend.mockResolvedValue({ Contents: [], IsTruncated: false })
    delete process.env.SUPABASE_PROJECT_REF
    delete process.env.SUPABASE_ACCESS_TOKEN
    delete process.env.DATABASE_URL
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(500000) }])
    mockPrisma.user.count.mockResolvedValue(5)

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('dbSizeResult empty leads to usage without db entry', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockSend.mockResolvedValue({ Contents: [], IsTruncated: false })
    delete process.env.SUPABASE_ACCESS_TOKEN
    delete process.env.SUPABASE_PROJECT_REF
    process.env.DATABASE_URL = 'postgresql://postgres.abc123:pass@aws-0-us-east-1.pooler.supabase.com'
    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.user.count.mockResolvedValue(3)

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const sb = data.data.find((d: any) => d.name === 'Supabase')
    expect(sb.status).toBe('ok')
    expect(sb.usage).toBeDefined()
  })

  it('R2 storage >= 1GB shows GB unit', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(1000) }])
    mockPrisma.user.count.mockResolvedValue(1)
    mockSend.mockResolvedValue({
      Contents: [{ Size: 2000000000, Key: 'big.bin' }],
      IsTruncated: false,
    })

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const r2 = data.data.find((d: any) => d.name === 'Cloudflare R2')
    const storageUsage = r2.usage.find((u: any) => u.unit.includes('GB'))
    expect(storageUsage).toBeDefined()
    expect(storageUsage.current).toBe(2)
  })

  it('R2 storage >= 90% triggers warning', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(1000) }])
    mockPrisma.user.count.mockResolvedValue(1)
    mockSend.mockResolvedValue({
      Contents: [{ Size: 9500000000, Key: 'huge.bin' }],
      IsTruncated: false,
    })

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const r2 = data.data.find((d: any) => d.name === 'Cloudflare R2')
    expect(r2.status).toBe('warning')
  })

  it('R2 storage >= 100% triggers error and cost helpText', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(1000) }])
    mockPrisma.user.count.mockResolvedValue(1)
    mockSend.mockResolvedValue({
      Contents: [{ Size: 11000000000, Key: 'huge.bin' }],
      IsTruncated: false,
    })

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const r2 = data.data.find((d: any) => d.name === 'Cloudflare R2')
    expect(r2.status).toBe('error')
    expect(r2.helpText).toContain('推定コスト')
  })

  it('R2 response with no Contents field', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(1000) }])
    mockPrisma.user.count.mockResolvedValue(1)
    mockSend.mockResolvedValue({ IsTruncated: false })

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const r2 = data.data.find((d: any) => d.name === 'Cloudflare R2')
    expect(r2.status).toBe('ok')
  })

  it('R2 S3 error with non-Error object', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(1000) }])
    mockPrisma.user.count.mockResolvedValue(1)
    mockSend.mockRejectedValue('string error')

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const r2 = data.data.find((d: any) => d.name === 'Cloudflare R2')
    expect(r2.status).toBe('error')
    expect(r2.error).toBe('S3 API接続エラーが発生しました')
  })

  it('Supabase Platform API empty data falls back to DB', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockSend.mockResolvedValue({ Contents: [], IsTruncated: false })
    process.env.SUPABASE_ACCESS_TOKEN = 'token'
    process.env.SUPABASE_PROJECT_REF = 'ref'

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(100000) }])
    mockPrisma.user.count.mockResolvedValue(2)

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const sb = data.data.find((d: any) => d.name === 'Supabase')
    expect(sb.usage).toBeDefined()
  })

  it('Supabase Platform API with disk_usage field', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockSend.mockResolvedValue({ Contents: [], IsTruncated: false })
    process.env.SUPABASE_ACCESS_TOKEN = 'token'
    process.env.SUPABASE_PROJECT_REF = 'ref'

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        db_size: 100000000,
        disk_usage: 2000000000,
        storage_size: 50000000,
      }),
    })

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const sb = data.data.find((d: any) => d.name === 'Supabase')
    expect(sb.usage.length).toBe(3)
  })

  it('Supabase Platform API >=90% returns warning', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockSend.mockResolvedValue({ Contents: [], IsTruncated: false })
    process.env.SUPABASE_ACCESS_TOKEN = 'token'
    process.env.SUPABASE_PROJECT_REF = 'ref'

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ db_size: 480000000 }),
    })

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const sb = data.data.find((d: any) => d.name === 'Supabase')
    expect(sb.status).toBe('warning')
  })

  it('Supabase DB direct with non-Error exception', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockSend.mockResolvedValue({ Contents: [], IsTruncated: false })
    delete process.env.SUPABASE_ACCESS_TOKEN
    mockPrisma.$queryRaw.mockRejectedValue('string db error')

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const sb = data.data.find((d: any) => d.name === 'Supabase')
    expect(sb.status).toBe('error')
    expect(sb.error).toBe('データの取得に失敗しました')
  })

  it('Promise.allSettled individual rejections map to error entries', async () => {
    setupMocks()
    setupAdmin()
    delete process.env.R2_ACCOUNT_ID
    mockGetFlyioUsage.mockRejectedValue(new Error('fail'))
    mockGetResendUsage.mockRejectedValue(new Error('fail'))
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(1000) }])
    mockPrisma.user.count.mockResolvedValue(1)

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const flyio = data.data.find((d: any) => d.name === 'fly.io')
    expect(flyio.status).toBe('error')
    expect(flyio.error).toBe('取得中にエラーが発生')
  })

  it('Supabase dashboardUrl with orgId and projectRef', async () => {
    setupMocks()
    setupAdmin()
    setupR2Env()
    mockSend.mockResolvedValue({ Contents: [], IsTruncated: false })
    process.env.SUPABASE_ORG_ID = 'org123'
    process.env.SUPABASE_PROJECT_REF = 'proj456'
    delete process.env.SUPABASE_ACCESS_TOKEN
    mockPrisma.$queryRaw.mockResolvedValue([{ size: BigInt(1000) }])
    mockPrisma.user.count.mockResolvedValue(1)

    const { GET } = await import('@/app/api/admin/usage/route')
    const res = await GET()
    const data = await res.json()
    const sb = data.data.find((d: any) => d.name === 'Supabase')
    expect(sb.dashboardUrl).toContain('org123')
    expect(sb.dashboardUrl).toContain('proj456')
  })
})

// ============================================================
// PART 2: lib/services/usage.ts - uncovered branches
// ============================================================

describe('lib/services/usage - uncovered branches', async () => {
  const originalEnv = process.env
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    // Ensure no leftover doMock from Part 1
    vi.doUnmock('@/lib/services/usage')
    process.env = { ...originalEnv }
    global.fetch = mockFetch
    delete process.env.VERCEL_TOKEN
    delete process.env.VERCEL_TEAM_ID
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.R2_ACCOUNT_ID
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.RESEND_API_KEY
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('fly.io: Machines API が non-200 を返すと error', async () => {
    process.env.FLY_APP_NAME = 'bon-log'
    process.env.FLY_API_TOKEN = 'token'

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const { getFlyioUsage } = await import('@/lib/services/usage')
    const result = await getFlyioUsage()
    expect(result.status).toBe('error')
    expect(result.error).toBe('Machines API HTTP 500')
  })

  it('fly.io: guest 情報が無いマシンは vCPU/メモリ行を出さない', async () => {
    process.env.FLY_APP_NAME = 'bon-log'
    process.env.FLY_API_TOKEN = 'token'

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ state: 'started' }]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })

    const { getFlyioUsage } = await import('@/lib/services/usage')
    const result = await getFlyioUsage()
    expect(result.status).toBe('ok')
    const units = result.usage!.map((u) => u.unit)
    expect(units).toContain('稼働マシン')
    expect(units).not.toContain('vCPU 合計')
    expect(units).not.toContain('メモリ合計 (MB)')
  })

  it('Cloudflare R2: bucketsRes.json() throws -> error with HTTP status', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.R2_ACCOUNT_ID = 'acc'

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    })

    const { getCloudflareR2Usage } = await import('@/lib/services/usage')
    const result = await getCloudflareR2Usage()
    expect(result.status).toBe('error')
    expect(result.error).toBe('HTTP 500')
  })

  it('Cloudflare R2: buckets result is not an array', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.R2_ACCOUNT_ID = 'acc'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ result: 'not-an-array' }),
    })

    const { getCloudflareR2Usage } = await import('@/lib/services/usage')
    const result = await getCloudflareR2Usage()
    expect(result.status).toBe('ok')
    expect(result.usage?.[0]!.current).toBe(0)
  })

  it('Resend: exactly 100 emails continues pagination, then <100 stops', async () => {
    process.env.RESEND_API_KEY = 'key'

    const now = new Date()
    const makeEmails = (count: number, prefix: string) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${prefix}-${i}`,
        created_at: now.toISOString(),
      }))

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: makeEmails(100, 'a') }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: makeEmails(50, 'b') }) })

    const { getResendUsage } = await import('@/lib/services/usage')
    const result = await getResendUsage()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.usage?.[0]!.current).toBe(150)
  })

  it('Resend: emailsData.data is not an array stops pagination', async () => {
    process.env.RESEND_API_KEY = 'key'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'not-array' }),
    })

    const { getResendUsage } = await import('@/lib/services/usage')
    const result = await getResendUsage()
    expect(result.status).toBe('ok')
    expect(result.usage?.[0]!.current).toBe(0)
  })

  it('Resend: emailsData.data is null stops pagination', async () => {
    process.env.RESEND_API_KEY = 'key'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })

    const { getResendUsage } = await import('@/lib/services/usage')
    const result = await getResendUsage()
    expect(result.status).toBe('ok')
    expect(result.usage?.[0]!.current).toBe(0)
  })

  it('Resend: non-Error exception in catch', async () => {
    process.env.RESEND_API_KEY = 'key'
    mockFetch.mockRejectedValue('string error')

    const { getResendUsage } = await import('@/lib/services/usage')
    const result = await getResendUsage()
    expect(result.status).toBe('error')
    expect(result.error).toBe('取得に失敗')
  })

  it('fly.io: 非Error 例外でも汎用エラーメッセージを返す', async () => {
    process.env.FLY_APP_NAME = 'bon-log'
    process.env.FLY_API_TOKEN = 'token'
    mockFetch.mockRejectedValue(42)

    const { getFlyioUsage } = await import('@/lib/services/usage')
    const result = await getFlyioUsage()
    expect(result.status).toBe('error')
    expect(result.error).toBe('取得に失敗しました')
  })

  it('Cloudflare R2: non-Error in catch', async () => {
    process.env.CLOUDFLARE_API_TOKEN = 'token'
    process.env.R2_ACCOUNT_ID = 'acc'
    mockFetch.mockRejectedValue(null)

    const { getCloudflareR2Usage } = await import('@/lib/services/usage')
    const result = await getCloudflareR2Usage()
    expect(result.status).toBe('error')
    expect(result.error).toBe('取得に失敗')
  })

  it('Resend: oldest email before monthStart stops pagination', async () => {
    process.env.RESEND_API_KEY = 'key'

    const oldDate = new Date()
    oldDate.setMonth(oldDate.getMonth() - 3)

    const emails = Array.from({ length: 100 }, (_, i) => ({
      id: `e-${i}`,
      created_at: oldDate.toISOString(),
    }))

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: emails }),
    })

    const { getResendUsage } = await import('@/lib/services/usage')
    const result = await getResendUsage()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result.status).toBe('ok')
  })

  it('fly.io: FLY_APP_NAME ありで稼働マシン数を取得する', async () => {
    process.env.FLY_API_TOKEN = 'token'
    process.env.FLY_APP_NAME = 'bon-log'

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ state: 'started' }, { state: 'started' }, { state: 'stopped' }]),
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })

    const { getFlyioUsage } = await import('@/lib/services/usage')
    const result = await getFlyioUsage()
    expect(result.status).toBe('ok')
    expect(result.usage?.[0]!.current).toBe(2) // started 2件
    expect(result.usage?.[0]!.limit).toBe(3) // 総数3件
    expect(result.usage?.[0]!.unit).toContain('マシン')
  })
})

// ============================================================
// PART 3: app/admin/users/[id]/page.tsx - uncovered branches
// ============================================================

describe('admin/users/[id]/page - uncovered branches', async () => {
  const mockGetAdminUserDetail = vi.fn()
  const mockPrisma = {
    post: { findMany: vi.fn() },
    report: { findMany: vi.fn() },
  }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    cleanup()

    vi.doMock('next/link', () => ({
      __esModule: true,
      default: ({ children, href }: any) => <a href={href}>{children}</a>,
    }))
    vi.doMock('next/image', () => ({
      __esModule: true,
      default: (_props: any) => <div data-testid="next-image" />,
    }))
    vi.doMock('next/navigation', () => ({
      notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
    }))
    vi.doMock('@/lib/actions/admin/users', () => ({
      getAdminUserDetail: (...args: any[]) => mockGetAdminUserDetail(...args),
    }))
    vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
    vi.doMock('@/app/admin/users/[id]/UserDetailActions', () => ({
      UserDetailActions: () => <div data-testid="user-actions" />,
    }))
  })

  function makeUser(overrides: any = {}) {
    return {
      id: 'u1', nickname: 'TestUser', email: 'test@example.com',
      avatarUrl: null, bio: null, isSuspended: false, suspendedAt: null,
      createdAt: new Date('2024-06-01'),
      _count: { posts: 0, comments: 0, followers: 0, following: 0 },
      ...overrides,
    }
  }

  it('generateMetadata: result has user=null', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: null })
    const { generateMetadata } = await import('@/app/admin/users/[id]/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('ユーザーが見つかりません - BON-LOG 管理')
  })

  it('page: result.user is null calls notFound', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: null, reportCount: 0 })
    const { default: Page } = await import('@/app/admin/users/[id]/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('suspended user with suspendedAt shows suspension date', async () => {
    mockGetAdminUserDetail.mockResolvedValue({
      user: makeUser({ isSuspended: true, suspendedAt: new Date('2025-03-15') }),
      reportCount: 0,
    })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.report.findMany.mockResolvedValue([])

    const { default: Page } = await import('@/app/admin/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)

    expect(screen.getByText('停止中')).toBeInTheDocument()
    expect(screen.getByText(/停止日:/)).toBeInTheDocument()
  })

  it('post with null content shows テキストなし', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 0 })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: null, createdAt: new Date(), _count: { likes: 0, comments: 0 } },
    ])
    mockPrisma.report.findMany.mockResolvedValue([])

    const { default: Page } = await import('@/app/admin/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)

    expect(screen.getByText('（テキストなし）')).toBeInTheDocument()
  })

  it('reports with different statuses show correct labels', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 4 })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.report.findMany.mockResolvedValue([
      { id: 'r1', reason: 'Spam', targetType: 'user', status: 'pending', description: null, createdAt: new Date(), reporter: { id: 'x', nickname: 'R1' } },
      { id: 'r2', reason: 'Abuse', targetType: 'post', status: 'reviewed', description: 'details here', createdAt: new Date(), reporter: { id: 'y', nickname: 'R2' } },
      { id: 'r3', reason: 'Other', targetType: 'user', status: 'resolved', description: null, createdAt: new Date(), reporter: { id: 'z', nickname: 'R3' } },
      { id: 'r4', reason: 'Test', targetType: 'user', status: 'dismissed', description: null, createdAt: new Date(), reporter: { id: 'w', nickname: 'R4' } },
    ])

    const { default: Page } = await import('@/app/admin/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)

    expect(screen.getByText('未対応')).toBeInTheDocument()
    expect(screen.getByText('確認済み')).toBeInTheDocument()
    expect(screen.getByText('対応完了')).toBeInTheDocument()
    expect(screen.getByText('却下')).toBeInTheDocument()
    expect(screen.getByText('details here')).toBeInTheDocument()
  })
})

// ============================================================
// PART 4: app/admin/stats/StatsCharts.tsx - uncovered branches
// ============================================================

describe('StatsCharts - uncovered branches', async () => {
  // Import statically to avoid React instance mismatch from vi.resetModules()
  const { StatsCharts } = await import('@/app/admin/stats/StatsCharts')

  const mockData = Array.from({ length: 30 }, (_, i) => ({
    date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    users: 100 + i,
    posts: 50 + i,
    comments: 30 + i,
  }))

  afterEach(() => {
    cleanup()
  })

  it('line chart with single metric users', () => {
    render(<StatsCharts data={mockData} />)
    fireEvent.click(screen.getByRole('button', { name: 'ライン' }))
    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'users' } })
    expect(screen.getByTestId('line-users')).toBeInTheDocument()
    expect(screen.queryByTestId('line-posts')).not.toBeInTheDocument()
  })

  it('line chart with posts metric', () => {
    render(<StatsCharts data={mockData} />)
    fireEvent.click(screen.getByRole('button', { name: 'ライン' }))
    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'posts' } })
    expect(screen.getByTestId('line-posts')).toBeInTheDocument()
  })

  it('line chart with comments metric', () => {
    render(<StatsCharts data={mockData} />)
    fireEvent.click(screen.getByRole('button', { name: 'ライン' }))
    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'comments' } })
    expect(screen.getByTestId('line-comments')).toBeInTheDocument()
  })

  it('bar chart with single metric users', () => {
    render(<StatsCharts data={mockData} />)
    fireEvent.click(screen.getByRole('button', { name: 'バー' }))
    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'users' } })
    expect(screen.getByTestId('bar-users')).toBeInTheDocument()
    expect(screen.queryByTestId('bar-posts')).not.toBeInTheDocument()
  })

  it('bar chart with all metrics', () => {
    render(<StatsCharts data={mockData} />)
    fireEvent.click(screen.getByRole('button', { name: 'バー' }))
    expect(screen.getByTestId('bar-users')).toBeInTheDocument()
    expect(screen.getByTestId('bar-posts')).toBeInTheDocument()
    expect(screen.getByTestId('bar-comments')).toBeInTheDocument()
  })

  it('area chart with single metric posts', () => {
    render(<StatsCharts data={mockData} />)
    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'posts' } })
    expect(screen.getByTestId('area-posts')).toBeInTheDocument()
    expect(screen.queryByTestId('area-users')).not.toBeInTheDocument()
  })

  it('area chart with comments metric', () => {
    render(<StatsCharts data={mockData} />)
    fireEvent.change(screen.getByDisplayValue('すべて'), { target: { value: 'comments' } })
    expect(screen.getByTestId('area-comments')).toBeInTheDocument()
  })

  it('period 14 days filters data', () => {
    render(<StatsCharts data={mockData} />)
    const periodSelect = screen.getByDisplayValue('30日間')
    fireEvent.change(periodSelect, { target: { value: '14' } })
    expect(periodSelect).toHaveValue('14')
  })

  it('line chart all metrics renders 3 lines', () => {
    render(<StatsCharts data={mockData} />)
    fireEvent.click(screen.getByRole('button', { name: 'ライン' }))
    expect(screen.getByTestId('line-users')).toBeInTheDocument()
    expect(screen.getByTestId('line-posts')).toBeInTheDocument()
    expect(screen.getByTestId('line-comments')).toBeInTheDocument()
  })
})
