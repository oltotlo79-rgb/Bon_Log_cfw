// @vitest-environment node
/**
 * GET /api/cron/process-storage-deletions
 *
 * verifyCronAuth 不通過での 401、正常時の 200 + 結果スプレッド、
 * processStorageDeletionJobs 例外時の 500 を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/cron-auth', () => ({
  verifyCronAuth: vi.fn(),
}))

vi.mock('@/lib/services/storage-deletion-worker', () => ({
  processStorageDeletionJobs: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

function createMockRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
    nextUrl: { pathname: '/api/cron/process-storage-deletions' },
  } as unknown as import('next/server').NextRequest
}

describe('GET /api/cron/process-storage-deletions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('verifyCronAuth が invalid を返す場合は 401 を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: false, error: 'Invalid signature' })

    const { GET } = await import('@/app/api/cron/process-storage-deletions/route')
    const response = await GET(createMockRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Invalid signature')
  })

  it('Authorization ヘッダーなしでも 401 を返す（verifyCronAuth に委譲）', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: false, error: undefined })

    const { GET } = await import('@/app/api/cron/process-storage-deletions/route')
    const response = await GET(createMockRequest())

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(typeof body.error).toBe('string')
    expect(body.error.length).toBeGreaterThan(0)
  })

  it('認証成功時は processStorageDeletionJobs の結果を 200 で返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    vi.mocked(processStorageDeletionJobs).mockResolvedValue({
      claimedCount: 2,
      completedCount: 1,
      retriedCount: 1,
      deadLetteredCount: 0,
      reclaimedStaleCount: 0,
      purgedCompletedCount: 3,
    })

    const { GET } = await import('@/app/api/cron/process-storage-deletions/route')
    const response = await GET(
      createMockRequest({ authorization: 'HMAC test', 'x-cron-timestamp': Date.now().toString() }),
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      success: true,
      claimedCount: 2,
      completedCount: 1,
      retriedCount: 1,
      deadLetteredCount: 0,
      reclaimedStaleCount: 0,
      purgedCompletedCount: 3,
    })
  })

  it('processStorageDeletionJobs が例外を投げた場合は 500 を返し logger.error を呼ぶ', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    const { processStorageDeletionJobs } = await import('@/lib/services/storage-deletion-worker')
    vi.mocked(processStorageDeletionJobs).mockRejectedValue(new Error('DB down'))

    const { logger } = await import('@/lib/logger')

    const { GET } = await import('@/app/api/cron/process-storage-deletions/route')
    const response = await GET(
      createMockRequest({ authorization: 'HMAC test', 'x-cron-timestamp': Date.now().toString() }),
    )

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(typeof body.error).toBe('string')
    expect(logger.error).toHaveBeenCalled()
  })
})
