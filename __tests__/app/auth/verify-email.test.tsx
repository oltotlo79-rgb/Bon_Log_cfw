import { vi } from 'vitest'

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

const mockVerifyEmailToken = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  verifyEmailToken: (...args: unknown[]) => mockVerifyEmailToken(...args),
}))

import VerifyEmailPage from '@/app/(auth)/verify-email/page'

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Next.js の redirect() は throw で処理を中断するため、テストでも同様にする
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT')
    })
  })

  it('token がない場合は /login にリダイレクトする', async () => {
    await expect(
      VerifyEmailPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login')
    expect(mockVerifyEmailToken).not.toHaveBeenCalled()
  })

  it('有効な token で検証成功時は /login?verified=1 にリダイレクトする', async () => {
    mockVerifyEmailToken.mockResolvedValueOnce({ success: true })

    await expect(
      VerifyEmailPage({
        searchParams: Promise.resolve({ token: 'valid-token-123' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockVerifyEmailToken).toHaveBeenCalledWith('valid-token-123')
    expect(mockRedirect).toHaveBeenCalledWith('/login?verified=1')
  })

  it('検証失敗時はリダイレクトせずエラー表示用のJSXを返す', async () => {
    mockVerifyEmailToken.mockResolvedValueOnce({
      error: 'リンクの有効期限が切れています。確認メールの再送をお試しください。',
    })

    const result = await VerifyEmailPage({
      searchParams: Promise.resolve({ token: 'expired-token' }),
    })

    expect(mockVerifyEmailToken).toHaveBeenCalledWith('expired-token')
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(result).toBeDefined()
    expect(result).not.toBeNull()
  })
})
