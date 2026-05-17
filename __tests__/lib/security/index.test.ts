/**
 * lib/security バレル（index.ts）のカバレッジ用テスト
 * 実装は nonce.test.ts で検証済み。ここでは @/lib/security からの export が利用可能であることを確認する。
 */
import { vi } from 'vitest'

const mockGet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve({ get: mockGet })),
}))

import { getNonce } from '@/lib/security'

describe('lib/security barrel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getNonce is exported and returns nonce from header', async () => {
    mockGet.mockReturnValue('barrel-nonce')
    const nonce = await getNonce()
    expect(nonce).toBe('barrel-nonce')
    expect(mockGet).toHaveBeenCalledWith('x-nonce')
  })
})
