// @vitest-environment node
import { vi } from 'vitest'
 export {};

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

describe('usage service', async () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ============================================================
  // getFlyioUsage
  // ============================================================
  describe('getFlyioUsage', async () => {
    const machine = (state: string, cpus = 1, memory_mb = 1024) => ({
      state,
      config: { guest: { cpus, memory_mb } },
    })

    it('returns unconfigured when no token (even on fly.io)', async () => {
      delete process.env.FLY_API_TOKEN
      delete process.env.FLY_ACCESS_TOKEN
      process.env.FLY_APP_NAME = 'bon-log'
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('unconfigured')
      expect(result.name).toBe('fly.io')
    })

    it('returns unconfigured when app name is missing (even with token)', async () => {
      process.env.FLY_API_TOKEN = 'test-token'
      delete process.env.FLY_APP_NAME
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('unconfigured')
    })

    it('returns machine / vCPU / memory usage rows from the Machines API', async () => {
      process.env.FLY_API_TOKEN = 'test-token'
      process.env.FLY_APP_NAME = 'bon-log'
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [machine('started'), machine('stopped')] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('ok')
      expect(result.usage).toBeDefined()

      const machineRow = result.usage!.find((u) => u.unit === '稼働マシン')!
      expect(machineRow.current).toBe(1)
      expect(machineRow.limit).toBe(2)
      expect(result.usage!.find((u) => u.unit === 'vCPU 合計')!.current).toBe(2)
      expect(result.usage!.find((u) => u.unit === 'メモリ合計 (MB)')!.current).toBe(2048)
    })

    it('includes a volume row (summed GB) when volumes exist', async () => {
      process.env.FLY_API_TOKEN = 'test-token'
      process.env.FLY_APP_NAME = 'bon-log'
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [machine('started', 1, 256)] })
        .mockResolvedValueOnce({ ok: true, json: async () => [{ size_gb: 3 }, { size_gb: 1 }] })
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.usage!.find((u) => u.unit === 'ボリューム (GB)')!.current).toBe(4)
    })

    it('keeps machine rows when the volumes request fails (best-effort)', async () => {
      process.env.FLY_API_TOKEN = 'test-token'
      process.env.FLY_APP_NAME = 'bon-log'
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [machine('started', 1, 256)] })
        .mockRejectedValueOnce(new Error('volumes down'))
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('ok')
      expect(result.usage!.some((u) => u.unit === '稼働マシン')).toBe(true)
      expect(result.usage!.some((u) => u.unit === 'ボリューム (GB)')).toBe(false)
    })

    it('returns error when the Machines API responds non-200', async () => {
      process.env.FLY_API_TOKEN = 'test-token'
      process.env.FLY_APP_NAME = 'bon-log'
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 })
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('error')
      expect(result.error).toContain('401')
    })

    it('returns error when the Machines API fetch rejects', async () => {
      process.env.FLY_API_TOKEN = 'test-token'
      process.env.FLY_APP_NAME = 'bon-log'
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('error')
      expect(result.error).toBe('Network error')
    })

    it('links to the upcoming invoice when FLY_ORG_SLUG is set', async () => {
      process.env.FLY_API_TOKEN = 'test-token'
      process.env.FLY_APP_NAME = 'bon-log'
      process.env.FLY_ORG_SLUG = 'acme-123'
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [machine('started', 1, 256)] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.dashboardUrl).toBe('https://fly.io/dashboard/acme-123/billing/invoices/upcoming')
    })
  })

  // ============================================================
  // getCloudflareR2Usage
  // ============================================================
  describe('getCloudflareR2Usage', async () => {
    it('returns unconfigured when no env vars', async () => {
      delete process.env.CLOUDFLARE_API_TOKEN
      delete process.env.R2_ACCOUNT_ID
      delete process.env.CLOUDFLARE_ACCOUNT_ID
      const { getCloudflareR2Usage } = await import('@/lib/services/usage')
      const result = await getCloudflareR2Usage()
      expect(result.status).toBe('unconfigured')
      expect(result.name).toBe('Cloudflare R2')
    })

    it('returns usage data on success', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'cf-token'
      process.env.R2_ACCOUNT_ID = 'acc1'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: [{ name: 'bucket1' }] }),
      })
      const { getCloudflareR2Usage } = await import('@/lib/services/usage')
      const result = await getCloudflareR2Usage()
      expect(result.status).toBe('ok')
      expect(result.usage).toBeDefined()
      expect(result.usage![0]!.current).toBe(1)
    })

    it('returns error on fetch failure', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'cf-token'
      process.env.R2_ACCOUNT_ID = 'acc1'
      mockFetch.mockRejectedValue(new Error('Network error'))
      const { getCloudflareR2Usage } = await import('@/lib/services/usage')
      const result = await getCloudflareR2Usage()
      expect(result.status).toBe('error')
      expect(result.error).toBe('Network error')
    })

    it('returns error on non-200 response', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'cf-token'
      process.env.R2_ACCOUNT_ID = 'acc1'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ errors: [{ message: 'Forbidden' }] }),
      })
      const { getCloudflareR2Usage } = await import('@/lib/services/usage')
      const result = await getCloudflareR2Usage()
      expect(result.status).toBe('error')
      expect(result.error).toBe('Forbidden')
    })
  })

  // ============================================================
  // getResendUsage
  // ============================================================
  describe('getResendUsage', async () => {
    it('returns unconfigured when no RESEND_API_KEY', async () => {
      delete process.env.RESEND_API_KEY
      const { getResendUsage } = await import('@/lib/services/usage')
      const result = await getResendUsage()
      expect(result.status).toBe('unconfigured')
      expect(result.name).toBe('Resend')
    })

    it('returns usage data on success', async () => {
      process.env.RESEND_API_KEY = 'resend-key'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      const { getResendUsage } = await import('@/lib/services/usage')
      const result = await getResendUsage()
      expect(result.status).toBe('ok')
      expect(result.usage).toBeDefined()
    })

    it('returns error on fetch failure', async () => {
      process.env.RESEND_API_KEY = 'resend-key'
      mockFetch.mockRejectedValue(new Error('Network error'))
      const { getResendUsage } = await import('@/lib/services/usage')
      const result = await getResendUsage()
      expect(result.status).toBe('error')
      expect(result.error).toBe('Network error')
    })

    it('returns warning when near limit', async () => {
      process.env.RESEND_API_KEY = 'resend-key'
      // Generate 95 emails with today's date to trigger warning (95/100 = 95%)
      const now = new Date()
      const emails = Array.from({ length: 95 }, (_, i) => ({
        id: `email-${i}`,
        created_at: now.toISOString(),
      }))
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: emails }),
      })
      const { getResendUsage } = await import('@/lib/services/usage')
      const result = await getResendUsage()
      expect(result.status).toBe('warning')
    })

    it('handles non-200 response', async () => {
      process.env.RESEND_API_KEY = 'resend-key'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })
      const { getResendUsage } = await import('@/lib/services/usage')
      const result = await getResendUsage()
      expect(result.status).toBe('error')
    })
  })
})
