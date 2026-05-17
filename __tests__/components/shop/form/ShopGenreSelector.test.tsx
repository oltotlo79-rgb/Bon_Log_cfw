import { vi } from 'vitest'
/**
 * ShopGenreSelectorコンポーネントのテスト
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ShopGenreSelector } from '@/components/shop/form/ShopGenreSelector'

const mockGenres = [
  { id: 'genre-1', name: '松柏類', category: '盆栽' },
  { id: 'genre-2', name: '雑木類', category: '盆栽' },
  { id: 'genre-3', name: '用品・道具', category: '用品' },
  { id: 'genre-4', name: '鉢', category: '用品' },
]

describe('ShopGenreSelector', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // レンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('ラベルが表示される', () => {
      render(
        <ShopGenreSelector
          selectedGenreIds={[]}
          availableGenres={mockGenres}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('取り扱いジャンル')).toBeInTheDocument()
    })

    it('全てのジャンルが表示される', () => {
      render(
        <ShopGenreSelector
          selectedGenreIds={[]}
          availableGenres={mockGenres}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('松柏類')).toBeInTheDocument()
      expect(screen.getByText('雑木類')).toBeInTheDocument()
      expect(screen.getByText('用品・道具')).toBeInTheDocument()
      expect(screen.getByText('鉢')).toBeInTheDocument()
    })

    it('カテゴリごとにグループ化されて表示される', () => {
      render(
        <ShopGenreSelector
          selectedGenreIds={[]}
          availableGenres={mockGenres}
          onChange={mockOnChange}
        />
      )

      expect(screen.getByText('盆栽')).toBeInTheDocument()
      expect(screen.getByText('用品')).toBeInTheDocument()
    })

    it('ジャンルがない場合は何も表示されない', () => {
      render(
        <ShopGenreSelector
          selectedGenreIds={[]}
          availableGenres={[]}
          onChange={mockOnChange}
        />
      )

      expect(screen.queryByText('松柏類')).not.toBeInTheDocument()
    })
  })

  // ============================================================
  // 選択状態
  // ============================================================

  describe('選択状態', () => {
    it('選択されたジャンルが視覚的に区別される', () => {
      render(
        <ShopGenreSelector
          selectedGenreIds={['genre-1']}
          availableGenres={mockGenres}
          onChange={mockOnChange}
        />
      )

      const genre1Button = screen.getByText('松柏類')
      // 選択済みのジャンルはbg-primaryクラスを持つ
      expect(genre1Button).toHaveClass('bg-primary')
    })

    it('未選択のジャンルには選択スタイルが適用されない', () => {
      render(
        <ShopGenreSelector
          selectedGenreIds={['genre-1']}
          availableGenres={mockGenres}
          onChange={mockOnChange}
        />
      )

      const genre2Button = screen.getByText('雑木類')
      expect(genre2Button).not.toHaveClass('bg-primary')
    })
  })

  // ============================================================
  // インタラクション
  // ============================================================

  describe('インタラクション', () => {
    it('未選択のジャンルをクリックするとonChangeが選択IDリストと共に呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <ShopGenreSelector
          selectedGenreIds={[]}
          availableGenres={mockGenres}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByText('松柏類'))

      expect(mockOnChange).toHaveBeenCalledWith(['genre-1'])
    })

    it('選択済みのジャンルをクリックするとonChangeで削除される', async () => {
      const user = userEvent.setup()
      render(
        <ShopGenreSelector
          selectedGenreIds={['genre-1', 'genre-2']}
          availableGenres={mockGenres}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByText('松柏類'))

      expect(mockOnChange).toHaveBeenCalledWith(['genre-2'])
    })

    it('複数のジャンルを選択できる', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <ShopGenreSelector
          selectedGenreIds={[]}
          availableGenres={mockGenres}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByText('松柏類'))
      expect(mockOnChange).toHaveBeenCalledWith(['genre-1'])

      rerender(
        <ShopGenreSelector
          selectedGenreIds={['genre-1']}
          availableGenres={mockGenres}
          onChange={mockOnChange}
        />
      )

      await user.click(screen.getByText('雑木類'))
      expect(mockOnChange).toHaveBeenCalledWith(['genre-1', 'genre-2'])
    })
  })

  // ============================================================
  // disabled状態
  // ============================================================

  describe('disabled状態', () => {
    it('disabled時にボタンが無効化される', () => {
      render(
        <ShopGenreSelector
          selectedGenreIds={[]}
          availableGenres={mockGenres}
          onChange={mockOnChange}
          disabled
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach((button) => {
        expect(button).toBeDisabled()
      })
    })

    it('disabled時にクリックしてもonChangeが呼ばれない', async () => {
      const user = userEvent.setup()
      render(
        <ShopGenreSelector
          selectedGenreIds={[]}
          availableGenres={mockGenres}
          onChange={mockOnChange}
          disabled
        />
      )

      await user.click(screen.getByText('松柏類'))

      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })
})
