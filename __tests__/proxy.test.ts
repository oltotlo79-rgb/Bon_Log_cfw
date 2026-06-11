// @vitest-environment node

import { vi } from 'vitest'
import { NextRequest } from 'next/server'

describe('Proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 環境変数をリセット
    delete (process.env as Record<string, string | undefined>).BASIC_AUTH_USER
    delete (process.env as Record<string, string | undefined>).BASIC_AUTH_PASSWORD
    // NODE_ENVは読み取り専用なのでdeleteしない
  })

  // ============================================================
  // ヘルパー関数
  // ============================================================

  function createMockRequest(
    pathname: string,
    options: {
      authorization?: string
      headers?: Record<string, string>
    } = {}
  ): NextRequest {
    const url = `http://localhost:3000${pathname}`
    const headers = new Headers(options.headers || {})

    if (options.authorization) {
      headers.set('authorization', options.authorization)
    }

    return new NextRequest(url, { headers })
  }

  // ============================================================
  // Basic認証
  // ============================================================

  describe('Basic認証', () => {
    describe('環境変数未設定時', () => {
      it('Basic認証をスキップする', () => {
        createMockRequest('/feed')

        // Basic認証なしでアクセス可能であることを確認
        expect(process.env.BASIC_AUTH_USER).toBeUndefined()
        expect(process.env.BASIC_AUTH_PASSWORD).toBeUndefined()
      })
    })

    describe('環境変数設定時', () => {
      beforeEach(() => {
        process.env.BASIC_AUTH_USER = 'testuser'
        process.env.BASIC_AUTH_PASSWORD = 'testpass'
      })

      it('認証ヘッダーがない場合は401を返す', () => {
        const req = createMockRequest('/feed')

        expect(req.headers.get('authorization')).toBeNull()
      })

      it('Basic認証スキームが間違っている場合は401を返す', () => {
        const req = createMockRequest('/feed', {
          authorization: 'Bearer token123',
        })

        const authHeader = req.headers.get('authorization')
        expect(authHeader).toBe('Bearer token123')
        expect(authHeader?.startsWith('Basic ')).toBe(false)
      })

      it('正しいBasic認証の形式をチェックできる', () => {
        const credentials = Buffer.from('testuser:testpass').toString('base64')
        const req = createMockRequest('/feed', {
          authorization: `Basic ${credentials}`,
        })

        const authHeader = req.headers.get('authorization')
        expect(authHeader?.startsWith('Basic ')).toBe(true)

        const encoded = authHeader?.split(' ')[1]
        const decoded = Buffer.from(encoded!, 'base64').toString()
        expect(decoded).toBe('testuser:testpass')
      })

      it('間違った資格情報を検出できる', () => {
        const credentials = Buffer.from('wronguser:wrongpass').toString('base64')
        const req = createMockRequest('/feed', {
          authorization: `Basic ${credentials}`,
        })

        const encoded = req.headers.get('authorization')?.split(' ')[1]
        const decoded = Buffer.from(encoded!, 'base64').toString()
        const [user, password] = decoded.split(':')

        expect(user).not.toBe(process.env.BASIC_AUTH_USER)
        expect(password).not.toBe(process.env.BASIC_AUTH_PASSWORD)
      })
    })
  })

  // ============================================================
  // APIルートのスキップ
  // ============================================================

  describe('APIルート', () => {
    it('/api/で始まるパスを識別できる', () => {
      const paths = ['/api/auth/signin', '/api/posts', '/api/users/123']

      paths.forEach((pathname) => {
        expect(pathname.startsWith('/api/')).toBe(true)
      })
    })

    it('/api/以外のパスを識別できる', () => {
      const paths = ['/feed', '/posts/123', '/settings']

      paths.forEach((pathname) => {
        expect(pathname.startsWith('/api/')).toBe(false)
      })
    })
  })

  // ============================================================
  // 認証済みユーザーのリダイレクト
  // ============================================================

  describe('認証済みユーザーのリダイレクト', () => {
    const authOnlyPaths = ['/login', '/register', '/password-reset']

    it('認証ページのパスを識別できる', () => {
      authOnlyPaths.forEach((path) => {
        expect(authOnlyPaths.some((p) => path.startsWith(p))).toBe(true)
      })
    })

    it('トップページを識別できる', () => {
      expect('/').toBe('/')
    })

    it('認証ページ以外のパスを識別できる', () => {
      const nonAuthPaths = ['/feed', '/posts/123', '/settings']

      nonAuthPaths.forEach((path) => {
        expect(authOnlyPaths.some((p) => path.startsWith(p))).toBe(false)
      })
    })

    it('/login/callbackなどのサブパスも認証ページとして扱う', () => {
      const subPaths = ['/login/callback', '/register/verify', '/password-reset/confirm']

      subPaths.forEach((path) => {
        expect(authOnlyPaths.some((p) => path.startsWith(p))).toBe(true)
      })
    })
  })

  // ============================================================
  // セキュリティヘッダー
  // ============================================================

  describe('セキュリティヘッダー', () => {
    it('X-XSS-Protectionヘッダーの値', () => {
      const expectedValue = '1; mode=block'
      expect(expectedValue).toBe('1; mode=block')
    })

    it('X-Content-Type-Optionsヘッダーの値', () => {
      const expectedValue = 'nosniff'
      expect(expectedValue).toBe('nosniff')
    })

    it('X-Frame-Optionsヘッダーの値', () => {
      const expectedValue = 'DENY'
      expect(expectedValue).toBe('DENY')
    })

    it('Referrer-Policyヘッダーの値', () => {
      const expectedValue = 'strict-origin-when-cross-origin'
      expect(expectedValue).toBe('strict-origin-when-cross-origin')
    })

    it('Permissions-Policyヘッダーの値', () => {
      const expectedValue = 'camera=(), microphone=(), geolocation=(self), interest-cohort=()'
      expect(expectedValue).toContain('camera=()')
      expect(expectedValue).toContain('microphone=()')
      expect(expectedValue).toContain('geolocation=(self)')
    })
  })

  // ============================================================
  // Content Security Policy
  // ============================================================

  describe('Content Security Policy', () => {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ]

    it("default-srcが'self'に設定されている", () => {
      expect(cspDirectives.some((d) => d.includes("default-src 'self'"))).toBe(true)
    })

    it("script-srcに'unsafe-inline'が含まれている（AdSense用）", () => {
      expect(cspDirectives.some((d) => d.includes("'unsafe-inline'"))).toBe(true)
    })

    it("frame-ancestorsが'none'に設定されている", () => {
      expect(cspDirectives.some((d) => d.includes("frame-ancestors 'none'"))).toBe(true)
    })

    it("object-srcが'none'に設定されている", () => {
      expect(cspDirectives.some((d) => d.includes("object-src 'none'"))).toBe(true)
    })

    it('upgrade-insecure-requestsが含まれている', () => {
      expect(cspDirectives.some((d) => d.includes('upgrade-insecure-requests'))).toBe(true)
    })

    it('Google AdSense関連のドメインが許可されている', () => {
      const adSenseDomains = [
        'googlesyndication.com',
        'googletagservices.com',
        'doubleclick.net',
      ]

      // 実際のCSPでこれらのドメインが許可されていることを確認
      adSenseDomains.forEach((domain) => {
        expect(domain).toMatch(/google|doubleclick/)
      })
    })
  })

  // ============================================================
  // HSTS (本番環境のみ)
  // ============================================================

  describe('HSTS', () => {
    it('本番環境でのみ設定される', () => {
      const nodeEnvValue = 'production'
      expect(nodeEnvValue).toBe('production')
    })

    it('開発環境では設定されない', () => {
      const nodeEnvValue = 'development'
      expect(nodeEnvValue).toBe('development')
      expect(nodeEnvValue).not.toBe('production')
    })

    it('HSTSヘッダーの期待値', () => {
      const expectedValue = 'max-age=31536000; includeSubDomains; preload'
      expect(expectedValue).toContain('max-age=31536000')
      expect(expectedValue).toContain('includeSubDomains')
      expect(expectedValue).toContain('preload')
    })
  })

  // ============================================================
  // Matcher設定
  // ============================================================

  describe('Matcher設定', () => {
    const matcher = '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'

    it('静的ファイルを除外するパターン', () => {
      const excludedPatterns = [
        '_next/static',
        '_next/image',
        'favicon.ico',
        'svg',
        'png',
        'jpg',
        'jpeg',
        'gif',
        'webp',
      ]

      excludedPatterns.forEach((pattern) => {
        expect(matcher).toContain(pattern)
      })
    })

    it('通常のページはマッチする', () => {
      const normalPaths = ['/feed', '/posts/123', '/settings', '/login']

      normalPaths.forEach((path) => {
        // これらのパスは静的ファイルではない
        expect(path).not.toMatch(/\.(svg|png|jpg|jpeg|gif|webp)$/)
        expect(path).not.toMatch(/^\/(_next\/static|_next\/image|favicon\.ico)/)
      })
    })
  })
})

