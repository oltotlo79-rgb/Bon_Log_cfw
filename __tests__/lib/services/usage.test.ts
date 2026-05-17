// @vitest-environment node

import { vi } from 'vitest'
import {
  getVercelUsage,
  getCloudflareR2Usage,
  getResendUsage,
} from '@/lib/services/usage'

// グローバルfetchのモック
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Usage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 環境変数をリセット
    delete process.env.VERCEL_TOKEN
    delete process.env.VERCEL_TEAM_ID
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.R2_ACCOUNT_ID
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.RESEND_API_KEY
  })

  describe('getVercelUsage', () => {
    it('VERCEL_TOKENが未設定の場合はunconfiguredを返す', async () => {
      const result = await getVercelUsage()

      expect(result.name).toBe('Vercel')
      expect(result.status).toBe('unconfigured')
      expect(result.error).toBe('VERCEL_TOKEN が未設定')
    })

    it('トークンが設定されている場合は使用量を取得する', async () => {
      process.env.VERCEL_TOKEN = 'test-token'
      process.env.VERCEL_TEAM_ID = 'test-team'

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            deployments: [
              { created: Date.now() },
              { created: Date.now() },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            projects: [{ id: '1' }, { id: '2' }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            slug: 'test-team',
          }),
        })

      const result = await getVercelUsage()

      expect(result.name).toBe('Vercel')
      expect(result.status).toBe('ok')
      expect(result.usage).toBeDefined()
    })

    it('API呼び出しに失敗した場合はerrorを返す', async () => {
      process.env.VERCEL_TOKEN = 'test-token'

      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await getVercelUsage()

      expect(result.name).toBe('Vercel')
      expect(result.status).toBe('error')
      expect(result.error).toBe('Network error')
    })

    it('チームIDが未設定の場合はユーザー情報から取得する', async () => {
      process.env.VERCEL_TOKEN = 'test-token'

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            user: { defaultTeamId: 'auto-team-id' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ deployments: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ projects: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ slug: 'auto-team' }),
        })

      const result = await getVercelUsage()

      expect(result.status).toBe('ok')
    })
  })

  describe('getCloudflareR2Usage', () => {
    it('CLOUDFLARE_API_TOKENが未設定の場合はunconfiguredを返す', async () => {
      const result = await getCloudflareR2Usage()

      expect(result.name).toBe('Cloudflare R2')
      expect(result.status).toBe('unconfigured')
      expect(result.error).toBe('CLOUDFLARE_API_TOKEN が未設定')
    })

    it('R2_ACCOUNT_IDが未設定の場合はunconfiguredを返す', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'

      const result = await getCloudflareR2Usage()

      expect(result.name).toBe('Cloudflare R2')
      expect(result.status).toBe('unconfigured')
      expect(result.error).toBe('R2_ACCOUNT_ID が未設定')
    })

    it('トークンとアカウントIDが設定されている場合は使用量を取得する', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      process.env.R2_ACCOUNT_ID = 'test-account'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          result: [{ name: 'bucket1' }, { name: 'bucket2' }],
        }),
      })

      const result = await getCloudflareR2Usage()

      expect(result.name).toBe('Cloudflare R2')
      expect(result.status).toBe('ok')
      expect(result.usage).toHaveLength(1)
      expect(result.usage![0].current).toBe(2)
    })

    it('CLOUDFLARE_ACCOUNT_IDも使用可能', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: [] }),
      })

      const result = await getCloudflareR2Usage()

      expect(result.status).toBe('ok')
    })

    it('API呼び出しに失敗した場合はerrorを返す', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      process.env.R2_ACCOUNT_ID = 'test-account'

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({
          errors: [{ message: 'Forbidden' }],
        }),
      })

      const result = await getCloudflareR2Usage()

      expect(result.status).toBe('error')
      expect(result.error).toBe('Forbidden')
    })
  })

  describe('getResendUsage', () => {
    it('RESEND_API_KEYが未設定の場合はunconfiguredを返す', async () => {
      const result = await getResendUsage()

      expect(result.name).toBe('Resend')
      expect(result.status).toBe('unconfigured')
      expect(result.error).toBe('RESEND_API_KEY が未設定')
    })

    it('APIキーが設定されている場合は使用量を取得する', async () => {
      process.env.RESEND_API_KEY = 'test-key'

      const now = new Date()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { created_at: now.toISOString() },
            { created_at: now.toISOString() },
          ],
        }),
      })

      const result = await getResendUsage()

      expect(result.name).toBe('Resend')
      expect(result.status).toBe('ok')
      expect(result.usage).toHaveLength(2)
    })

    it('90%以上使用している場合はwarningを返す', async () => {
      process.env.RESEND_API_KEY = 'test-key'

      const now = new Date()
      // 91通分のデータを作成
      const emails = Array(91).fill(null).map(() => ({
        created_at: now.toISOString(),
      }))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: emails }),
      })

      const result = await getResendUsage()

      expect(result.status).toBe('warning')
    })

    it('API呼び出しに失敗した場合はerrorを返す', async () => {
      process.env.RESEND_API_KEY = 'test-key'

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await getResendUsage()

      expect(result.status).toBe('error')
      expect(result.error).toBe('HTTP 500')
    })

    it('404の場合はエラーを投げずに終了する', async () => {
      process.env.RESEND_API_KEY = 'test-key'

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await getResendUsage()

      expect(result.status).toBe('ok')
      expect(result.usage).toHaveLength(2)
    })

    it('ページネーションを処理する', async () => {
      process.env.RESEND_API_KEY = 'test-key'

      // 古い日付のメールを作成して今月にカウントされないようにする
      const oldDate = new Date()
      oldDate.setMonth(oldDate.getMonth() - 2)

      const emails = Array(100).fill(null).map((_, i) => ({
        id: `email-${i}`,
        created_at: oldDate.toISOString(),
      }))

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: emails }),
        })

      const result = await getResendUsage()

      // 今月/今日のカウントは0なのでok
      expect(result.status).toBe('ok')
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
