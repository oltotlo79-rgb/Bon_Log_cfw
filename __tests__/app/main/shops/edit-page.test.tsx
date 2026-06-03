import { vi } from 'vitest'
/**
 * 盆栽園編集ページのテスト
 */
import React from 'react'

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// 盆栽園取得モック
const mockGetShop = vi.fn()
const mockGetShopGenres = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  getShop: (id: string) => mockGetShop(id),
  getShopGenres: () => mockGetShopGenres(),
  updateShop: vi.fn(),
}))

// Next.jsナビゲーションモック
const mockRedirect = vi.fn()
const mockNotFound = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { mockRedirect(url); throw new Error('REDIRECT') },
  notFound: () => { mockNotFound(); throw new Error('NOT_FOUND') },
}))

// ShopFormモック
vi.mock('@/components/shop/ShopForm', () => ({
  ShopForm: ({ mode, initialData, genres }: { mode: string; initialData: Record<string, unknown>; genres: unknown[] }) => (
    <div data-testid="shop-form" data-mode={mode}>
      {JSON.stringify({ initialData, genres })}
    </div>
  ),
}))

describe('盆栽園編集ページ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetShopGenres.mockResolvedValue({ genres: [{ id: 'g1', name: '松' }] })
  })

  describe('generateMetadata', async () => {
    it('盆栽園が存在する場合、タイトルを生成する', async () => {
      mockGetShop.mockResolvedValue({
        shop: { id: 'shop-1', name: '山田盆栽園' },
      })

      const { generateMetadata } = await import('@/app/(main)/shops/[id]/edit/page')
      const metadata = await generateMetadata({ params: Promise.resolve({ id: 'shop-1' }) })

      expect(metadata.title).toBe('山田盆栽園を編集')
    })

    it('盆栽園が存在しない場合、フォールバックタイトルを返す', async () => {
      mockGetShop.mockResolvedValue({
        error: 'Not found',
        shop: null,
      })

      const { generateMetadata } = await import('@/app/(main)/shops/[id]/edit/page')
      const metadata = await generateMetadata({ params: Promise.resolve({ id: 'invalid' }) })

      expect(metadata.title).toBe('盆栽園が見つかりません')
    })
  })

  describe('ページコンポーネント', async () => {
    it('未ログインの場合、ログインページにリダイレクトする', async () => {
      mockAuth.mockResolvedValue(null)

      const { default: EditShopPage } = await import('@/app/(main)/shops/[id]/edit/page')

      await expect(
        EditShopPage({ params: Promise.resolve({ id: 'shop-1' }) })
      ).rejects.toThrow('REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/login')
    })

    it('盆栽園が見つからない場合、404を表示する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockGetShop.mockResolvedValue({ error: 'Not found', shop: null })

      const { default: EditShopPage } = await import('@/app/(main)/shops/[id]/edit/page')

      await expect(
        EditShopPage({ params: Promise.resolve({ id: 'invalid' }) })
      ).rejects.toThrow('NOT_FOUND')

      expect(mockNotFound).toHaveBeenCalled()
    })

    it('所有者でない場合、詳細ページにリダイレクトする', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockGetShop.mockResolvedValue({
        shop: {
          id: 'shop-1',
          name: '山田盆栽園',
          isOwner: false,
        },
      })

      const { default: EditShopPage } = await import('@/app/(main)/shops/[id]/edit/page')

      await expect(
        EditShopPage({ params: Promise.resolve({ id: 'shop-1' }) })
      ).rejects.toThrow('REDIRECT')

      expect(mockRedirect).toHaveBeenCalledWith('/shops/shop-1')
    })

    it('所有者の場合、編集フォームを表示する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockGetShop.mockResolvedValue({
        shop: {
          id: 'shop-1',
          name: '山田盆栽園',
          address: '東京都練馬区1-2-3',
          latitude: 35.7,
          longitude: 139.7,
          phone: '03-1234-5678',
          website: 'https://yamada-bonsai.com',
          businessHours: '9:00-17:00',
          closedDays: '水曜日',
          genres: [{ id: 'g1', name: '松' }],
          isOwner: true,
        },
      })

      const { default: EditShopPage } = await import('@/app/(main)/shops/[id]/edit/page')

      // エラーが投げられないことを確認（正常にレンダリングされる）
      const result = await EditShopPage({ params: Promise.resolve({ id: 'shop-1' }) })
      expect(result).toBeTruthy()
    })

    it('ジャンル一覧と盆栽園データを並列で取得する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockGetShop.mockResolvedValue({
        shop: {
          id: 'shop-1',
          name: '山田盆栽園',
          address: '東京都',
          latitude: 35.7,
          longitude: 139.7,
          genres: [],
          isOwner: true,
        },
      })

      const { default: EditShopPage } = await import('@/app/(main)/shops/[id]/edit/page')
      await EditShopPage({ params: Promise.resolve({ id: 'shop-1' }) })

      // 両方の関数が呼ばれていることを確認
      expect(mockGetShop).toHaveBeenCalledWith('shop-1')
      expect(mockGetShopGenres).toHaveBeenCalled()
    })
  })
})
