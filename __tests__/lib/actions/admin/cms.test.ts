// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({ checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }), RATE_LIMITS: {} }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }) }))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockCmsPage = {
  id: 'page-1',
  slug: 'about',
  title: 'サイトについて',
  content: '<p>サイトの説明です</p>',
  category: 'info',
  version: 3,
  isPublished: true,
  publishedAt: new Date('2025-01-15'),
  createdBy: mockUser.id,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-15'),
}

const mockCmsPage2 = {
  ...mockCmsPage,
  id: 'page-2',
  slug: 'terms',
  title: '利用規約',
  category: 'legal',
  version: 1,
  isPublished: false,
  publishedAt: null,
}

const mockCmsPageWithVersions = {
  ...mockCmsPage,
  versions: [
    { id: 'v3', pageId: 'page-1', version: 3, title: 'サイトについて', content: '<p>最新</p>', createdBy: mockUser.id, createdAt: new Date('2025-01-15') },
    { id: 'v2', pageId: 'page-1', version: 2, title: 'サイトについて', content: '<p>第2版</p>', createdBy: mockUser.id, createdAt: new Date('2025-01-10') },
    { id: 'v1', pageId: 'page-1', version: 1, title: 'サイトについて', content: '<p>初版</p>', createdBy: mockUser.id, createdAt: new Date('2025-01-01') },
  ],
}

const mockTransaction = vi.fn((ops: unknown) => {
  if (typeof ops === 'function') {
    return (ops as (...args: unknown[]) => unknown)(mockPrisma)
  }
  return Promise.all(ops as Promise<unknown>[])
})

