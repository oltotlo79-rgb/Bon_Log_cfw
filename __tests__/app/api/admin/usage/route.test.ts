// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/actions/utils', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: { count: vi.fn().mockResolvedValue(10) },
  },
}))

vi.mock('@/lib/storage/s3-sign', () => ({
  listObjects: vi.fn(),
}))

vi.mock('@/lib/services/usage', () => ({
  getVercelUsage: vi.fn(),
  getResendUsage: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Admin Usage API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('管理者でなければ401を返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ error: '認証が必要です' })

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('管理者でないユーザーは403を返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ error: '管理者権限が必要です' })

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    expect(response.status).toBe(403)
  })

  it('管理者には使用状況を返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' })

    const { getVercelUsage, getResendUsage } = await import('@/lib/services/usage')
    vi.mocked(getVercelUsage).mockResolvedValue({
      name: 'Vercel',
      status: 'ok',
      lastUpdated: new Date().toISOString(),
    })
    vi.mocked(getResendUsage).mockResolvedValue({
      name: 'Resend',
      status: 'ok',
      lastUpdated: new Date().toISOString(),
    })

    // Supabase Platform API mock
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ pg_database_size: '1000000' }])

    const { listObjects } = await import('@/lib/storage/s3-sign')
    vi.mocked(listObjects).mockResolvedValue({ contents: [], isTruncated: false })

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
  })

  it('R2未設定時にunconfiguredを返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' })

    const { getVercelUsage, getResendUsage } = await import('@/lib/services/usage')
    vi.mocked(getVercelUsage).mockResolvedValue({
      name: 'Vercel',
      status: 'ok',
      dashboardUrl: 'https://vercel.com',
      lastUpdated: new Date().toISOString(),
    })
    vi.mocked(getResendUsage).mockResolvedValue({
      name: 'Resend',
      status: 'ok',
      dashboardUrl: 'https://resend.com',
      lastUpdated: new Date().toISOString(),
    })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ pg_database_size: '1000000' }])

    delete process.env.R2_ACCOUNT_ID

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data).toBeDefined()
    const r2Data = data.data.find((d: { name: string }) => d.name === 'Cloudflare R2')
    expect(r2Data.status).toBe('unconfigured')
  })

  it('R2データ取得成功時にOKステータスを返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' })

    const { getVercelUsage, getResendUsage } = await import('@/lib/services/usage')
    vi.mocked(getVercelUsage).mockResolvedValue({
      name: 'Vercel',
      status: 'ok',
      dashboardUrl: 'https://vercel.com',
      lastUpdated: new Date().toISOString(),
    })
    vi.mocked(getResendUsage).mockResolvedValue({
      name: 'Resend',
      status: 'ok',
      dashboardUrl: 'https://resend.com',
      lastUpdated: new Date().toISOString(),
    })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ pg_database_size: '1000000' }])

    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'

    const { listObjects } = await import('@/lib/storage/s3-sign')
    vi.mocked(listObjects).mockResolvedValue({
      Contents: [
        { Size: 1000000, Key: 'file1.jpg' },
        { Size: 2000000, Key: 'file2.jpg' },
      ],
      IsTruncated: false,
    })

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    const r2Data = data.data.find((d: { name: string }) => d.name === 'Cloudflare R2')
    expect(r2Data.status).toBe('ok')
    expect(r2Data.usage).toBeDefined()
  })

  it('R2でページネーション処理を行う', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' })

    const { getVercelUsage, getResendUsage } = await import('@/lib/services/usage')
    vi.mocked(getVercelUsage).mockResolvedValue({
      name: 'Vercel',
      status: 'ok',
      dashboardUrl: 'https://vercel.com',
      lastUpdated: new Date().toISOString(),
    })
    vi.mocked(getResendUsage).mockResolvedValue({
      name: 'Resend',
      status: 'ok',
      dashboardUrl: 'https://resend.com',
      lastUpdated: new Date().toISOString(),
    })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ pg_database_size: '1000000' }])

    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'

    const { listObjects } = await import('@/lib/storage/s3-sign')
    vi.mocked(listObjects)
      .mockResolvedValueOnce({
        Contents: [{ Size: 1000000, Key: 'file1.jpg' }],
        IsTruncated: true,
        NextContinuationToken: 'token1',
      })
      .mockResolvedValueOnce({
        Contents: [{ Size: 2000000, Key: 'file2.jpg' }],
        IsTruncated: false,
      })

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(listObjects).toHaveBeenCalledTimes(2)
  })

  it('R2エラー時にエラーステータスを返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' })

    const { getVercelUsage, getResendUsage } = await import('@/lib/services/usage')
    vi.mocked(getVercelUsage).mockResolvedValue({
      name: 'Vercel',
      status: 'ok',
      dashboardUrl: 'https://vercel.com',
      lastUpdated: new Date().toISOString(),
    })
    vi.mocked(getResendUsage).mockResolvedValue({
      name: 'Resend',
      status: 'ok',
      dashboardUrl: 'https://resend.com',
      lastUpdated: new Date().toISOString(),
    })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ pg_database_size: '1000000' }])

    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'

    const { listObjects } = await import('@/lib/storage/s3-sign')
    vi.mocked(listObjects).mockRejectedValue(new Error('S3 API Error'))

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    const r2Data = data.data.find((d: { name: string }) => d.name === 'Cloudflare R2')
    expect(r2Data.status).toBe('error')
  })

  it('Supabase Platform API成功時にデータを返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' })

    const { getVercelUsage, getResendUsage } = await import('@/lib/services/usage')
    vi.mocked(getVercelUsage).mockResolvedValue({
      name: 'Vercel',
      status: 'ok',
      dashboardUrl: 'https://vercel.com',
      lastUpdated: new Date().toISOString(),
    })
    vi.mocked(getResendUsage).mockResolvedValue({
      name: 'Resend',
      status: 'ok',
      dashboardUrl: 'https://resend.com',
      lastUpdated: new Date().toISOString(),
    })

    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'
    process.env.SUPABASE_ACCESS_TOKEN = 'test-token'
    process.env.SUPABASE_PROJECT_REF = 'test-ref'

    const { listObjects } = await import('@/lib/storage/s3-sign')
    vi.mocked(listObjects).mockResolvedValue({
      Contents: [],
      IsTruncated: false,
    })

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        db_size: 100000000,
        storage_size: 50000000,
      }),
    })

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    const supabaseData = data.data.find((d: { name: string }) => d.name === 'Supabase')
    expect(supabaseData.status).toBe('ok')
  })

  it('Supabase Platform APIエラー時はDBから取得', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' })

    const { getVercelUsage, getResendUsage } = await import('@/lib/services/usage')
    vi.mocked(getVercelUsage).mockResolvedValue({
      name: 'Vercel',
      status: 'ok',
      dashboardUrl: 'https://vercel.com',
      lastUpdated: new Date().toISOString(),
    })
    vi.mocked(getResendUsage).mockResolvedValue({
      name: 'Resend',
      status: 'ok',
      dashboardUrl: 'https://resend.com',
      lastUpdated: new Date().toISOString(),
    })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ pg_database_size: '1000000' }])

    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'
    process.env.SUPABASE_ACCESS_TOKEN = 'test-token'
    process.env.SUPABASE_PROJECT_REF = 'test-ref'

    const { listObjects } = await import('@/lib/storage/s3-sign')
    vi.mocked(listObjects).mockResolvedValue({
      Contents: [],
      IsTruncated: false,
    })

    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
    })

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    const supabaseData = data.data.find((d: { name: string }) => d.name === 'Supabase')
    expect(supabaseData.usage).toBeDefined()
    expect(prisma.$queryRaw).toHaveBeenCalled()
  })

  it('SupabaseのDB取得エラー時にエラーステータスを返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' })

    const { getVercelUsage, getResendUsage } = await import('@/lib/services/usage')
    vi.mocked(getVercelUsage).mockResolvedValue({
      name: 'Vercel',
      status: 'ok',
      dashboardUrl: 'https://vercel.com',
      lastUpdated: new Date().toISOString(),
    })
    vi.mocked(getResendUsage).mockResolvedValue({
      name: 'Resend',
      status: 'ok',
      dashboardUrl: 'https://resend.com',
      lastUpdated: new Date().toISOString(),
    })

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB Error'))

    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'

    const { listObjects } = await import('@/lib/storage/s3-sign')
    vi.mocked(listObjects).mockResolvedValue({
      Contents: [],
      IsTruncated: false,
    })

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    const supabaseData = data.data.find((d: { name: string }) => d.name === 'Supabase')
    expect(supabaseData.status).toBe('error')
  })

  it('全サービスのエラーを適切に処理する', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1' })

    const { getVercelUsage, getResendUsage } = await import('@/lib/services/usage')
    vi.mocked(getVercelUsage).mockRejectedValue(new Error('Vercel Error'))
    vi.mocked(getResendUsage).mockRejectedValue(new Error('Resend Error'))

    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB Error'))

    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET_NAME = 'test-bucket'

    const { listObjects } = await import('@/lib/storage/s3-sign')
    vi.mocked(listObjects).mockRejectedValue(new Error('S3 Error'))

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.data).toHaveLength(4)
    data.data.forEach((d: { status: string }) => {
      expect(d.status).toBe('error')
    })
  })

  it('予期しないエラー時に500を返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockRejectedValue(new Error('Unexpected Error'))

    const { GET } = await import('@/app/api/admin/usage/route')
    const response = await GET()
    const data = await response.json()

    expect(data.error).toBe('Internal server error')
    expect(response.status).toBe(500)
  })
})
