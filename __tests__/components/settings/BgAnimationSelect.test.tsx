import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockGetBgAnimationPref = vi.fn()
const mockSetBgAnimationType = vi.fn()
const mockGetSeasonalAnimationType = vi.fn()

vi.mock('@/lib/sakura-petals-pref', () => {
  const VALID_PREFS = new Set([
    'sakura', 'momiji', 'snow', 'dandelion', 'rain', 'rain-drops', 'none', 'seasonal',
  ])
  return {
    getBgAnimationPref: () => mockGetBgAnimationPref(),
    setBgAnimationType: (type: string) => mockSetBgAnimationType(type),
    getSeasonalAnimationType: () => mockGetSeasonalAnimationType(),
    // 実装側の型ガード `isAnimationPref` を mock でも一致させる (本物と同じ判定)
    isAnimationPref: (value: string) => VALID_PREFS.has(value),
  }
})

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: {
    children: React.ReactNode
    value: string
    onValueChange: (v: string) => void
  }) => (
    <div data-testid="select" data-value={value}>
      <button onClick={() => onValueChange('momiji')}>change-to-momiji</button>
      <button onClick={() => onValueChange('none')}>change-to-none</button>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

import { BgAnimationSelect } from '@/components/settings/SakuraPetalsToggle'

describe('BgAnimationSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetBgAnimationPref.mockReturnValue('seasonal')
    mockGetSeasonalAnimationType.mockReturnValue('sakura')
  })

  it('「背景アニメーション」ラベルを表示する', () => {
    render(<BgAnimationSelect />)
    expect(screen.getByText('背景アニメーション')).toBeInTheDocument()
  })

  it('説明文を表示する', () => {
    render(<BgAnimationSelect />)
    expect(screen.getByText(/季節のエフェクト/)).toBeInTheDocument()
  })

  it('マウント後にlocalStorageから設定を読み込む', async () => {
    mockGetBgAnimationPref.mockReturnValue('momiji')
    render(<BgAnimationSelect />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    expect(mockGetBgAnimationPref).toHaveBeenCalled()
    const select = screen.getByTestId('select')
    expect(select).toHaveAttribute('data-value', 'momiji')
  })

  it('アニメーション変更時にsetBgAnimationTypeを呼ぶ', async () => {
    const user = userEvent.setup()
    render(<BgAnimationSelect />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    await user.click(screen.getByText('change-to-momiji'))
    expect(mockSetBgAnimationType).toHaveBeenCalledWith('momiji')
  })

  it('"none"に変更するとsetBgAnimationTypeに"none"を渡す', async () => {
    const user = userEvent.setup()
    render(<BgAnimationSelect />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    await user.click(screen.getByText('change-to-none'))
    expect(mockSetBgAnimationType).toHaveBeenCalledWith('none')
  })

  it('初期値は"seasonal"（getBgAnimationPrefが呼ばれる前のデフォルト）', () => {
    render(<BgAnimationSelect />)
    const select = screen.getByTestId('select')
    expect(select).toHaveAttribute('data-value', 'seasonal')
  })

  it('変更後にセレクト値が更新される', async () => {
    const user = userEvent.setup()
    render(<BgAnimationSelect />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    await user.click(screen.getByText('change-to-momiji'))
    const select = screen.getByTestId('select')
    expect(select).toHaveAttribute('data-value', 'momiji')
  })

  it('seasonalHintがSEASONAL_LABELSにない場合はそのまま表示する', () => {
    mockGetSeasonalAnimationType.mockReturnValue('unknown-type')
    render(<BgAnimationSelect />)
    // SEASONAL_LABELS に 'unknown-type' がないので currentSeasonal がそのまま使われる
    // 季節自動のラベルに 'unknown-type' が含まれる
    expect(screen.getByText(/unknown-type/)).toBeInTheDocument()
  })
})
