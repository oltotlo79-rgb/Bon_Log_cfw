import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ShopActions } from '@/components/shop/ShopActions'

// ShopChangeRequestForm モック
vi.mock('@/components/shop/ShopChangeRequestForm', () => ({
  ShopChangeRequestForm: ({ shop, onClose }: { shop: { name: string }; onClose: () => void }) => (
    <div data-testid="change-request-form">
      <span>変更リクエストフォーム: {shop.name}</span>
      <button onClick={onClose}>閉じる</button>
    </div>
  ),
}))

// ReportButton モック
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: ({ targetType, targetId }: { targetType: string; targetId: string }) => (
    <button data-testid="report-button">
      通報 ({targetType}: {targetId})
    </button>
  ),
}))

describe('ShopActions', () => {
  const mockShop = {
    id: 'shop-123',
    name: '盆栽園テスト',
    address: '東京都渋谷区1-1-1',
    phone: '03-1234-5678',
    website: 'https://example.com',
    businessHours: '9:00〜17:00',
    closedDays: '水曜日',
  }

  describe('オーナーの場合', () => {
    it('編集リンクを表示する', () => {
      render(<ShopActions shop={mockShop} isOwner={true} isLoggedIn={true} />)

      expect(screen.getByRole('link', { name: /編集/i })).toBeInTheDocument()
    })

    it('編集リンクが正しいhrefを持つ', () => {
      render(<ShopActions shop={mockShop} isOwner={true} isLoggedIn={true} />)

      expect(screen.getByRole('link', { name: /編集/i })).toHaveAttribute(
        'href',
        '/shops/shop-123/edit'
      )
    })

    it('変更リクエストボタンを表示しない', () => {
      render(<ShopActions shop={mockShop} isOwner={true} isLoggedIn={true} />)

      expect(screen.queryByText(/情報の修正をリクエスト/)).not.toBeInTheDocument()
    })

    it('通報ボタンを表示しない', () => {
      render(<ShopActions shop={mockShop} isOwner={true} isLoggedIn={true} />)

      expect(screen.queryByTestId('report-button')).not.toBeInTheDocument()
    })
  })

  describe('ログインユーザー（非オーナー）の場合', () => {
    it('変更リクエストボタンを表示する', () => {
      render(<ShopActions shop={mockShop} isOwner={false} isLoggedIn={true} />)

      expect(screen.getByRole('button', { name: /情報の修正をリクエスト/i })).toBeInTheDocument()
    })

    it('通報ボタンを表示する', () => {
      render(<ShopActions shop={mockShop} isOwner={false} isLoggedIn={true} />)

      expect(screen.getByTestId('report-button')).toBeInTheDocument()
    })

    it('編集リンクを表示しない', () => {
      render(<ShopActions shop={mockShop} isOwner={false} isLoggedIn={true} />)

      expect(screen.queryByRole('link', { name: /編集/i })).not.toBeInTheDocument()
    })

    it('変更リクエストボタンをクリックするとフォームを表示する', async () => {
      const user = userEvent.setup()
      render(<ShopActions shop={mockShop} isOwner={false} isLoggedIn={true} />)

      await user.click(screen.getByRole('button', { name: /情報の修正をリクエスト/i }))

      expect(screen.getByTestId('change-request-form')).toBeInTheDocument()
      expect(screen.getByText(/変更リクエストフォーム: 盆栽園テスト/)).toBeInTheDocument()
    })

    it('フォームを閉じることができる', async () => {
      const user = userEvent.setup()
      render(<ShopActions shop={mockShop} isOwner={false} isLoggedIn={true} />)

      // フォームを開く
      await user.click(screen.getByRole('button', { name: /情報の修正をリクエスト/i }))
      expect(screen.getByTestId('change-request-form')).toBeInTheDocument()

      // フォームを閉じる
      await user.click(screen.getByRole('button', { name: '閉じる' }))

      await waitFor(() => {
        expect(screen.queryByTestId('change-request-form')).not.toBeInTheDocument()
      })
    })
  })

  describe('未ログインユーザーの場合', () => {
    it('何もボタンを表示しない', () => {
      render(<ShopActions shop={mockShop} isOwner={false} isLoggedIn={false} />)

      expect(screen.queryByRole('link', { name: /編集/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /情報の修正をリクエスト/i })).not.toBeInTheDocument()
      expect(screen.queryByTestId('report-button')).not.toBeInTheDocument()
    })
  })
})
