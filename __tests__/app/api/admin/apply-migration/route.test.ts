// @vitest-environment node
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn(),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/constants/errors', () => ({
  API_ERR_UNAUTHORIZED: 'Unauthorized',
  API_ERR_FORBIDDEN: 'Forbidden',
  ERR_INVALID_INPUT: '入力が不正です',
}))

function makeRequest(token?: string, body?: unknown, ip?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['authorization'] = `Bearer ${token}`
  if (ip) headers['x-forwarded-for'] = ip
  return new NextRequest('http://localhost:3000/api/admin/apply-migration', {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/admin/apply-migration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = {
      ...originalEnv,
      ADMIN_MIGRATION_SECRET: 'test-secret-123',
      SEED_PESTICIDE_SECRET: 'seed-secret-only',
      CRON_SECRET: 'cron-secret-456',
    }
    delete process.env.SEED_ALLOWED_IPS
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 401 when no authorization header is provided', async () => {
    const { POST } = await import('@/app/api/admin/apply-migration/route')
    const res = await POST(makeRequest(undefined, { migration: 'add_daily_visitors' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 with invalid token', async () => {
    const { POST } = await import('@/app/api/admin/apply-migration/route')
    const res = await POST(makeRequest('wrong-token', { migration: 'add_daily_visitors' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when IP is not in allowlist', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.1'
    const { POST } = await import('@/app/api/admin/apply-migration/route')
    const res = await POST(makeRequest('test-secret-123', { migration: 'add_daily_visitors' }, '192.168.1.1'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when body is missing', async () => {
    const { POST } = await import('@/app/api/admin/apply-migration/route')
    const req = new NextRequest('http://localhost:3000/api/admin/apply-migration', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret-123' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when migration name is unknown', async () => {
    const { POST } = await import('@/app/api/admin/apply-migration/route')
    const res = await POST(makeRequest('test-secret-123', { migration: 'rm_users_table' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.available).toEqual(expect.arrayContaining(['add_daily_visitors']))
  })

  it('revoke_data_api_grants_from_public が allowlist に含まれ実行できる', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(undefined as never)

    const { POST } = await import('@/app/api/admin/apply-migration/route')
    const res = await POST(makeRequest('test-secret-123', { migration: 'revoke_data_api_grants_from_public' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.migration).toBe('revoke_data_api_grants_from_public')
    expect(data.statementCount).toBeGreaterThan(0)
    // 実行された SQL に REVOKE と ALTER DEFAULT PRIVILEGES が含まれることを確認
    const calls = vi.mocked(prisma.$executeRawUnsafe).mock.calls
    const allSql = calls.map((c) => String(c[0])).join('\n')
    expect(allSql).toContain('REVOKE ALL ON ALL TABLES')
    expect(allSql).toContain('ALTER DEFAULT PRIVILEGES')
    expect(allSql).toContain('FROM anon')
    expect(allSql).toContain('FROM authenticated')
    // ロール存在チェック (Docker postgres 互換性) があることを確認
    expect(allSql).toContain("rolname = 'anon'")
    expect(allSql).toContain("rolname = 'authenticated'")
  })

  it('executes statements in order on success', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(undefined as never)

    const { POST } = await import('@/app/api/admin/apply-migration/route')
    const res = await POST(makeRequest('test-secret-123', { migration: 'add_daily_visitors' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.migration).toBe('add_daily_visitors')
    expect(data.statementCount).toBeGreaterThan(0)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled()
  })

  it('returns 500 with details on SQL error and reports executed statement count', async () => {
    const { prisma } = await import('@/lib/db')
    // 最初の文は成功、2 つ目で失敗させる
    vi.mocked(prisma.$executeRawUnsafe)
      .mockResolvedValueOnce(undefined as never)
      .mockRejectedValueOnce(new Error('relation "users" does not exist'))

    const { POST } = await import('@/app/api/admin/apply-migration/route')
    const res = await POST(makeRequest('test-secret-123', { migration: 'add_daily_visitors' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Migration failed')
    expect(data.message).toContain('relation "users" does not exist')
    expect(data.executedStatementIndices).toEqual([0])
  })

  describe('ADMIN_MIGRATION_SECRET (専用 secret モード)', () => {
    it('seed/cron secret では拒否される (fallback なし)', async () => {
      const { POST } = await import('@/app/api/admin/apply-migration/route')
      const seedRes = await POST(makeRequest('seed-secret-only', { migration: 'add_daily_visitors' }))
      expect(seedRes.status).toBe(401)

      const cronRes = await POST(makeRequest('cron-secret-456', { migration: 'add_daily_visitors' }))
      expect(cronRes.status).toBe(401)
    })

    it('ADMIN_MIGRATION_SECRET 未設定時は dedicated secret でも 401 (fail-closed)', async () => {
      delete process.env.ADMIN_MIGRATION_SECRET

      const { POST } = await import('@/app/api/admin/apply-migration/route')
      const res = await POST(makeRequest('test-secret-123', { migration: 'add_daily_visitors' }))
      expect(res.status).toBe(401)
    })

    it('ADMIN_MIGRATION_SECRET 設定時は専用 secret で許可される', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(undefined as never)

      const { POST } = await import('@/app/api/admin/apply-migration/route')
      const res = await POST(makeRequest('test-secret-123', { migration: 'add_daily_visitors' }))
      expect(res.status).toBe(200)
    })

    it('成功応答に requestId が含まれる (監査用)', async () => {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(undefined as never)

      const { POST } = await import('@/app/api/admin/apply-migration/route')
      const res = await POST(makeRequest('test-secret-123', { migration: 'add_daily_visitors' }))
      const data = await res.json()
      expect(typeof data.requestId).toBe('string')
      expect(data.requestId.length).toBeGreaterThan(0)
    })
  })
})