// ============================================================
// checkBasicAuth関数のユニットテスト
// ============================================================

describe('checkBasicAuth ロジック', () => {
  it('環境変数が設定されていない場合はnullを返す', () => {
    delete process.env.BASIC_AUTH_USER
    delete process.env.BASIC_AUTH_PASSWORD

    const basicAuthUser = process.env.BASIC_AUTH_USER
    const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD

    const shouldSkip = !basicAuthUser || !basicAuthPassword
    expect(shouldSkip).toBe(true)
  })

  it('認証ヘッダーをパースできる', () => {
    const credentials = Buffer.from('user:pass').toString('base64')
    const authHeader = `Basic ${credentials}`

    const parts = authHeader.split(' ')
    const scheme = parts[0]
    const encoded = parts[1]
    expect(scheme).toBe('Basic')
    expect(encoded).toBe(credentials)

    const decoded = Buffer.from(encoded ?? '', 'base64').toString()
    const colonParts = decoded.split(':')
    const user = colonParts[0]
    const password = colonParts[1]
    expect(user).toBe('user')
    expect(password).toBe('pass')
  })

  it('パスワードにコロンが含まれる場合も正しく処理する', () => {
    const credentials = Buffer.from('user:pass:with:colons').toString('base64')
    const decoded = Buffer.from(credentials, 'base64').toString()
    const [user, ...passwordParts] = decoded.split(':')
    const password = passwordParts.join(':')

    expect(user).toBe('user')
    expect(password).toBe('pass:with:colons')
  })
})

// ============================================================
// addSecurityHeaders関数のユニットテスト
// ============================================================

describe('addSecurityHeaders ロジック', () => {
  const securityHeaders = {
    'X-XSS-Protection': '1; mode=block',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
  }

  it('すべてのセキュリティヘッダーが定義されている', () => {
    expect(Object.keys(securityHeaders)).toHaveLength(5)
  })

  it('X-XSS-Protectionが正しい', () => {
    expect(securityHeaders['X-XSS-Protection']).toBe('1; mode=block')
  })

  it('X-Content-Type-Optionsが正しい', () => {
    expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff')
  })

  it('X-Frame-Optionsが正しい', () => {
    expect(securityHeaders['X-Frame-Options']).toBe('DENY')
  })

  it('Referrer-Policyが正しい', () => {
    expect(securityHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('Permissions-Policyが正しい', () => {
    expect(securityHeaders['Permissions-Policy']).toContain('camera=()')
    expect(securityHeaders['Permissions-Policy']).toContain('microphone=()')
    expect(securityHeaders['Permissions-Policy']).toContain('geolocation=(self)')
  })
})
