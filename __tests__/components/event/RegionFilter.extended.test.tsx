import { vi } from 'vitest'
/**
 * RegionFilter コンポーネントの拡張テスト
 */
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Next.js navigation モック
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}))

import { RegionFilter } from '@/components/event/RegionFilter'

describe('RegionFilter 拡張テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('地域フィルターがレンダリングされる', () => {
    render(<RegionFilter />)

    expect(screen.getByText('地域で絞り込み')).toBeInTheDocument()
    expect(screen.getByText('地方')).toBeInTheDocument()
    expect(screen.getByText('都道府県')).toBeInTheDocument()
  })

  it('都道府県セレクトにすべての都道府県オプションがある', () => {
    render(<RegionFilter />)

    expect(screen.getByText('すべての都道府県')).toBeInTheDocument()
  })

  it('地方ボタンをクリックするとURLが変更される', async () => {
    const user = userEvent.setup()
    render(<RegionFilter />)

    // 関東ボタンをクリック
    const kantoButton = screen.getByRole('button', { name: '関東' })
    await user.click(kantoButton)

    expect(mockPush).toHaveBeenCalled()
    const calledUrl = mockPush.mock.calls[0]![0]!
    expect(decodeURIComponent(calledUrl)).toBe('/events?region=関東')
  })

  it('都道府県を選択するとURLが変更される', async () => {
    const user = userEvent.setup()
    render(<RegionFilter />)

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '東京都')

    expect(mockPush).toHaveBeenCalled()
    const calledUrl = mockPush.mock.calls[0]![0]!
    expect(decodeURIComponent(calledUrl)).toBe('/events?prefecture=東京都')
  })

  it('currentRegionが設定されている場合はボタンが強調表示される', () => {
    render(<RegionFilter currentRegion="関東" />)

    const kantoButton = screen.getByRole('button', { name: '関東' })
    expect(kantoButton).toHaveClass('bg-primary')
  })

  it('currentPrefectureが設定されている場合はセレクトに値が表示される', () => {
    render(<RegionFilter currentPrefecture="東京都" />)

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('東京都')
  })

  it('フィルターが設定されている場合はクリアボタンが表示される', () => {
    render(<RegionFilter currentRegion="関東" />)

    expect(screen.getByText('フィルターをクリア')).toBeInTheDocument()
  })

  it('クリアボタンをクリックするとフィルターがクリアされる', async () => {
    const user = userEvent.setup()
    render(<RegionFilter currentRegion="関東" />)

    await user.click(screen.getByText('フィルターをクリア'))

    expect(mockPush).toHaveBeenCalledWith('/events?')
  })

  it('同じ地方ボタンを再クリックすると選択解除される', async () => {
    const user = userEvent.setup()
    render(<RegionFilter currentRegion="関東" />)

    const kantoButton = screen.getByRole('button', { name: '関東' })
    await user.click(kantoButton)

    // region パラメータが削除される
    expect(mockPush).toHaveBeenCalledWith('/events?')
  })

  it('フィルターなしの場合はクリアボタンが非表示', () => {
    render(<RegionFilter />)

    expect(screen.queryByText('フィルターをクリア')).not.toBeInTheDocument()
  })
})
