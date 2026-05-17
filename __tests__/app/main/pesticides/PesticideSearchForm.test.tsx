import { vi } from 'vitest'
import { render, screen } from '../../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PesticideSearchForm } from '@/app/(main)/pesticides/PesticideSearchForm'

// next/navigation モック
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

describe('PesticideSearchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset search params
    for (const key of [...mockSearchParams.keys()]) {
      mockSearchParams.delete(key)
    }
  })

  it('検索フォームをレンダリングする', () => {
    render(<PesticideSearchForm />)
    expect(screen.getByPlaceholderText('薬剤名・登録番号で検索...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument()
  })

  it('defaultSearch で初期値がセットされる', () => {
    render(<PesticideSearchForm defaultSearch="ダコニール" />)
    expect(screen.getByPlaceholderText('薬剤名・登録番号で検索...')).toHaveValue('ダコニール')
  })

  it('タグボタンがすべて表示される', () => {
    render(<PesticideSearchForm />)
    expect(screen.getByText('全て')).toBeInTheDocument()
    expect(screen.getByText('害虫')).toBeInTheDocument()
    expect(screen.getByText('病気')).toBeInTheDocument()
    expect(screen.getByText('益虫')).toBeInTheDocument()
    expect(screen.getByText('殺虫剤')).toBeInTheDocument()
    expect(screen.getByText('殺菌剤')).toBeInTheDocument()
    expect(screen.getByText('殺ダニ剤')).toBeInTheDocument()
    expect(screen.getByText('複合剤')).toBeInTheDocument()
    expect(screen.getByText('展着剤')).toBeInTheDocument()
  })

  it('検索フォーム送信時に search パラメータ付きで遷移する', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm />)

    const input = screen.getByPlaceholderText('薬剤名・登録番号で検索...')
    await user.type(input, 'スミチオン')
    await user.click(screen.getByRole('button', { name: '検索' }))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('search=%E3%82%B9%E3%83%9F%E3%83%81%E3%82%AA%E3%83%B3')
    )
  })

  it('空の検索語でフォーム送信すると search パラメータが削除される', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm defaultSearch="テスト" />)

    const input = screen.getByPlaceholderText('薬剤名・登録番号で検索...')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: '検索' }))

    expect(mockPush).toHaveBeenCalled()
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('search=')
  })

  it('害虫タグをクリックすると category=pest で遷移する', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm />)

    await user.click(screen.getByText('害虫'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('category=pest')
    )
  })

  it('病気タグをクリックすると category=disease で遷移する', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm />)

    await user.click(screen.getByText('病気'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('category=disease')
    )
  })

  it('益虫タグをクリックすると category=beneficial_insect で遷移する', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm />)

    await user.click(screen.getByText('益虫'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('category=beneficial_insect')
    )
  })

  it('殺虫剤タグをクリックすると type=insecticide で遷移する', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm />)

    await user.click(screen.getByText('殺虫剤'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('type=insecticide')
    )
  })

  it('殺菌剤タグをクリックすると type=fungicide で遷移する', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm />)

    await user.click(screen.getByText('殺菌剤'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('type=fungicide')
    )
  })

  it('展着剤タグをクリックすると type=spreader で遷移する', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm />)

    await user.click(screen.getByText('展着剤'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('type=spreader')
    )
  })

  it('「全て」タグをクリックすると /pesticides に遷移する', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm defaultType="insecticide" />)

    await user.click(screen.getByText('全て'))

    expect(mockPush).toHaveBeenCalledWith('/pesticides')
  })

  it('defaultType も defaultCategory もない場合は「全て」タグがアクティブになる', () => {
    render(<PesticideSearchForm />)
    const allButton = screen.getByText('全て')
    expect(allButton.className).toContain('bg-primary')
  })

  it('defaultCategory=pest の場合は「害虫」タグがアクティブになる', () => {
    render(<PesticideSearchForm defaultCategory="pest" />)
    const pestButton = screen.getByText('害虫')
    expect(pestButton.className).toContain('bg-primary')

    const allButton = screen.getByText('全て')
    expect(allButton.className).not.toContain('bg-primary text-primary-foreground')
  })

  it('defaultType=fungicide の場合は「殺菌剤」タグがアクティブになる', () => {
    render(<PesticideSearchForm defaultType="fungicide" />)
    const button = screen.getByText('殺菌剤')
    expect(button.className).toContain('bg-primary')
  })

  it('defaultSearch がある場合にクリアボタンが表示される', () => {
    render(<PesticideSearchForm defaultSearch="テスト" />)
    expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument()
  })

  it('defaultType がある場合にクリアボタンが表示される', () => {
    render(<PesticideSearchForm defaultType="fungicide" />)
    expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument()
  })

  it('defaultCategory がある場合にクリアボタンが表示される', () => {
    render(<PesticideSearchForm defaultCategory="pest" />)
    expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument()
  })

  it('フィルタなしの場合はクリアボタンが表示されない', () => {
    render(<PesticideSearchForm />)
    expect(screen.queryByRole('button', { name: 'クリア' })).not.toBeInTheDocument()
  })

  it('クリアボタンをクリックすると検索欄がクリアされて /pesticides に遷移する', async () => {
    const user = userEvent.setup()
    render(<PesticideSearchForm defaultSearch="テスト" />)

    await user.click(screen.getByRole('button', { name: 'クリア' }))

    expect(mockPush).toHaveBeenCalledWith('/pesticides')
    expect(screen.getByPlaceholderText('薬剤名・登録番号で検索...')).toHaveValue('')
  })

  it('diseasePest パラメータが存在する場合にクリアボタンが表示される', () => {
    mockSearchParams.set('diseasePest', 'dp-1')
    render(<PesticideSearchForm />)
    expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument()
  })

  it('検索フォーム送信時に diseasePest パラメータが削除される', async () => {
    const user = userEvent.setup()
    mockSearchParams.set('diseasePest', 'dp-1')
    render(<PesticideSearchForm />)

    const input = screen.getByPlaceholderText('薬剤名・登録番号で検索...')
    await user.type(input, 'テスト')
    await user.click(screen.getByRole('button', { name: '検索' }))

    expect(mockPush).toHaveBeenCalled()
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('diseasePest=')
  })
})
