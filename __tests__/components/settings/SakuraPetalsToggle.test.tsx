import { vi } from 'vitest'
/**
 * BgAnimationSelectコンポーネントのテスト
 */

import { render, screen, waitFor } from '@testing-library/react'
import _userEvent from '@testing-library/user-event'

// sakura-petals-pref モック
const mockGetBgAnimationPref = vi.fn()
const mockSetBgAnimationType = vi.fn()
const mockGetSeasonalAnimationType = vi.fn()

vi.mock('@/lib/sakura-petals-pref', () => ({
  getBgAnimationPref: () => mockGetBgAnimationPref(),
  setBgAnimationType: (...args: unknown[]) => mockSetBgAnimationType(...args),
  getSeasonalAnimationType: () => mockGetSeasonalAnimationType(),
  BG_ANIMATION_STORAGE_KEY: 'bg-animation-type',
  BG_ANIMATION_CHANGE_EVENT: 'bg-animation-change',
}))

// shadcn/ui Select モック
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange: _onValueChange, value }: {
    children: React.ReactNode
    onValueChange: (v: string) => void
    value: string
  }) => (
    <div data-testid="select" data-value={value}>
      <button
        data-testid="select-trigger"
        onClick={() => {}}
      >
        {value}
      </button>
      <div data-testid="select-content">
        {children}
      </div>
    </div>
  ),
  SelectTrigger: ({ children, id }: { children: React.ReactNode; id?: string }) => (
    <button id={id} data-testid="select-trigger-inner">{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content-inner">{children}</div>
  ),
  SelectItem: ({ children, value, onClick }: { children: React.ReactNode; value: string; onClick?: () => void }) => (
    <div
      data-testid={`select-item-${value}`}
      data-value={value}
      onClick={onClick}
      role="option"
      aria-selected={false}
    >
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, className }: { children: React.ReactNode; htmlFor?: string; className?: string }) => (
    <label htmlFor={htmlFor} className={className}>{children}</label>
  ),
}))

import { BgAnimationSelect } from '@/components/settings/SakuraPetalsToggle'

describe('BgAnimationSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetBgAnimationPref.mockReturnValue('seasonal')
    mockGetSeasonalAnimationType.mockReturnValue('sakura')
  })

  // ============================================================
  // レンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('コンポーネントが正常にレンダリングされる', async () => {
      render(<BgAnimationSelect />)

      await waitFor(() => {
        expect(screen.getByText('背景アニメーション')).toBeInTheDocument()
      })
    })

    it('説明テキストが表示される', async () => {
      render(<BgAnimationSelect />)

      await waitFor(() => {
        expect(screen.getByText('画面の奥に舞う季節のエフェクトを選択できます')).toBeInTheDocument()
      })
    })

    it('セレクトトリガーが表示される', async () => {
      render(<BgAnimationSelect />)

      await waitFor(() => {
        expect(screen.getByTestId('select')).toBeInTheDocument()
      })
    })

    it('デフォルトでseasonalが選択されている', async () => {
      mockGetBgAnimationPref.mockReturnValue('seasonal')
      render(<BgAnimationSelect />)

      await waitFor(() => {
        const select = screen.getByTestId('select')
        expect(select).toHaveAttribute('data-value', 'seasonal')
      })
    })
  })

  // ============================================================
  // 選択肢
  // ============================================================

  describe('選択肢の表示', () => {
    it('桜の花びら選択肢が表示される', async () => {
      render(<BgAnimationSelect />)

      await waitFor(() => {
        expect(screen.getByText('桜の花びら')).toBeInTheDocument()
      })
    })

    it('秋の紅葉選択肢が表示される', async () => {
      render(<BgAnimationSelect />)

      await waitFor(() => {
        expect(screen.getByText('秋の紅葉')).toBeInTheDocument()
      })
    })

    it('オフ選択肢が表示される', async () => {
      render(<BgAnimationSelect />)

      await waitFor(() => {
        expect(screen.getByText('オフ（非表示）')).toBeInTheDocument()
      })
    })

    it('冬の雪選択肢が表示される', async () => {
      render(<BgAnimationSelect />)

      await waitFor(() => {
        expect(screen.getByText('冬の雪')).toBeInTheDocument()
      })
    })

    it('春の綿毛選択肢が表示される', async () => {
      render(<BgAnimationSelect />)

      await waitFor(() => {
        expect(screen.getByText('春の綿毛')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // localStorage との連携
  // ============================================================

  describe('localStorage との連携', () => {
    it('マウント後にgetBgAnimationPrefが呼ばれる', async () => {
      render(<BgAnimationSelect />)

      await waitFor(() => {
        expect(mockGetBgAnimationPref).toHaveBeenCalled()
      })
    })

    it('noneを返す場合にセレクト値がnoneになる', async () => {
      mockGetBgAnimationPref.mockReturnValue('none')
      render(<BgAnimationSelect />)

      await waitFor(() => {
        const select = screen.getByTestId('select')
        expect(select).toHaveAttribute('data-value', 'none')
      })
    })
  })
})
