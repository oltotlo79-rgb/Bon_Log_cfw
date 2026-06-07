// @vitest-environment node

import { vi } from 'vitest'
import {
  getFlyioUsage,
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
    delete process.env.FLY_API_TOKEN
    delete process.env.FLY_ACCESS_TOKEN
    delete process.env.FLY_APP_NAME
    delete process.env.FLY_REGION
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.R2_ACCOUNT_ID
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.RESEND_API_KEY
  })

  describe('getFlyioUsage', () => {
    it('トークンも fly.io ランタイムも無い場合は unconfigured を返す', async () => {
      const result = await getFlyioUsage()

      expect(result.name).toBe('fly.io')
      expect(result.status).toBe('unconfigured')
      expect(result.error).toBe('FLY_API_TOKEN が未設定')
    })

    it('トークン設定時は GraphQL でアプリ数を取得する', async () => {
      process.env.FLY_API_TOKEN = 'test-token'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { apps: { nodes: [{ name: 'bon-log' }, { name: 'other' }] } },
        }),
      })

      const result = await getFlyioUsage()

      expect(result.name).toBe('fly.io')
      expect(result.status).toBe('ok')
      expect(result.usage).toBeDefined()
      expect(result.usage![0].current).toBe(2)
    })

    it('トークンあり・FLY_APP_NAMEなしで API 失敗時は error を返す', async () => {
      process.env.FLY_API_TOKEN = 'test-token'

      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await getFlyioUsage()

      expect(result.name).toBe('fly.io')
      expect(result.status).toBe('error')
      expect(result.error).toBe('Network error')
    })

    it('fly.io ランタイム(FLY_APP_NAME)があればトークン無しでも ok で基本情報を返す', async () => {
      process.env.FLY_APP_NAME = 'bon-log'
      process.env.FLY_REGION = 'nrt'

      const result = await getFlyioUsage()

      expect(result.name).toBe('fly.io')
      expect(result.status).toBe('ok')
      expect(result.helpText).toContain('bon-log')
      expect(result.helpText).toContain('nrt')
      expect(result.dashboardUrl).toBe('https://fly.io/apps/bon-log')
      // トークン無しのため GraphQL は呼ばれない
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('FLY_APP_NAME あり・トークンありで GraphQL 失敗時もランタイム情報で ok を維持する', async () => {
      process.env.FLY_API_TOKEN = 'test-token'
      process.env.FLY_APP_NAME = 'bon-log'

      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await getFlyioUsage()

      expect(result.status).toBe('ok')
      expect(result.helpText).toContain('bon-log')
    })

    it('トークンあり・FLY_APP_NAMEありで稼働マシン数を取得する', async () => {
      process.env.FLY_API_TOKEN = 'test-token'
      process.env.FLY_APP_NAME = 'bon-log'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: { app: { machines: { nodes: [{ state: 'started' }, { state: 'stopped' }] } } },
        }),
      })

      const result = await getFlyioUsage()

      expect(result.status).toBe('ok')
      expect(result.usage![0].current).toBe(1) // started のみ
      expect(result.usage![0].limit).toBe(2) // 総数
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
