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
    it('returns unconfigured when no token and not on fly.io', async () => {
      delete process.env.FLY_API_TOKEN
      delete process.env.FLY_ACCESS_TOKEN
      delete process.env.FLY_APP_NAME
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('unconfigured')
      expect(result.name).toBe('fly.io')
    })

    it('returns usage data (app count) on GraphQL success', async () => {
      delete process.env.FLY_APP_NAME
      process.env.FLY_API_TOKEN = 'test-token'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { apps: { nodes: [{ name: 'bon-log' }] } } }),
      })
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('ok')
      expect(result.name).toBe('fly.io')
    })

    it('returns error on fetch failure when not on fly.io', async () => {
      delete process.env.FLY_APP_NAME
      process.env.FLY_API_TOKEN = 'test-token'
      mockFetch.mockRejectedValue(new Error('Network error'))
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('error')
      expect(result.error).toBe('Network error')
    })

    it('returns error when GraphQL returns errors array', async () => {
      delete process.env.FLY_APP_NAME
      process.env.FLY_API_TOKEN = 'test-token'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ errors: [{ message: 'unauthorized' }] }),
      })
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('error')
      expect(result.error).toBe('unauthorized')
    })

    it('returns ok with runtime info when FLY_APP_NAME is set (no token)', async () => {
      delete process.env.FLY_API_TOKEN
      delete process.env.FLY_ACCESS_TOKEN
      process.env.FLY_APP_NAME = 'bon-log'
      process.env.FLY_REGION = 'nrt'
      const { getFlyioUsage } = await import('@/lib/services/usage')
      const result = await getFlyioUsage()
      expect(result.status).toBe('ok')
      expect(result.helpText).toContain('bon-log')
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
      expect(result.usage![0].current).toBe(1)
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
