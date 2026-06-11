import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { PesticideSearchForm } from '@/app/(main)/pesticides/PesticideSearchForm'

const mockPush = vi.fn()
const mockGet = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => mockGet(key),
    toString: () => (mockGet('_toString') !== undefined ? String(mockGet('_toString')) : ''),
  }),
}))

describe('PesticideSearchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGet.mockReturnValue(undefined)
  })

  it('検索入力と検索ボタンを表示する', () => {
    render(<PesticideSearchForm />)

    expect(
      screen.getByPlaceholderText('薬剤名・登録番号で検索...')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument()
  })

  it('defaultSearchで入力欄の初期値が設定される', () => {
    render(<PesticideSearchForm defaultSearch="トリフミン" />)

    const input = screen.getByPlaceholderText('薬剤名・登録番号で検索...')
    expect(input).toHaveValue('トリフミン')
  })

  it('一組のタグ（全て・害虫・病気・殺虫剤・殺菌剤・展着剤）を表示する', () => {
    render(<PesticideSearchForm />)

    expect(screen.getByRole('button', { name: '全て' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '害虫' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '病気' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '殺虫剤' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '殺菌剤' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展着剤' })).toBeInTheDocument()
  })

  it('除草剤の選択肢は含まない', () => {
    render(<PesticideSearchForm />)

    expect(screen.queryByRole('button', { name: '除草剤' })).not.toBeInTheDocument()
  })

  it('検索送信でrouter.pushが呼ばれsearchがクエリに含まれる', async () => {
    render(<PesticideSearchForm />)

    const input = screen.getByPlaceholderText('薬剤名・登録番号で検索...')
    fireEvent.change(input, { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('search='))
    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/\/pesticides\?/))
  })

  it('タイプボタンクリックでrouter.pushが呼ばれる', () => {
    render(<PesticideSearchForm />)

    fireEvent.click(screen.getByRole('button', { name: '殺菌剤' }))

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('type=fungicide'))
  })

  it('defaultTypeがあるときクリアボタンを表示する', () => {
    render(<PesticideSearchForm defaultType="fungicide" />)

    expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument()
  })

  it('defaultSearchがあるときクリアボタンを表示する', () => {
    render(<PesticideSearchForm defaultSearch="トリフミン" />)

    expect(screen.getByRole('button', { name: 'クリア' })).toBeInTheDocument()
  })

  it('クリアボタンクリックで/pesticidesへ遷移する', () => {
    render(<PesticideSearchForm defaultSearch="x" />)

    fireEvent.click(screen.getByRole('button', { name: 'クリア' }))

    expect(mockPush).toHaveBeenCalledWith('/pesticides')
  })

  it('defaultTypeと一致するタイプボタンがアクティブ表示される', () => {
    render(<PesticideSearchForm defaultType="fungicide" />)

    const fungicideButton = screen.getByRole('button', { name: '殺菌剤' })
    expect(fungicideButton).toHaveClass('bg-primary')
  })

  it('展着剤ボタンクリックで type=spreader で遷移する', () => {
    render(<PesticideSearchForm />)

    fireEvent.click(screen.getByRole('button', { name: '展着剤' }))

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('type=spreader'))
  })

  it('defaultType=spreader のとき展着剤ボタンがアクティブ表示される', () => {
    render(<PesticideSearchForm defaultType="spreader" />)

    const spreaderButton = screen.getByRole('button', { name: '展着剤' })
    expect(spreaderButton).toHaveClass('bg-primary')
  })

  it('全てボタンクリックで /pesticides へ遷移する', () => {
    mockGet.mockReturnValue('type=spreader')
    render(<PesticideSearchForm defaultType="spreader" />)

    fireEvent.click(screen.getByRole('button', { name: '全て' }))

    expect(mockPush).toHaveBeenCalledWith('/pesticides')
  })

  it('検索送信時は diseasePest をクエリから削除する', () => {
    mockGet.mockImplementation((key: string) =>
      key === 'diseasePest' ? 'dp1' : key === '_toString' ? 'diseasePest=dp1' : undefined
    )
    render(<PesticideSearchForm />)

    const input = screen.getByPlaceholderText('薬剤名・登録番号で検索...')
    fireEvent.change(input, { target: { value: 'トリフミン' } })
    fireEvent.click(screen.getByRole('button', { name: '検索' }))

    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/search=/))
    const url = mockPush.mock.calls[0]?.[0]
    expect(url).not.toContain('diseasePest')
  })
})
