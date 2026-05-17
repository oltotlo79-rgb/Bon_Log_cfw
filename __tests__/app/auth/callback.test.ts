import { vi } from 'vitest'
/**
 * Auth Callback Route テスト
 */

// Next.js Response/Requestをモック
vi.mock('next/server', () => ({
  NextResponse: {
    redirect: vi.fn((url: string) => ({
      status: 307,
      headers: new Map([['Location', url]]),
    })),
  },
}))

describe('Auth Callback Route', async () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('should redirect to login page', async () => {
    const { NextResponse } = await import('next/server')
    const mockRedirect = NextResponse.redirect as ReturnType<typeof vi.fn>

    // GETをテスト
    const { GET } = await import('@/app/auth/callback/route')

    const mockRequest = {
      url: 'https://bon-log.com/auth/callback?code=test',
    } as Request

    await GET(mockRequest)

    expect(mockRedirect).toHaveBeenCalledWith('https://bon-log.com/login')
  })

  it('should preserve origin in redirect', async () => {
    const { NextResponse } = await import('next/server')
    const mockRedirect = NextResponse.redirect as ReturnType<typeof vi.fn>

    const { GET } = await import('@/app/auth/callback/route')

    const mockRequest = {
      url: 'http://localhost:3000/auth/callback',
    } as Request

    await GET(mockRequest)

    expect(mockRedirect).toHaveBeenCalledWith('http://localhost:3000/login')
  })
})
