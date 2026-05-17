/**
 * AdminReviewsPage - Server Component の未カバー分岐テスト
 *
 * 対象分岐:
 * - error レスポンス時のリダイレクト
 * - review.user.avatarUrl 有無によるアバター表示切り替え
 * - review.content が null の場合「（コメントなし）」表示
 * - review.reportCount > 0 のバッジ表示
 * - reviews.length === 0 の空状態
 * - ページネーション: totalPages > 1, page > 1, page < totalPages
 * - star rating の filled/unfilled 切り替え
 */

import { vi } from 'vitest'
import React from 'react'
import { render, screen } from '../../../utils/test-utils'

// Mock dependencies
const mockGetAdminReviews = vi.fn()
vi.mock('@/lib/actions/admin/content', () => ({
  getAdminReviews: (...args: unknown[]) => mockGetAdminReviews(...args),
}))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    throw new Error('REDIRECT')
  },
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

vi.mock('@/app/admin/reviews/ReviewActionsDropdown', () => ({
  ReviewActionsDropdown: ({ reviewId }: { reviewId: string }) => (
    <span data-testid={`actions-${reviewId}`}>actions</span>
  ),
}))

import AdminReviewsPage from '@/app/admin/reviews/page'

/**
 * ActionResult の成功形にラップするヘルパー。
 * getAdminReviews は ActionResult<{ reviews, total, nextCursor? }> を返すため、
 * テストで同形状のレスポンスを手軽に生成する。
 */
const ok = <T,>(data: T) => ({ success: true as const, data })

describe('AdminReviewsPage (Server Component)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeReview = (overrides: Record<string, unknown> = {}) => ({
    id: 'review-1',
    rating: 4,
    content: 'Great bonsai shop!',
    reportCount: 0,
    createdAt: new Date('2024-06-15').toISOString(),
    user: {
      id: 'user-1',
      nickname: 'TestUser',
      avatarUrl: null,
    },
    shop: {
      id: 'shop-1',
      name: 'TestShop',
    },
    ...overrides,
  })

  it('error レスポンス時に /login へリダイレクトする', async () => {
    mockGetAdminReviews.mockResolvedValue({ success: false, error: 'Unauthorized' })

    await expect(
      AdminReviewsPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('レビュー一覧を正しく表示する', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: [makeReview()],
      total: 1,
    }))

    const jsx = await AdminReviewsPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    expect(screen.getByText('レビュー管理')).toBeInTheDocument()
    expect(screen.getByText('全 1 件')).toBeInTheDocument()
    expect(screen.getByText('TestUser')).toBeInTheDocument()
    expect(screen.getByText('TestShop')).toBeInTheDocument()
    expect(screen.getByText('Great bonsai shop!')).toBeInTheDocument()
  })

  it('avatarUrl がある場合に画像を表示する', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: [makeReview({ user: { id: 'user-1', nickname: 'WithAvatar', avatarUrl: '/avatar.jpg' } })],
      total: 1,
    }))

    const jsx = await AdminReviewsPage({ searchParams: Promise.resolve({}) })
    const { container } = render(jsx)

    const img = container.querySelector('img[src="/avatar.jpg"]')
    expect(img).toBeInTheDocument()
  })

  it('avatarUrl が null の場合にプレースホルダーを表示する', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: [makeReview({ user: { id: 'user-1', nickname: 'NoAvatar', avatarUrl: null } })],
      total: 1,
    }))

    const jsx = await AdminReviewsPage({ searchParams: Promise.resolve({}) })
    const { container } = render(jsx)

    // avatarUrl が null の場合は div.rounded-full プレースホルダー
    const placeholder = container.querySelector('.w-6.h-6.bg-muted.rounded-full')
    expect(placeholder).toBeInTheDocument()
    // img は存在しない
    expect(container.querySelector('img')).not.toBeInTheDocument()
  })

  it('content が null の場合「（コメントなし）」を表示する', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: [makeReview({ content: null })],
      total: 1,
    }))

    const jsx = await AdminReviewsPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    expect(screen.getByText('（コメントなし）')).toBeInTheDocument()
  })

  it('reportCount > 0 の場合にバッジ表示する', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: [makeReview({ reportCount: 3 })],
      total: 1,
    }))

    const jsx = await AdminReviewsPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    // reportCount > 0 なのでバッジに "3" が表示される
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('reportCount === 0 の場合に "0" をテキスト表示する', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: [makeReview({ reportCount: 0 })],
      total: 1,
    }))

    const jsx = await AdminReviewsPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('レビューが 0 件の場合に空状態メッセージを表示する', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: [],
      total: 0,
    }))

    const jsx = await AdminReviewsPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    expect(screen.getByText('レビューが見つかりません')).toBeInTheDocument()
  })

  it('cursor 指定時は「前へ」がリンク、nextCursor があれば「次へ」もリンクになる', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: Array.from({ length: 20 }, (_, i) => makeReview({ id: `review-${i}` })),
      total: 60,
      nextCursor: 'next-id',
    }))

    const jsx = await AdminReviewsPage({
      searchParams: Promise.resolve({ cursor: 'cur1' }),
    })
    render(jsx)

    const prev = screen.getByText('前へ')
    expect(prev.tagName).toBe('A')
    const next = screen.getByText('次へ')
    expect(next.tagName).toBe('A')
    expect(screen.getByText(/全 60 件/)).toBeInTheDocument()
  })

  it('cursor 未指定（先頭ページ）では「前へ」は span で nextCursor があれば「次へ」がリンクになる', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: Array.from({ length: 20 }, (_, i) => makeReview({ id: `review-${i}` })),
      total: 40,
      nextCursor: 'next-id',
    }))

    const jsx = await AdminReviewsPage({
      searchParams: Promise.resolve({}),
    })
    render(jsx)

    const prev = screen.getByText('前へ')
    expect(prev.tagName).toBe('SPAN')
    const next = screen.getByText('次へ')
    expect(next.tagName).toBe('A')
  })

  it('cursor 指定＋nextCursor なし（最終ページ）では「次へ」が span', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: Array.from({ length: 20 }, (_, i) => makeReview({ id: `review-${i}` })),
      total: 40,
    }))

    const jsx = await AdminReviewsPage({
      searchParams: Promise.resolve({ cursor: 'cur2' }),
    })
    render(jsx)

    const prev = screen.getByText('前へ')
    expect(prev.tagName).toBe('A')
    const next = screen.getByText('次へ')
    expect(next.tagName).toBe('SPAN')
  })

  it('hasReports=true フィルターを getAdminReviews に渡す', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: [],
      total: 0,
    }))

    await AdminReviewsPage({
      searchParams: Promise.resolve({ hasReports: 'true', search: 'test' }),
    })

    expect(mockGetAdminReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'test',
        hasReports: true,
      })
    )
  })

  it('search パラメータが空の場合 undefined を渡す', async () => {
    mockGetAdminReviews.mockResolvedValue(ok({
      reviews: [],
      total: 0,
    }))

    await AdminReviewsPage({
      searchParams: Promise.resolve({}),
    })

    expect(mockGetAdminReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        search: undefined,
        hasReports: false,
      })
    )
  })
})