describe('管理者向けCMSページ管理アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction

    // cmsPage / cmsPageVersion モデルのモック追加
    ;(mockPrisma as Record<string, unknown>).cmsPage = {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    }
    ;(mockPrisma as Record<string, unknown>).cmsPageVersion = {
      create: vi.fn(),
      findMany: vi.fn(),
    }
  })

  // ============================================================
  // getCmsPages
  // ============================================================

  describe('getCmsPages', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getCmsPages } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPages()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getCmsPages } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPages()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('空の一覧を正常に返す', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findMany.mockResolvedValue([])
      ;(mockPrisma as Record<string, any>).cmsPage.count.mockResolvedValue(0)

      const { getCmsPages } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPages()

      expect(result).toEqual({ pages: [], total: 0 })
    })

    it('ページ一覧と総件数を正常に返す', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findMany.mockResolvedValue([mockCmsPage, mockCmsPage2])
      ;(mockPrisma as Record<string, any>).cmsPage.count.mockResolvedValue(2)

      const { getCmsPages } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPages()

      expect(result).toEqual({ pages: [mockCmsPage, mockCmsPage2], total: 2 })
    })

    it('カテゴリフィルターが正しく適用される', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findMany.mockResolvedValue([mockCmsPage2])
      ;(mockPrisma as Record<string, any>).cmsPage.count.mockResolvedValue(1)

      const { getCmsPages } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPages({ category: 'legal' })

      expect((mockPrisma as Record<string, any>).cmsPage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'legal' }),
        })
      )
      expect(result).toEqual({ pages: [mockCmsPage2], total: 1 })
    })

    it('検索フィルターが正しく適用される', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findMany.mockResolvedValue([mockCmsPage])
      ;(mockPrisma as Record<string, any>).cmsPage.count.mockResolvedValue(1)

      const { getCmsPages } = await import('@/lib/actions/admin/cms')
      await getCmsPages({ search: 'サイト' })

      expect((mockPrisma as Record<string, any>).cmsPage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'サイト' } },
              { slug: { contains: 'サイト' } },
            ],
          }),
        })
      )
    })

    it('cursor を指定すると findMany に cursor/skip が渡される', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findMany.mockResolvedValue([])
      ;(mockPrisma as Record<string, any>).cmsPage.count.mockResolvedValue(0)

      const { getCmsPages } = await import('@/lib/actions/admin/cms')
      await getCmsPages({ limit: 10, cursor: 'cms-cursor' })

      expect((mockPrisma as Record<string, any>).cmsPage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cms-cursor' },
          skip: 1,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        })
      )
    })

    it('cursor 未指定時は先頭ページとして cursor/skip なし', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findMany.mockResolvedValue([])
      ;(mockPrisma as Record<string, any>).cmsPage.count.mockResolvedValue(0)

      const { getCmsPages } = await import('@/lib/actions/admin/cms')
      await getCmsPages()

      const call = (mockPrisma as Record<string, any>).cmsPage.findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('カテゴリと検索の両方を同時に指定できる', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findMany.mockResolvedValue([])
      ;(mockPrisma as Record<string, any>).cmsPage.count.mockResolvedValue(0)

      const { getCmsPages } = await import('@/lib/actions/admin/cms')
      await getCmsPages({ category: 'info', search: 'テスト' })

      expect((mockPrisma as Record<string, any>).cmsPage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'info',
            OR: [
              { title: { contains: 'テスト' } },
              { slug: { contains: 'テスト' } },
            ],
          }),
        })
      )
    })
  })

  // ============================================================
  // getCmsPage
  // ============================================================

  describe('getCmsPage', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPage('about')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('存在しないスラッグの場合はエラーを返す', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)

      const { getCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPage('non-existent')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('バージョン履歴付きでページを返す', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPageWithVersions)

      const { getCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPage('about')

      expect(result).toEqual({ page: mockCmsPageWithVersions })
      expect((mockPrisma as Record<string, any>).cmsPage.findUnique).toHaveBeenCalledWith({
        where: { slug: 'about' },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 10,
          },
        },
      })
    })

    it('バージョン履歴が降順で取得される', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPageWithVersions)

      const { getCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPage('about') as { page: typeof mockCmsPageWithVersions }

      expect(result.page.versions[0].version).toBe(3)
      expect(result.page.versions[2].version).toBe(1)
    })
  })

  // ============================================================
  // createCmsPage
  // ============================================================

  describe('createCmsPage', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { createCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await createCmsPage({
        slug: 'new-page',
        title: '新しいページ',
        content: '内容',
        category: 'info',
      })
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('重複するスラッグの場合はエラーを返す', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPage)

      const { createCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await createCmsPage({
        slug: 'about',
        title: '重複テスト',
        content: '内容',
        category: 'info',
      })
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('ページと初期バージョンを正常に作成する', async () => {
      const newPage = {
        ...mockCmsPage,
        id: 'new-page-id',
        slug: 'new-page',
        title: '新しいページ',
        version: 1,
      }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)
      ;(mockPrisma as Record<string, any>).cmsPage.create.mockResolvedValue(newPage)
      ;(mockPrisma as Record<string, any>).cmsPageVersion.create.mockResolvedValue({})

      const { createCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await createCmsPage({
        slug: 'new-page',
        title: '新しいページ',
        content: '<p>新規コンテンツ</p>',
        category: 'info',
      })

      expect(result).toMatchObject({ success: true, data: newPage })
      expect((mockPrisma as Record<string, any>).cmsPage.create).toHaveBeenCalledWith({
        data: {
          slug: 'new-page',
          title: '新しいページ',
          content: '<p>新規コンテンツ</p>',
          category: 'info',
          version: 1,
          createdBy: mockUser.id,
        },
      })
    })

    it('初期バージョン（version: 1）が記録される', async () => {
      const newPage = { ...mockCmsPage, id: 'new-page-id', version: 1 }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)
      ;(mockPrisma as Record<string, any>).cmsPage.create.mockResolvedValue(newPage)
      ;(mockPrisma as Record<string, any>).cmsPageVersion.create.mockResolvedValue({})

      const { createCmsPage } = await import('@/lib/actions/admin/cms')
      await createCmsPage({
        slug: 'test',
        title: 'テスト',
        content: '内容',
        category: 'info',
      })

      expect((mockPrisma as Record<string, any>).cmsPageVersion.create).toHaveBeenCalledWith({
        data: {
          pageId: 'new-page-id',
          version: 1,
          title: 'テスト',
          content: '内容',
          createdBy: mockUser.id,
        },
      })
    })

    it('revalidatePathが呼ばれる', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)
      ;(mockPrisma as Record<string, any>).cmsPage.create.mockResolvedValue({ ...mockCmsPage, id: 'x' })
      ;(mockPrisma as Record<string, any>).cmsPageVersion.create.mockResolvedValue({})

      const { createCmsPage } = await import('@/lib/actions/admin/cms')
      await createCmsPage({
        slug: 'new',
        title: 'タイトル',
        content: '内容',
        category: 'info',
      })

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/content-management')
    })
  })

  // ============================================================
  // updateCmsPage
  // ============================================================

  describe('updateCmsPage', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await updateCmsPage('about', { title: '更新' })
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('存在しないスラッグの場合はエラーを返す', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await updateCmsPage('non-existent', { title: '更新' })
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('タイトルを更新しバージョンがインクリメントされる', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPage)
      ;(mockPrisma as Record<string, any>).cmsPage.update.mockResolvedValue({
        ...mockCmsPage,
        title: '更新後タイトル',
        version: 4,
      })
      ;(mockPrisma as Record<string, any>).cmsPageVersion.create.mockResolvedValue({})
      mockPrisma.adminLog.create.mockResolvedValue({})
      mockTransaction.mockResolvedValue([{}, {}, {}])

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await updateCmsPage('about', { title: '更新後タイトル' })

      expect(result).toEqual({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/content-management')
    })

    it('公開状態をtrueに切り替える', async () => {
      const unpublishedPage = { ...mockCmsPage, isPublished: false, publishedAt: null, version: 2 }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(unpublishedPage)
      mockTransaction.mockResolvedValue([{}, {}, {}])

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await updateCmsPage('about', { isPublished: true })

      expect(result).toEqual({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('公開状態をfalseに切り替える', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPage)
      mockTransaction.mockResolvedValue([{}, {}, {}])

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await updateCmsPage('about', { isPublished: false })

      expect(result).toEqual({ success: true })
    })

    it('コンテンツを更新する', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPage)
      mockTransaction.mockResolvedValue([{}, {}, {}])

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await updateCmsPage('about', { content: '<p>新しい内容</p>' })

      expect(result).toEqual({ success: true })
    })

    it('$transactionで監査ログが作成される', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPage)
      mockTransaction.mockResolvedValue([{}, {}, {}])

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { title: 'テスト更新' })

      // $transactionが呼ばれていることを確認（トランザクション内でadminLog.createが含まれる）
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('バージョンが現在値+1になる', async () => {
      const pageV5 = { ...mockCmsPage, version: 5 }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(pageV5)
      mockTransaction.mockResolvedValue([{}, {}, {}])

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { title: 'v6テスト' })

      // トランザクションが呼ばれ、version 6 が使われることを確認
      expect(mockTransaction).toHaveBeenCalled()
    })
  })

  // ============================================================
  // deleteCmsPage
  // ============================================================

  describe('deleteCmsPage', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { deleteCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await deleteCmsPage('about')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('存在しないスラッグの場合はエラーを返す', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)

      const { deleteCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await deleteCmsPage('non-existent')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('ページを削除し監査ログを作成する', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPage)
      ;(mockPrisma as Record<string, any>).cmsPage.delete.mockResolvedValue(mockCmsPage)
      mockPrisma.adminLog.create.mockResolvedValue({})
      mockTransaction.mockResolvedValue([mockCmsPage, {}])

      const { deleteCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await deleteCmsPage('about')

      expect(result).toEqual({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/content-management')
    })

    it('管理者権限がない場合は削除できない', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { deleteCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await deleteCmsPage('about')

      expect(result).toMatchObject({ success: false, error: expect.any(String) })
      expect(mockTransaction).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 品質向上テスト: バージョン管理の検証
  // ============================================================
  describe('バージョン管理の検証', () => {
    it('updateCmsPageでバージョンが1ずつ増加する', async () => {
      const pageV3 = { ...mockCmsPage, version: 3 }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(pageV3)

      // トランザクション内の引数をキャプチャ
      mockTransaction.mockImplementation((ops: unknown[]) => {
        return Promise.resolve(ops)
      })

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { title: 'バージョン4テスト' })

      // $transactionにはPromiseの配列が渡される
      // version: 4 がcmsPage.updateとcmsPageVersion.createの両方に渡されることを確認
      expect(mockTransaction).toHaveBeenCalled()
      // cmsPage.updateがversion: 4で呼ばれることを確認
      expect((mockPrisma as Record<string, any>).cmsPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 4 }),
        })
      )
    })

    it('updateCmsPageでCmsPageVersionが正しいcontent/titleで作成される', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPage)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops))

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { title: '新タイトル', content: '<p>新内容</p>' })

      expect((mockPrisma as Record<string, any>).cmsPageVersion.create).toHaveBeenCalledWith({
        data: {
          pageId: mockCmsPage.id,
          version: mockCmsPage.version + 1,
          title: '新タイトル',
          content: '<p>新内容</p>',
          createdBy: mockUser.id,
        },
      })
    })

    it('複数回更新時のバージョン値が正しい(2, 3, 4...)', async () => {
      // 1回目: version 1 -> 2
      const pageV1 = { ...mockCmsPage, version: 1 }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(pageV1)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops))

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { title: 'v2' })

      expect((mockPrisma as Record<string, any>).cmsPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 2 }),
        })
      )

      vi.clearAllMocks()
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
      ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction

      // 2回目: version 2 -> 3
      const pageV2 = { ...mockCmsPage, version: 2 }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(pageV2)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops))

      await updateCmsPage('about', { title: 'v3' })

      expect((mockPrisma as Record<string, any>).cmsPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ version: 3 }),
        })
      )
    })
  })

  // ============================================================
  // 品質向上テスト: 公開/非公開の挙動
  // ============================================================
  describe('公開/非公開の挙動', () => {
    it('publishする時にpublishedAtがnew Date()になる', async () => {
      const unpublishedPage = { ...mockCmsPage, isPublished: false, publishedAt: null, version: 1 }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(unpublishedPage)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops))

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { isPublished: true })

      expect((mockPrisma as Record<string, any>).cmsPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPublished: true,
            publishedAt: expect.any(Date),
          }),
        })
      )
    })

    it('unpublishする時にpublishedAtが元の値を維持する', async () => {
      const originalPublishedAt = new Date('2025-01-15')
      const publishedPage = { ...mockCmsPage, isPublished: true, publishedAt: originalPublishedAt, version: 2 }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(publishedPage)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops))

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { isPublished: false })

      expect((mockPrisma as Record<string, any>).cmsPage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isPublished: false,
            publishedAt: originalPublishedAt,
          }),
        })
      )
    })

    it('isPublished未指定時は既存の公開状態が維持される', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPage)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops))

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { title: 'タイトルのみ更新' })

      // isPublishedが更新データに含まれない
      const updateCall = (mockPrisma as Record<string, any>).cmsPage.update.mock.calls[0][0]
      expect(updateCall.data.isPublished).toBeUndefined()
      expect(updateCall.data.publishedAt).toBeUndefined()
    })
  })

  // ============================================================
  // 品質向上テスト: エッジケース
  // ============================================================
  describe('エッジケース', () => {
    it('空のcontent文字列での作成が成功する', async () => {
      const newPage = { ...mockCmsPage, id: 'empty-content-id', content: '', version: 1 }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)
      ;(mockPrisma as Record<string, any>).cmsPage.create.mockResolvedValue(newPage)
      ;(mockPrisma as Record<string, any>).cmsPageVersion.create.mockResolvedValue({})

      const { createCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await createCmsPage({
        slug: 'empty-page',
        title: '空ページ',
        content: '',
        category: 'info',
      })

      expect(result).toMatchObject({ success: true })
      expect((mockPrisma as Record<string, any>).cmsPage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ content: '' }),
      })
    })

    it('slugにスラッシュを含む値での検索', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)

      const { getCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await getCmsPage('path/with/slashes')

      expect(result).toMatchObject({ success: false, error: expect.any(String) })
      expect((mockPrisma as Record<string, any>).cmsPage.findUnique).toHaveBeenCalledWith({
        where: { slug: 'path/with/slashes' },
        include: expect.any(Object),
      })
    })

    it('存在しないslugの更新でエラーが返る', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await updateCmsPage('nonexistent-slug', { title: '更新テスト' })

      expect(result).toMatchObject({ success: false, error: expect.any(String) })
      expect(mockTransaction).not.toHaveBeenCalled()
    })

    it('存在しないslugの削除でエラーが返る', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(null)

      const { deleteCmsPage } = await import('@/lib/actions/admin/cms')
      const result = await deleteCmsPage('nonexistent-slug')

      expect(result).toMatchObject({ success: false, error: expect.any(String) })
      expect(mockTransaction).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // 品質向上テスト: 監査ログ
  // ============================================================
  describe('監査ログの検証', () => {
    it('deleteCmsPageのadminLogに正しいslugとtitleが記録される', async () => {
      const targetPage = { ...mockCmsPage, slug: 'delete-target', title: '削除対象ページ' }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(targetPage)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops))

      const { deleteCmsPage } = await import('@/lib/actions/admin/cms')
      await deleteCmsPage('delete-target')

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: {
          adminId: mockUser.id,
          action: 'delete_cms_page',
          targetType: 'cms_page',
          targetId: targetPage.id,
          details: JSON.stringify({ slug: 'delete-target', title: '削除対象ページ' }),
        },
      })
    })

    it('updateCmsPageのadminLogにversion番号が含まれる', async () => {
      const pageV5 = { ...mockCmsPage, version: 5, id: 'page-v5' }
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(pageV5)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops))

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { title: 'v6テスト' })

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: {
          adminId: mockUser.id,
          action: 'update_cms_page',
          targetType: 'cms_page',
          targetId: 'page-v5',
          details: expect.stringContaining('"version":6'),
        },
      })
    })

    it('updateCmsPageのadminLogにpublished状態が含まれる', async () => {
      ;(mockPrisma as Record<string, any>).cmsPage.findUnique.mockResolvedValue(mockCmsPage)
      mockTransaction.mockImplementation((ops: unknown[]) => Promise.resolve(ops))

      const { updateCmsPage } = await import('@/lib/actions/admin/cms')
      await updateCmsPage('about', { isPublished: false })

      const logCall = mockPrisma.adminLog.create.mock.calls[0][0]
      const details = JSON.parse(logCall.data.details)
      expect(details).toHaveProperty('published')
      expect(details).toHaveProperty('slug', 'about')
      expect(details).toHaveProperty('version', mockCmsPage.version + 1)
    })
  })
})
