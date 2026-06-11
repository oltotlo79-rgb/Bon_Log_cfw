// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/actions/utils', () => ({
  requireAdmin: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Sentry Admin API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.SENTRY_API_TOKEN
    delete process.env.SENTRY_AUTH_TOKEN
    delete process.env.SENTRY_ORG
    delete process.env.SENTRY_PROJECT
    delete process.env.SENTRY_API_URL
  })

  it('管理者でなければ401を返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ error: '認証が必要です' })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('管理者でないユーザーは403を返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ error: '管理者権限が必要です' })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    expect(response.status).toBe(403)
  })

  it('SENTRY_API_TOKEN未設定でエラーを返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(false)
    expect(data.error).toContain('SENTRY_API_TOKEN')
  })

  it('Sentryからissue一覧を正常取得', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'

    const mockIssues = [
      { id: '1', shortId: 'TEST-1', title: 'Error', level: 'error', status: 'unresolved' },
    ]
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIssues),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.issues).toBeDefined()
  })

  it('Sentry APIエラー時にエラーを返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'

    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(false)
  })

  it('SENTRY_AUTH_TOKENをフォールバックとして使用する', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    delete process.env.SENTRY_API_TOKEN
    process.env.SENTRY_AUTH_TOKEN = 'fallback-token'

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer fallback-token',
        },
      })
    )
  })

  it('sntrys_ トークンからリージョンURLを抽出する', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })

    const payload = { region_url: 'https://eu.sentry.io' }
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64')
    process.env.SENTRY_API_TOKEN = `sntrys_${base64Payload}_signature`

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://eu.sentry.io'),
      expect.anything()
    )
  })

  it('不正なsntrys_トークンはデフォルトURLを使用する', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'sntrys_invalid_signature'

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://us.sentry.io'),
      expect.anything()
    )
  })

  it('デフォルトのorg/projectを使用する', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'
    delete process.env.SENTRY_ORG
    delete process.env.SENTRY_PROJECT

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('bon-log'),
      expect.anything()
    )
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('bonsai-sns'),
      expect.anything()
    )
  })

  it('SENTRY_API_URLをカスタマイズできる', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'
    process.env.SENTRY_API_URL = 'https://custom.sentry.io'

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://custom.sentry.io'),
      expect.anything()
    )
  })

  it('Sentry API 401エラーを処理する', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(false)
    expect(data.error).toBe('Sentry API: 401')
    expect(data.helpText).toContain('トークンが無効')
  })

  it('Sentry API 400エラーを処理する', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'

    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(false)
    expect(data.error).toBe('Sentry API: 400')
    expect(data.helpText).toContain('リクエストエラー')
  })

  it('Sentry API 404エラーを処理する', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'

    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not Found'),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(false)
    expect(data.error).toBe('Sentry API: 404')
    expect(data.helpText).toContain('プロジェクトが見つかりません')
  })

  it('その他のSentry APIエラーを処理する', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(false)
    expect(data.error).toBe('Sentry API: 500')
  })

  it('エラーレスポンスのJSONパースに失敗した場合', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'

    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Not valid JSON'),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const { logger } = await import('@/lib/logger')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(false)
    expect(logger.error).toHaveBeenCalled()
  })

  it('予期しないエラー時に500を返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'

    mockFetch.mockRejectedValue(new Error('Network error'))

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.error).toBe('Internal server error')
    expect(response.status).toBe(500)
  })

  it('複数のissuesをマッピングして返す', async () => {
    const { requireAdmin } = await import('@/lib/actions/utils')
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'admin' as const })
    process.env.SENTRY_API_TOKEN = 'test-token'

    const mockIssues = [
      {
        id: 'issue-1',
        shortId: 'ISSUE-1',
        title: 'Error 1',
        culprit: 'test1.js',
        level: 'error' as const,
        status: 'unresolved',
        count: '5',
        userCount: 3,
        firstSeen: '2024-01-01T00:00:00Z',
        lastSeen: '2024-01-02T00:00:00Z',
        permalink: 'https://sentry.io/issue-1',
      },
      {
        id: 'issue-2',
        shortId: 'ISSUE-2',
        title: 'Warning 1',
        culprit: 'test2.js',
        level: 'warning' as const,
        status: 'unresolved',
        count: '2',
        userCount: 1,
        firstSeen: '2024-01-03T00:00:00Z',
        lastSeen: '2024-01-04T00:00:00Z',
        permalink: 'https://sentry.io/issue-2',
      },
    ]

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockIssues),
    })

    const { GET } = await import('@/app/api/admin/sentry/route')
    const response = await GET()
    const data = await response.json()

    expect(data.success).toBe(true)
    expect(data.issues).toHaveLength(2)
    expect(data.issues[0].title).toBe('Error 1')
    expect(data.issues[1].title).toBe('Warning 1')
    expect(data.fetchedAt).toBeDefined()
  })
})
