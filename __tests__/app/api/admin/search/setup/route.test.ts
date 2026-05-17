// @vitest-environment node

import { vi } from 'vitest'
/**
 * 全文検索セットアップAPI のテスト
 */

// モック定義
const mockAuth = vi.fn()
const mockAdminUserFindUnique = vi.fn()
const mockGetSearchStatus = vi.fn()
const mockGetSearchIndexes = vi.fn()
const mockSetupFulltextSearch = vi.fn()
const mockCreateSearchIndexes = vi.fn()
const mockEnableExtension = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    adminUser: {
      findUnique: (...args: unknown[]) => mockAdminUserFindUnique(...args),
    },
  },
}))

vi.mock('@/lib/search/fulltext', () => ({
  getSearchStatus: (...args: unknown[]) => mockGetSearchStatus(...args),
  getSearchIndexes: (...args: unknown[]) => mockGetSearchIndexes(...args),
  setupFulltextSearch: (...args: unknown[]) => mockSetupFulltextSearch(...args),
  createSearchIndexes: (...args: unknown[]) => mockCreateSearchIndexes(...args),
  enableExtension: (...args: unknown[]) => mockEnableExtension(...args),
}))

import { GET, POST } from '@/app/api/admin/search/setup/route'

describe('GET /api/admin/search/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証の場合401を返す', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe('認証が必要です')
  })

  it('管理者でない場合403を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockAdminUserFindUnique.mockResolvedValue(null)

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toBe('管理者権限が必要です')
  })

  it('管理者の場合ステータス情報を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockGetSearchStatus.mockResolvedValue({
      mode: 'trgm',
      bigmAvailable: false,
      trgmAvailable: true,
    })
    mockGetSearchIndexes.mockResolvedValue([
      { name: 'posts_content_trgm_idx' },
      { name: 'users_nickname_trgm_idx' },
      { name: 'users_bio_trgm_idx' },
      { name: 'bonsai_shops_name_trgm_idx' },
      { name: 'bonsai_shops_address_trgm_idx' },
      { name: 'events_title_trgm_idx' },
      { name: 'events_description_trgm_idx' },
      { name: 'bonsais_name_trgm_idx' },
      { name: 'bonsais_species_trgm_idx' },
      { name: 'bonsais_description_trgm_idx' },
      { name: 'hashtags_name_trgm_idx' },
      { name: 'comments_content_trgm_idx' },
    ])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status.currentMode).toBe('trgm')
    expect(json.status.extensionStatus.pg_trgm).toBe(true)
    expect(json.status.isOptimal).toBe(true)
    expect(json.indexes.missing).toHaveLength(0)
    expect(json.indexes.total).toBe(12)
    expect(json.recommendations).toContain('全文検索は最適な状態で動作しています。')
  })

  it('pg_trgmが無効な場合の推奨事項を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockGetSearchStatus.mockResolvedValue({
      mode: 'like',
      bigmAvailable: false,
      trgmAvailable: false,
    })
    mockGetSearchIndexes.mockResolvedValue([])

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.status.isOptimal).toBe(false)
    expect(json.recommendations).toContain(
      'pg_trgm拡張が有効化されていません。「拡張を有効化」ボタンをクリックしてください。'
    )
  })

  it('trgm有効だがモードがlikeの場合の推奨事項を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockGetSearchStatus.mockResolvedValue({
      mode: 'like',
      bigmAvailable: false,
      trgmAvailable: true,
    })
    mockGetSearchIndexes.mockResolvedValue([])

    const response = await GET()
    const json = await response.json()

    expect(json.recommendations).toContain(
      '環境変数 SEARCH_MODE=trgm を設定することで、全文検索のパフォーマンスが向上します。'
    )
  })

  it('インデックスが不足している場合の推奨事項を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockGetSearchStatus.mockResolvedValue({
      mode: 'trgm',
      bigmAvailable: false,
      trgmAvailable: true,
    })
    mockGetSearchIndexes.mockResolvedValue([
      { name: 'posts_content_trgm_idx' },
    ])

    const response = await GET()
    const json = await response.json()

    expect(json.indexes.missing.length).toBeGreaterThan(0)
    expect(json.recommendations.some((r: string) => r.includes('GINインデックスが不足'))).toBe(true)
  })

  it('エラー発生時に500を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockGetSearchStatus.mockRejectedValue(new Error('DB error'))

    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('検索ステータスの取得に失敗しました')
  })
})

describe('POST /api/admin/search/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createRequest(body: object): Request {
    return new Request('http://localhost/api/admin/search/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('未認証の場合401を返す', async () => {
    mockAuth.mockResolvedValue(null)

    const response = await POST(createRequest({ action: 'full_setup' }))
    const json = await response.json()

    expect(response.status).toBe(401)
    expect(json.error).toBe('認証が必要です')
  })

  it('管理者でない場合403を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockAdminUserFindUnique.mockResolvedValue(null)

    const response = await POST(createRequest({ action: 'full_setup' }))
    const json = await response.json()

    expect(response.status).toBe(403)
    expect(json.error).toBe('管理者権限が必要です')
  })

  it('enable_extensionアクションを実行する', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockEnableExtension.mockResolvedValue(true)

    const response = await POST(createRequest({ action: 'enable_extension' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.message).toBe('pg_trgm拡張を有効化しました')
    expect(mockEnableExtension).toHaveBeenCalledWith('pg_trgm')
  })

  it('enable_extension失敗時のメッセージを返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockEnableExtension.mockResolvedValue(false)

    const response = await POST(createRequest({ action: 'enable_extension' }))
    const json = await response.json()

    expect(json.success).toBe(false)
    expect(json.message).toContain('有効化に失敗しました')
  })

  it('create_indexesアクションを実行する', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockCreateSearchIndexes.mockResolvedValue({
      success: true,
      message: 'インデックスを作成しました',
      details: ['idx1', 'idx2'],
    })

    const response = await POST(createRequest({ action: 'create_indexes' }))
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.message).toBe('インデックスを作成しました')
    expect(json.details).toEqual(['idx1', 'idx2'])
  })

  it('full_setupアクションを実行する（成功）', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockSetupFulltextSearch.mockResolvedValue({
      success: true,
      steps: ['step1', 'step2'],
    })

    const response = await POST(createRequest({ action: 'full_setup' }))
    const json = await response.json()

    expect(json.success).toBe(true)
    expect(json.message).toBe('全文検索のセットアップが完了しました')
    expect(json.steps).toEqual(['step1', 'step2'])
  })

  it('full_setupアクションを実行する（失敗）', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockSetupFulltextSearch.mockResolvedValue({
      success: false,
      steps: ['step1 failed'],
    })

    const response = await POST(createRequest({ action: 'full_setup' }))
    const json = await response.json()

    expect(json.success).toBe(false)
    expect(json.message).toBe('全文検索のセットアップ中にエラーが発生しました')
  })

  it('不正なアクションの場合400を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })

    const response = await POST(createRequest({ action: 'invalid_action' }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toBe('不正なアクションです')
  })

  it('エラー発生時に500を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockAdminUserFindUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })

    const badRequest = {
      json: () => { throw new Error('Parse error') },
    } as unknown as Request

    const response = await POST(badRequest)
    const json = await response.json()

    expect(response.status).toBe(500)
    expect(json.error).toBe('セットアップに失敗しました')
  })
})
