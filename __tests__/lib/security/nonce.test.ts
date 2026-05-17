import { vi } from 'vitest'
/**
 * CSP nonce取得ユーティリティのテスト
 */

// headers()をモック
const mockGet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve({
    get: mockGet,
  })),
}))

import { getNonce } from '@/lib/security/nonce'

describe('nonce', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getNonce', () => {
    it('x-nonceヘッダーが存在する場合はnonce値を返す', async () => {
      mockGet.mockReturnValue('test-nonce-value')

      const nonce = await getNonce()

      expect(nonce).toBe('test-nonce-value')
      expect(mockGet).toHaveBeenCalledWith('x-nonce')
    })

    it('x-nonceヘッダーが存在しない場合はundefinedを返す', async () => {
      mockGet.mockReturnValue(null)

      const nonce = await getNonce()

      expect(nonce).toBeUndefined()
    })
  })
})
