// @vitest-environment node
import { vi } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      json: () => Promise.resolve(data),
      status: init?.status ?? 200,
    }),
  },
}))

const mockExecuteRawUnsafe = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: { $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args) },
}))

const mockMain = vi.fn()
vi.mock('@/prisma/seed/pesticide/seed-pesticide-data', () => ({
  main: () => mockMain(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

function createRequest(headers: Record<string, string> = {}) {
  return {
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  } as Request
}

describe('POST /api/admin/seed-pesticide - IP allowlist', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv }
    // Always provide a valid secret so auth passes
    process.env.SEED_PESTICIDE_SECRET = 'valid-secret'
    mockExecuteRawUnsafe.mockResolvedValue(undefined)
    mockMain.mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('SEED_ALLOWED_IPS が未設定の場合、任意のIPで許可される', async () => {
    delete process.env.SEED_ALLOWED_IPS

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const res = await POST(createRequest({
      authorization: 'Bearer valid-secret',
      'x-forwarded-for': '203.0.113.50',
    }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('SEED_ALLOWED_IPS にクライアントIPが含まれていれば許可される', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.1, 192.168.1.100'

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const res = await POST(createRequest({
      authorization: 'Bearer valid-secret',
      'x-forwarded-for': '192.168.1.100',
    }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('SEED_ALLOWED_IPS に含まれないIPの場合、403 を返す', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.1, 192.168.1.100'

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const res = await POST(createRequest({
      authorization: 'Bearer valid-secret',
      'x-forwarded-for': '203.0.113.99',
    }))

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('Forbidden')
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled()
  })

  it('x-forwarded-for が 2 IPの場合は先頭 (single-hop) のIPで判定する', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.1'

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const res = await POST(createRequest({
      authorization: 'Bearer valid-secret',
      'x-forwarded-for': '10.0.0.1, 172.16.0.1',
    }))

    expect(res.status).toBe(200)
  })

  it('x-forwarded-for が 3 IP以上の場合は末尾から2番目 (偽装耐性) のIPで判定する', async () => {
    process.env.SEED_ALLOWED_IPS = '172.16.0.1'

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const res = await POST(createRequest({
      authorization: 'Bearer valid-secret',
      // 攻撃者が偽装した先頭 (203.0.113.99) ではなく、最外プロキシが見た 172.16.0.1 で判定
      'x-forwarded-for': '203.0.113.99, 172.16.0.1, 10.0.0.1',
    }))

    expect(res.status).toBe(200)
  })

  it('x-forwarded-for の先頭が偽装されても、末尾から2番目のIPで判定するためバイパスできない', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.1'

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const res = await POST(createRequest({
      authorization: 'Bearer valid-secret',
      // 攻撃者が allowlist の 10.0.0.1 を先頭に偽装してもバイパスできない
      'x-forwarded-for': '10.0.0.1, 203.0.113.99, 198.51.100.1',
    }))

    expect(res.status).toBe(403)
  })

  it('x-forwarded-for がなく x-real-ip がある場合はそちらで判定する', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.5'

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const res = await POST(createRequest({
      authorization: 'Bearer valid-secret',
      'x-real-ip': '10.0.0.5',
    }))

    expect(res.status).toBe(200)
  })

  it('IPヘッダーがない場合、SEED_ALLOWED_IPS 設定時は 403 を返す', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.1'

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const res = await POST(createRequest({
      authorization: 'Bearer valid-secret',
    }))

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('Forbidden')
  })
})
