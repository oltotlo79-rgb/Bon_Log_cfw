import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { RegionFilter } from '@/components/event/RegionFilter'

// Next.js navigation モック
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}))

describe('RegionFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('「地域で絞り込み」ヘッダーを表示する', () => {
    render(<RegionFilter />)
    expect(screen.getByText('地域で絞り込み')).toBeInTheDocument()
  })

  it('地方ブロックのボタンを表示する', () => {
    render(<RegionFilter />)
    expect(screen.getByRole('button', { name: '北海道' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '東北' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '関東' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中部' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '近畿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '中国' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '四国' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '九州・沖縄' })).toBeInTheDocument()
  })

  it('都道府県セレクトボックスを表示する', () => {
    render(<RegionFilter />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('すべての都道府県')).toBeInTheDocument()
  })

  it('地方ボタンクリックでURLを変更する', async () => {
    const user = userEvent.setup()
    render(<RegionFilter />)

    await user.click(screen.getByRole('button', { name: '関東' }))
    expect(mockPush).toHaveBeenCalledWith('/events?region=%E9%96%A2%E6%9D%B1')
  })

  it('都道府県選択でURLを変更する', async () => {
    const user = userEvent.setup()
    render(<RegionFilter />)

    await user.selectOptions(screen.getByRole('combobox'), '東京都')
    expect(mockPush).toHaveBeenCalledWith('/events?prefecture=%E6%9D%B1%E4%BA%AC%E9%83%BD')
  })

  it('選択中の地方はアクティブスタイルになる', () => {
    render(<RegionFilter currentRegion="関東" />)
    const regionButton = screen.getByRole('button', { name: '関東' })
    expect(regionButton).toHaveClass('bg-primary')
  })

  it('フィルターがある場合はクリアボタンを表示する', () => {
    render(<RegionFilter currentRegion="関東" />)
    expect(screen.getByText('フィルターをクリア')).toBeInTheDocument()
  })

  it('フィルターがない場合はクリアボタンを表示しない', () => {
    render(<RegionFilter />)
    expect(screen.queryByText('フィルターをクリア')).not.toBeInTheDocument()
  })

  it('クリアボタンでフィルターをクリアする', async () => {
    const user = userEvent.setup()
    render(<RegionFilter currentRegion="関東" />)

    await user.click(screen.getByText('フィルターをクリア'))
    expect(mockPush).toHaveBeenCalledWith('/events?')
  })
})
