import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShopGenreEditor } from '@/components/shop/ShopGenreEditor'

// next/navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Server Actions モック
const mockUpdateShopGenres = vi.fn()
const mockGetShopGenres = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  updateShopGenres: (...args: unknown[]) => mockUpdateShopGenres(...args),
  getShopGenres: () => mockGetShopGenres(),
}))

describe('ShopGenreEditor', () => {
  const mockCurrentGenres = [
    { id: 'genre-1', name: '松柏類' },
    { id: 'genre-2', name: '雑木類' },
  ]

  const mockAvailableGenres = [
    { id: 'genre-1', name: '松柏類' },
    { id: 'genre-2', name: '雑木類' },
    { id: 'genre-3', name: '花もの' },
    { id: 'genre-4', name: '実もの' },
    { id: 'genre-5', name: '草もの' },
    { id: 'genre-6', name: '苔玉' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetShopGenres.mockResolvedValue({ genres: mockAvailableGenres })
    mockUpdateShopGenres.mockResolvedValue({ success: true })
  })

  describe('ログインしていない場合', () => {
    it('現在のジャンルを表示する', () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={false}
        />
      )

      expect(screen.getByText('取り扱いジャンル')).toBeInTheDocument()
      expect(screen.getByText('松柏類')).toBeInTheDocument()
      expect(screen.getByText('雑木類')).toBeInTheDocument()
    })

    it('編集ボタンを表示しない', () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={false}
        />
      )

      expect(screen.queryByText('編集')).not.toBeInTheDocument()
    })

    it('ジャンルがない場合は未設定と表示する', () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={[]}
          isLoggedIn={false}
        />
      )

      expect(screen.getByText('未設定')).toBeInTheDocument()
    })
  })

  describe('ログインしている場合', () => {
    it('編集ボタンを表示する', () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      expect(screen.getByText('編集')).toBeInTheDocument()
    })

    it('編集ボタンをクリックすると編集モードになる', async () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument()
        expect(screen.getByText('キャンセル')).toBeInTheDocument()
      })
    })

    it('編集モードで利用可能なジャンルを取得する', async () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(mockGetShopGenres).toHaveBeenCalled()
      })
    })

    it('編集モードでジャンルを選択/解除できる', async () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('花もの')).toBeInTheDocument()
      })

      // 新しいジャンルを選択
      fireEvent.click(screen.getByText('花もの'))

      // 選択数が更新される
      expect(screen.getByText('3/5 選択中')).toBeInTheDocument()
    })

    it('選択済みのジャンルを解除できる', async () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('2/5 選択中')).toBeInTheDocument()
      })

      // 選択済みジャンルを解除
      const buttons = screen.getAllByRole('button')
      const matsButton = buttons.find(btn => btn.textContent === '松柏類')
      if (matsButton) {
        fireEvent.click(matsButton)
      }

      expect(screen.getByText('1/5 選択中')).toBeInTheDocument()
    })

    it('最大5つまでしか選択できない', async () => {
      const manyCurrentGenres = mockAvailableGenres.slice(0, 5)
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={manyCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('5/5 選択中')).toBeInTheDocument()
      })

      // 6つ目を選択しようとしても追加されない
      fireEvent.click(screen.getByText('苔玉'))

      expect(screen.getByText('5/5 選択中')).toBeInTheDocument()
    })

    it('保存ボタンをクリックするとupdateShopGenresを呼び出す', async () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('保存'))

      await waitFor(() => {
        expect(mockUpdateShopGenres).toHaveBeenCalledWith('shop-1', ['genre-1', 'genre-2'])
      })
    })

    it('保存成功時に編集モードを終了する', async () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('保存'))

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
        expect(screen.queryByText('保存')).not.toBeInTheDocument()
      })
    })

    it('保存エラー時にエラーメッセージを表示する', async () => {
      mockUpdateShopGenres.mockResolvedValue({ error: '保存に失敗しました' })

      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('保存'))

      await waitFor(() => {
        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
      })
    })

    it('キャンセルボタンをクリックすると編集モードを終了する', async () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('キャンセル')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('キャンセル'))

      expect(screen.queryByText('保存')).not.toBeInTheDocument()
      expect(screen.getByText('編集')).toBeInTheDocument()
    })

    it('キャンセル時に選択状態をリセットする', async () => {
      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('花もの')).toBeInTheDocument()
      })

      // ジャンルを追加
      fireEvent.click(screen.getByText('花もの'))
      expect(screen.getByText('3/5 選択中')).toBeInTheDocument()

      // キャンセル
      fireEvent.click(screen.getByText('キャンセル'))

      // 再度編集モードに入ると元の選択に戻っている
      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('2/5 選択中')).toBeInTheDocument()
      })
    })

    it('読み込み中は読み込み中...を表示する', async () => {
      mockGetShopGenres.mockImplementation(() => new Promise(() => {}))

      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })

    it('保存中はボタンを無効化する', async () => {
      mockUpdateShopGenres.mockImplementation(() => new Promise(() => {}))

      render(
        <ShopGenreEditor
          shopId="shop-1"
          currentGenres={mockCurrentGenres}
          isLoggedIn={true}
        />
      )

      fireEvent.click(screen.getByText('編集'))

      await waitFor(() => {
        expect(screen.getByText('保存')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('保存'))

      await waitFor(() => {
        expect(screen.getByText('保存中...')).toBeInTheDocument()
      })

      // ボタン要素を取得して無効化状態をチェック
      const buttons = screen.getAllByRole('button')
      const saveButton = buttons.find(btn => btn.textContent?.includes('保存中'))
      const cancelButton = buttons.find(btn => btn.textContent === 'キャンセル')

      expect(saveButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()
    })
  })
})
