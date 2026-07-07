import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { BgAnimationSelect } from '@/components/settings/SakuraPetalsToggle'

/**
 * 既存の SakuraPetalsToggle.test.tsx の Select モックは onValueChange を配線していないため
 * handleChange (isAnimationPref のガード分岐や setBgAnimationType 呼び出し) が一度も実行されない。
 * ここでは Select の value 変更を Context 経由で SelectItem のクリックに繋ぎ、
 * 実際の分岐を検証する。
 */
vi.mock('@/components/ui/select', () => {
  const SelectCtx = React.createContext<(v: string) => void>(() => {})
  return {
    Select: ({ children, onValueChange, value }: {
      children: React.ReactNode
      onValueChange: (v: string) => void
      value: string
    }) => (
      <SelectCtx.Provider value={onValueChange}>
        <div data-testid="select" data-value={value}>{children}</div>
      </SelectCtx.Provider>
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
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => {
      const onValueChange = React.useContext(SelectCtx)
      return (
        <div
          data-testid={`select-item-${value}`}
          role="option"
          aria-selected={false}
          onClick={() => onValueChange(value)}
        >
          {children}
        </div>
      )
    },
  }
})

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

const mockGetBgAnimationPref = vi.fn()
const mockSetBgAnimationType = vi.fn()
const mockGetSeasonalAnimationType = vi.fn()
const mockIsAnimationPref = vi.fn()

vi.mock('@/lib/sakura-petals-pref', () => ({
  getBgAnimationPref: () => mockGetBgAnimationPref(),
  setBgAnimationType: (...args: unknown[]) => mockSetBgAnimationType(...args),
  getSeasonalAnimationType: () => mockGetSeasonalAnimationType(),
  isAnimationPref: (v: string) => mockIsAnimationPref(v),
}))

describe('BgAnimationSelect - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetBgAnimationPref.mockReturnValue('seasonal')
    mockGetSeasonalAnimationType.mockReturnValue('sakura')
    mockIsAnimationPref.mockImplementation((v: string) =>
      ['seasonal', 'sakura', 'dandelion', 'rain-drops', 'rain', 'momiji', 'snow', 'none'].includes(v)
    )
  })

  it('有効な値を選択すると setBgAnimationType が呼ばれ、選択値が更新される', async () => {
    render(<BgAnimationSelect />)

    // マウント時の setTimeout(0) 経由の getBgAnimationPref 反映が
    // クリック後の状態更新を上書きしないよう、先に完了を待つ
    await waitFor(() => {
      expect(mockGetBgAnimationPref).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByTestId('select-item-sakura'))

    await waitFor(() => {
      expect(mockSetBgAnimationType).toHaveBeenCalledWith('sakura')
    })
    await waitFor(() => {
      expect(screen.getByTestId('select')).toHaveAttribute('data-value', 'sakura')
    })
  })

  it('isAnimationPref が false を返す不正な値の場合、状態を更新せず setBgAnimationType も呼ばない', async () => {
    mockIsAnimationPref.mockReturnValue(false)
    render(<BgAnimationSelect />)

    fireEvent.click(screen.getByTestId('select-item-sakura'))

    // 非同期の getBgAnimationPref 反映を待ってから判定する
    await waitFor(() => {
      expect(mockGetBgAnimationPref).toHaveBeenCalled()
    })
    expect(mockSetBgAnimationType).not.toHaveBeenCalled()
    expect(screen.getByTestId('select')).toHaveAttribute('data-value', 'seasonal')
  })

  it('季節ラベルに定義がない値の場合、生の値をそのままヒントに表示する', async () => {
    mockGetSeasonalAnimationType.mockReturnValue('unknown-type')
    render(<BgAnimationSelect />)

    await waitFor(() => {
      expect(screen.getByText('季節自動（今: unknown-type）')).toBeInTheDocument()
    })
  })

  it('季節ラベルに定義がある値の場合はラベルに変換して表示する（雨=水面）', async () => {
    mockGetSeasonalAnimationType.mockReturnValue('rain')
    render(<BgAnimationSelect />)

    await waitFor(() => {
      expect(screen.getByText('季節自動（今: 水面）')).toBeInTheDocument()
    })
  })
})
