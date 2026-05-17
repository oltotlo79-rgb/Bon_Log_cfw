import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { AdvancedSearchFilters } from '@/components/search/AdvancedSearchFilters'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    toString: () => 'q=test',
  }),
}))

describe('AdvancedSearchFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('詳細フィルターボタンが表示される', () => {
    render(<AdvancedSearchFilters />)
    expect(screen.getByText('詳細フィルター')).toBeInTheDocument()
  })

  it('初期状態ではフィルター入力が非表示', () => {
    render(<AdvancedSearchFilters />)
    expect(screen.queryByText('開始日')).not.toBeInTheDocument()
  })

  it('クリックでフィルター入力が展開される', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.getByText('開始日')).toBeInTheDocument()
    expect(screen.getByText('終了日')).toBeInTheDocument()
  })

  it('展開後に最小いいね数フィールドが表示される', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.getByText('最小いいね数')).toBeInTheDocument()
  })

  it('展開後にメディア種別フィルターが表示される', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.getByText('メディア種別')).toBeInTheDocument()
  })

  it('メディア種別の選択肢が全て表示される', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.getByText('すべて')).toBeInTheDocument()
    expect(screen.getByText('画像あり')).toBeInTheDocument()
    expect(screen.getByText('動画あり')).toBeInTheDocument()
    expect(screen.getByText('テキストのみ')).toBeInTheDocument()
  })

  it('適用ボタンが表示される', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.getByText('適用')).toBeInTheDocument()
  })

  it('フィルターなしではリセットボタンが非表示', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.queryByText('リセット')).not.toBeInTheDocument()
  })

  it('適用ボタンクリックでrouterにpushされる', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    await user.click(screen.getByText('適用'))
    expect(mockPush).toHaveBeenCalledWith('/search?q=test')
  })

  it('メディア種別を選択して適用するとURLに反映される', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    await user.click(screen.getByText('画像あり'))
    await user.click(screen.getByText('適用'))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('mediaType=images'))
  })

  it('最小いいね数を入力して適用するとURLに反映される', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    const minLikesInput = screen.getByPlaceholderText('0')
    await user.type(minLikesInput, '10')
    await user.click(screen.getByText('適用'))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('minLikes=10'))
  })

  it('初期値が設定されている場合は展開状態で表示される', () => {
    render(<AdvancedSearchFilters dateFrom="2024-01-01" />)
    expect(screen.getByText('開始日')).toBeInTheDocument()
  })

  it('初期値のdateToが設定されている場合展開される', () => {
    render(<AdvancedSearchFilters dateTo="2024-12-31" />)
    expect(screen.getByText('終了日')).toBeInTheDocument()
  })

  it('初期値のminLikesが設定されている場合展開される', () => {
    render(<AdvancedSearchFilters minLikes="5" />)
    expect(screen.getByText('最小いいね数')).toBeInTheDocument()
  })

  it('初期値のmediaTypeが設定されている場合展開される', () => {
    render(<AdvancedSearchFilters mediaType="images" />)
    expect(screen.getByText('メディア種別')).toBeInTheDocument()
  })

  it('フィルターが設定されている場合インジケーターが表示される', () => {
    render(<AdvancedSearchFilters dateFrom="2024-01-01" />)
    // インジケータードット（bg-bonsai-greenのspan）
    const indicator = document.querySelector('.bg-bonsai-green')
    expect(indicator).toBeInTheDocument()
  })

  it('メディア種別「すべて」を選択するとmediaTypeがリセットされる', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    await user.click(screen.getByText('画像あり'))
    await user.click(screen.getByText('すべて'))
    await user.click(screen.getByText('適用'))
    expect(mockPush).toHaveBeenCalledWith('/search?q=test')
  })

  it('動画ありを選択して適用', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    await user.click(screen.getByText('動画あり'))
    await user.click(screen.getByText('適用'))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('mediaType=videos'))
  })

  it('テキストのみを選択して適用', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    await user.click(screen.getByText('テキストのみ'))
    await user.click(screen.getByText('適用'))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('mediaType=text'))
  })

  it('もう一度クリックでフィルターが閉じる', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.getByText('開始日')).toBeInTheDocument()
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.queryByText('開始日')).not.toBeInTheDocument()
  })

  it('minLikesが0の場合はURLに含めない', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    const input = screen.getByPlaceholderText('0')
    await user.type(input, '0')
    await user.click(screen.getByText('適用'))
    expect(mockPush).toHaveBeenCalledWith('/search?q=test')
  })

  it('リセットボタンが初期値ありの場合に表示される', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))
    await user.click(screen.getByText('画像あり'))
    expect(screen.getByText('リセット')).toBeInTheDocument()
  })

  it('リセットクリックでフィルターがクリアされる', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters mediaType="images" />)
    await user.click(screen.getByText('リセット'))
    expect(mockPush).toHaveBeenCalledWith('/search?q=test')
  })
})
