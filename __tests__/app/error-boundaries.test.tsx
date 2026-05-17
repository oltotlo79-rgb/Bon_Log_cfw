import { vi } from 'vitest'
/**
 * Error Boundaries テスト
 *
 * 各ページのerror.tsxをテストして、エラーハンドリングが正しく動作することを確認
 */

import { render, screen, fireEvent } from '@testing-library/react'

describe('Error Boundaries', async () => {
  describe('FeedError', async () => {
    let FeedError: typeof import('@/app/(main)/feed/error').default

    beforeEach(async () => {
      vi.resetModules()
      const mod = await import('@/app/(main)/feed/error')
      FeedError = mod.default
    })

    it('should render error message', () => {
      const mockReset = vi.fn()
      render(<FeedError error={new Error('Test error')} reset={mockReset} />)

      expect(screen.getByText('タイムラインを読み込めません')).toBeInTheDocument()
      expect(screen.getByText(/一時的な問題が発生しています/)).toBeInTheDocument()
    })

    it('should call reset when button clicked', () => {
      const mockReset = vi.fn()
      render(<FeedError error={new Error('Test error')} reset={mockReset} />)

      fireEvent.click(screen.getByText('再試行'))
      expect(mockReset).toHaveBeenCalled()
    })

    it('should handle error with digest', () => {
      const mockReset = vi.fn()
      const errorWithDigest = Object.assign(new Error('Test'), { digest: 'abc123' })
      render(<FeedError error={errorWithDigest} reset={mockReset} />)

      expect(screen.getByText('タイムラインを読み込めません')).toBeInTheDocument()
    })

    it('should handle empty error message', () => {
      const mockReset = vi.fn()
      render(<FeedError error={new Error('')} reset={mockReset} />)

      expect(screen.getByText('タイムラインを読み込めません')).toBeInTheDocument()
    })
  })

  describe('ShopDetailError', async () => {
    it('should render shop error message', async () => {
      const { default: ShopError } = await import('@/app/(main)/shops/[id]/error')
      const mockReset = vi.fn()
      render(<ShopError error={new Error('Shop error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })

    it('should call reset on click', async () => {
      const { default: ShopError } = await import('@/app/(main)/shops/[id]/error')
      const mockReset = vi.fn()
      render(<ShopError error={new Error('Shop error')} reset={mockReset} />)

      fireEvent.click(screen.getByText('再試行'))
      expect(mockReset).toHaveBeenCalled()
    })
  })

  describe('PostDetailError', async () => {
    it('should render post error message', async () => {
      const { default: PostError } = await import('@/app/(main)/posts/[id]/error')
      const mockReset = vi.fn()
      render(<PostError error={new Error('Post error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })

    it('should call reset on click', async () => {
      const { default: PostError } = await import('@/app/(main)/posts/[id]/error')
      const mockReset = vi.fn()
      render(<PostError error={new Error('Post error')} reset={mockReset} />)

      fireEvent.click(screen.getByText('再試行'))
      expect(mockReset).toHaveBeenCalled()
    })
  })

  describe('UserDetailError', async () => {
    it('should render user error message', async () => {
      const { default: UserError } = await import('@/app/(main)/users/[id]/error')
      const mockReset = vi.fn()
      render(<UserError error={new Error('User error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })

    it('should call reset on click', async () => {
      const { default: UserError } = await import('@/app/(main)/users/[id]/error')
      const mockReset = vi.fn()
      render(<UserError error={new Error('User error')} reset={mockReset} />)

      fireEvent.click(screen.getByText('再試行'))
      expect(mockReset).toHaveBeenCalled()
    })
  })

  describe('EventDetailError', async () => {
    it('should render event error message', async () => {
      const { default: EventError } = await import('@/app/(main)/events/[id]/error')
      const mockReset = vi.fn()
      render(<EventError error={new Error('Event error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })

    it('should call reset on click', async () => {
      const { default: EventError } = await import('@/app/(main)/events/[id]/error')
      const mockReset = vi.fn()
      render(<EventError error={new Error('Event error')} reset={mockReset} />)

      fireEvent.click(screen.getByText('再試行'))
      expect(mockReset).toHaveBeenCalled()
    })
  })

  describe('SettingsError', async () => {
    it('should render settings error message', async () => {
      const { default: SettingsError } = await import('@/app/(main)/settings/error')
      const mockReset = vi.fn()
      render(<SettingsError error={new Error('Settings error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })
  })

  describe('BonsaiError', async () => {
    it('should render bonsai error message', async () => {
      const { default: BonsaiError } = await import('@/app/(main)/bonsai/error')
      const mockReset = vi.fn()
      render(<BonsaiError error={new Error('Bonsai error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })
  })

  describe('BookmarksError', async () => {
    it('should render bookmarks error message', async () => {
      const { default: BookmarksError } = await import('@/app/(main)/bookmarks/error')
      const mockReset = vi.fn()
      render(<BookmarksError error={new Error('Bookmarks error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })
  })

  describe('EventsError', async () => {
    it('should render events error message', async () => {
      const { default: EventsError } = await import('@/app/(main)/events/error')
      const mockReset = vi.fn()
      render(<EventsError error={new Error('Events error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })
  })

  describe('ShopsError', async () => {
    it('should render shops error message', async () => {
      const { default: ShopsError } = await import('@/app/(main)/shops/error')
      const mockReset = vi.fn()
      render(<ShopsError error={new Error('Shops error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })
  })

  describe('MessagesError', async () => {
    it('should render messages error message', async () => {
      const { default: MessagesError } = await import('@/app/(main)/messages/error')
      const mockReset = vi.fn()
      render(<MessagesError error={new Error('Messages error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })
  })

  describe('NotificationsError', async () => {
    it('should render notifications error message', async () => {
      const { default: NotificationsError } = await import('@/app/(main)/notifications/error')
      const mockReset = vi.fn()
      render(<NotificationsError error={new Error('Notifications error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })
  })

  describe('SearchError', async () => {
    it('should render search error message', async () => {
      const { default: SearchError } = await import('@/app/(main)/search/error')
      const mockReset = vi.fn()
      render(<SearchError error={new Error('Search error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })
  })

  describe('AnalyticsError', async () => {
    it('should render analytics error message', async () => {
      const { default: AnalyticsError } = await import('@/app/(main)/analytics/error')
      const mockReset = vi.fn()
      render(<AnalyticsError error={new Error('Analytics error')} reset={mockReset} />)

      expect(screen.getByText('再試行')).toBeInTheDocument()
    })
  })

  // ── 新規追加: ルートグループ単位のエラーバウンダリ ──

  describe('RootError (app/error.tsx)', async () => {
    let RootError: typeof import('@/app/error').default

    beforeEach(async () => {
      vi.resetModules()
      const mod = await import('@/app/error')
      RootError = mod.default
    })

    it('should render default error title', () => {
      const mockReset = vi.fn()
      render(<RootError error={new Error('Root error')} reset={mockReset} />)
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })

    it('should call reset on button click', () => {
      const mockReset = vi.fn()
      render(<RootError error={new Error('Root error')} reset={mockReset} />)
      fireEvent.click(screen.getByText('再試行'))
      expect(mockReset).toHaveBeenCalledTimes(1)
    })

    it('should show link to top page', () => {
      const mockReset = vi.fn()
      render(<RootError error={new Error('Root error')} reset={mockReset} />)
      const link = screen.getByText('トップページへ')
      expect(link).toHaveAttribute('href', '/')
    })

    it('should handle error with digest property', () => {
      const mockReset = vi.fn()
      const err = Object.assign(new Error('digest error'), { digest: 'abc' })
      render(<RootError error={err} reset={mockReset} />)
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
  })

  describe('AuthError (app/(auth)/error.tsx)', async () => {
    let AuthError: typeof import('@/app/(auth)/error').default

    beforeEach(async () => {
      vi.resetModules()
      const mod = await import('@/app/(auth)/error')
      AuthError = mod.default
    })

    it('should render auth-specific error title', () => {
      const mockReset = vi.fn()
      render(<AuthError error={new Error('Auth error')} reset={mockReset} />)
      expect(screen.getByText('認証ページでエラーが発生しました')).toBeInTheDocument()
    })

    it('should call reset on button click', () => {
      const mockReset = vi.fn()
      render(<AuthError error={new Error('Auth error')} reset={mockReset} />)
      fireEvent.click(screen.getByText('再試行'))
      expect(mockReset).toHaveBeenCalledTimes(1)
    })

    it('should show link to login page', () => {
      const mockReset = vi.fn()
      render(<AuthError error={new Error('Auth error')} reset={mockReset} />)
      const link = screen.getByText('ログインページへ')
      expect(link).toHaveAttribute('href', '/login')
    })
  })

  describe('LegalError (app/(legal)/error.tsx)', async () => {
    let LegalError: typeof import('@/app/(legal)/error').default

    beforeEach(async () => {
      vi.resetModules()
      const mod = await import('@/app/(legal)/error')
      LegalError = mod.default
    })

    it('should render page display error title', () => {
      const mockReset = vi.fn()
      render(<LegalError error={new Error('Legal error')} reset={mockReset} />)
      expect(screen.getByText('ページを表示できません')).toBeInTheDocument()
    })

    it('should call reset on button click', () => {
      const mockReset = vi.fn()
      render(<LegalError error={new Error('Legal error')} reset={mockReset} />)
      fireEvent.click(screen.getByText('再試行'))
      expect(mockReset).toHaveBeenCalledTimes(1)
    })

    it('should show link to top page', () => {
      const mockReset = vi.fn()
      render(<LegalError error={new Error('Legal error')} reset={mockReset} />)
      const link = screen.getByText('トップページへ')
      expect(link).toHaveAttribute('href', '/')
    })
  })

  describe('PublicError (app/(public)/error.tsx)', async () => {
    let PublicError: typeof import('@/app/(public)/error').default

    beforeEach(async () => {
      vi.resetModules()
      const mod = await import('@/app/(public)/error')
      PublicError = mod.default
    })

    it('should render page display error title', () => {
      const mockReset = vi.fn()
      render(<PublicError error={new Error('Public error')} reset={mockReset} />)
      expect(screen.getByText('ページを表示できません')).toBeInTheDocument()
    })

    it('should call reset on button click', () => {
      const mockReset = vi.fn()
      render(<PublicError error={new Error('Public error')} reset={mockReset} />)
      fireEvent.click(screen.getByText('再試行'))
      expect(mockReset).toHaveBeenCalledTimes(1)
    })

    it('should show link to top page', () => {
      const mockReset = vi.fn()
      render(<PublicError error={new Error('Public error')} reset={mockReset} />)
      const link = screen.getByText('トップページへ')
      expect(link).toHaveAttribute('href', '/')
    })
  })
})
