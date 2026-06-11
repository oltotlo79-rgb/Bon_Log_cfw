import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/auth.config', () => ({
  authConfig: {
    providers: [],
    pages: { signIn: '/login' },
    callbacks: {},
  },
}))

vi.mock('@/lib/env', () => ({
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}))

vi.mock('@/lib/constants/limits', () => ({
  NONCE_BYTE_LENGTH: 16,
  HSTS_MAX_AGE_SECONDS: 31536000,
}))

vi.mock('@/lib/constants/routes', () => ({
  PROTECTED_PATHS: ['/feed', '/posts', '/settings', '/notifications', '/bookmarks', '/users', '/messages', '/drafts', '/bonsai', '/admin', '/analytics', '/pesticides', '/dictionary'],
  MAINTENANCE_ALLOWED_PATHS: ['/', '/login', '/register', '/password-reset', '/maintenance', '/api/auth'],
  AUTH_ONLY_PATHS: ['/login', '/register', '/password-reset'],
  WEBHOOK_PATHS: ['/api/webhooks/', '/api/cron/'],
  ROUTE_ADMIN: '/admin',
  ROUTE_LOGIN: '/login',
  ROUTE_FEED: '/feed',
  ROUTE_HOME: '/',
  ROUTE_MAINTENANCE: '/maintenance',
  ROUTE_AD_FRAME_API: '/api/ad-frame',
  NEXT_INTERNAL_PREFIX: '/_next',
  API_PREFIX: '/api/',
  API_AUTH_PREFIX: '/api/auth',
}))

// Mock NextAuth - capture the callback
let authCallback: ((req: unknown) => unknown) | null = null

vi.mock('next-auth', () => {
  return {
    default: (_config: unknown) => {
      return {
        auth: (cb: (req: unknown) => unknown) => {
          authCallback = cb
          return cb
        },
        handlers: {},
        signIn: vi.fn(),
        signOut: vi.fn(),
      }
    },
  }
})

// Mock NextResponse
const mockRedirect = vi.fn().mockImplementation((url: URL) => ({
  type: 'redirect',
  url: url.toString(),
  headers: new Map(),
}))

const mockNext = vi.fn().mockImplementation(() => ({
  type: 'next',
  headers: new Map(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (...args: unknown[]) => mockRedirect(...args),
    next: (...args: unknown[]) => mockNext(...args),
  },
}))

// Mock crypto.getRandomValues for nonce generation
const _originalCrypto = globalThis.crypto
beforeEach(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256)
          }
          return arr
        },
      },
      writable: true,
      configurable: true,
    })
  }
})

describe('proxy admin route protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedirect.mockImplementation((url: URL) => ({
      type: 'redirect',
      url: url.toString(),
      headers: new Map(),
    }))
    mockNext.mockImplementation(() => ({
      type: 'next',
      headers: new Map(),
    }))
  })

  function createMockRequest(pathname: string, auth: { user?: { id: string; isAdmin?: boolean } } | null) {
    // 実際の NextRequest.headers は Headers インスタンス。
    // proxy の nextWithNonce で new Headers(request.headers) が呼ばれるため、
    // 本物と同じ形で渡す必要がある。
    return {
      nextUrl: new URL(`http://localhost:3000${pathname}`),
      method: 'GET',
      headers: new Headers(),
      auth: auth,
    }
  }

  it('未認証ユーザーが/adminにアクセスした場合、ログインにリダイレクトされること', async () => {
    // Import to trigger auth callback registration
    await import('../../proxy')

    expect(authCallback).not.toBeNull()

    const req = createMockRequest('/admin', null)
    await authCallback!(req)

    // /admin is in PROTECTED_PATHS and user is not logged in
    expect(mockRedirect).toHaveBeenCalled()
    const redirectCall = mockRedirect.mock.calls[0]!
    const redirectUrl = redirectCall[0] as URL
    expect(redirectUrl.pathname).toBe('/login')
    expect(redirectUrl.searchParams.get('callbackUrl')).toBe('/admin')
  })

  it('非管理者ユーザーが/adminにアクセスした場合、/feedにリダイレクトされること', async () => {
    await import('../../proxy')

    expect(authCallback).not.toBeNull()

    const req = createMockRequest('/admin', { user: { id: 'user-1', isAdmin: false } })
    await authCallback!(req)

    // Logged in but not admin -> redirect to /feed
    expect(mockRedirect).toHaveBeenCalled()
    const redirectCalls = mockRedirect.mock.calls
    // Find the /feed redirect (not the /login one)
    const feedRedirect = redirectCalls.find(
      (call) => (call[0] as URL).pathname === '/feed'
    )
    expect(feedRedirect).toBeTruthy()
  })

  it('管理者ユーザーが/adminにアクセスした場合、アクセスが許可されること', async () => {
    await import('../../proxy')

    expect(authCallback).not.toBeNull()

    const req = createMockRequest('/admin', { user: { id: 'admin-1', isAdmin: true } })
    await authCallback!(req)

    // Admin user should not be redirected away from /admin
    // Check that no redirect to /feed or /login was made
    const redirectCalls = mockRedirect.mock.calls
    const adminRedirect = redirectCalls.find(
      (call) => {
        const url = call[0] as URL
        return url.pathname === '/feed' || url.pathname === '/login'
      }
    )
    // Either no redirect at all, or NextResponse.next() was called
    if (redirectCalls.length > 0 && adminRedirect) {
      // This should not happen for admin users
      expect(adminRedirect).toBeUndefined()
    } else {
      expect(mockNext).toHaveBeenCalled()
    }
  })

  it('管理者ユーザーが/admin/usersにアクセスした場合、アクセスが許可されること', async () => {
    await import('../../proxy')

    expect(authCallback).not.toBeNull()

    const req = createMockRequest('/admin/users', { user: { id: 'admin-1', isAdmin: true } })
    await authCallback!(req)

    // Admin user should pass through
    const redirectCalls = mockRedirect.mock.calls
    const blockedRedirect = redirectCalls.find(
      (call) => {
        const url = call[0] as URL
        return url.pathname === '/feed' || url.pathname === '/login'
      }
    )
    expect(blockedRedirect).toBeUndefined()
  })

  it('未認証ユーザーが/admin/usersにアクセスした場合、ログインにリダイレクトされること', async () => {
    await import('../../proxy')

    expect(authCallback).not.toBeNull()

    const req = createMockRequest('/admin/users', null)
    await authCallback!(req)

    expect(mockRedirect).toHaveBeenCalled()
    const redirectCall = mockRedirect.mock.calls[0]!
    const redirectUrl = redirectCall[0] as URL
    expect(redirectUrl.pathname).toBe('/login')
  })
})
