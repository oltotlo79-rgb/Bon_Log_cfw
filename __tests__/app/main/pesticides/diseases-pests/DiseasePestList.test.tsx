import { vi } from 'vitest'
import { render, screen } from '../../../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { DiseasePestList } from '@/app/(main)/pesticides/diseases-pests/DiseasePestList'

// next/navigation モック
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// next/image モック
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src as string} alt={alt as string} data-testid="next-image" {...rest} />
  },
}))

// 実広告ユニットはテスト環境で描画しない。InFeedAdSlot の挿入判定は実物を使い、
// 中身のユニットだけ data-testid 付きの軽量スタブに差し替えて件数を検証可能にする。
vi.mock('@/components/ads/AdProvider', () => ({
  InFeedAdUnit: () => <div data-testid="in-feed-ad-unit" />,
}))

const makeItem = (overrides: Partial<Parameters<typeof DiseasePestList>[0]['diseasePests'][number]> = {}) => ({
  id: 'dp-1',
  name: 'うどんこ病',
  nameKana: 'うどんこびょう',
  category: 'disease' as const,
  description: '白い粉状のカビが発生する病気',
  imageUrl: null,
  slug: 'udonko',
  _count: { effects: 3 },
  ...overrides,
})

describe('DiseasePestList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('病害虫リストを表示する', () => {
    const items = [
      makeItem(),
      makeItem({ id: 'dp-2', name: 'アブラムシ', category: 'pest', slug: 'aburamushi', description: null, _count: { effects: 0 } }),
    ]
    render(<DiseasePestList diseasePests={items} />)

    expect(screen.getByText('うどんこ病')).toBeInTheDocument()
    expect(screen.getByText('アブラムシ')).toBeInTheDocument()
  })

  it('データがない場合に空メッセージを表示する', () => {
    render(<DiseasePestList diseasePests={[]} />)
    expect(screen.getByText('該当するデータが見つかりませんでした')).toBeInTheDocument()
  })

  it('21件以上は一覧内に in-feed 広告を 20 件ごとに挿入する（末尾フォールバックは出さない）', () => {
    const items = Array.from({ length: 21 }, (_, i) =>
      makeItem({ id: `dp-${i}`, name: `病害虫${i}`, slug: `slug-${i}`, description: null }),
    )
    render(<DiseasePestList diseasePests={items} />)
    // 20件目(index 19)の直後に1枠のみ。21件目は末尾のため出さず、末尾フォールバックも出さない。
    expect(screen.getAllByTestId('in-feed-ad-unit')).toHaveLength(1)
  })

  it('20件以下（in-feed が出ない件数）は末尾に広告を1枠表示する', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `dp-${i}`, name: `病害虫${i}`, slug: `slug-${i}`, description: null }),
    )
    render(<DiseasePestList diseasePests={items} />)
    // in-feed は1枠も出ないが、末尾フォールバックで1枠表示する。
    expect(screen.getAllByTestId('in-feed-ad-unit')).toHaveLength(1)
  })

  it('データがない場合は広告を表示しない', () => {
    render(<DiseasePestList diseasePests={[]} />)
    expect(screen.queryByTestId('in-feed-ad-unit')).not.toBeInTheDocument()
  })

  it('説明文がある場合に表示する', () => {
    render(<DiseasePestList diseasePests={[makeItem()]} />)
    expect(screen.getByText('白い粉状のカビが発生する病気')).toBeInTheDocument()
  })

  it('説明文がない場合は表示しない', () => {
    render(<DiseasePestList diseasePests={[makeItem({ description: null })]} />)
    expect(screen.queryByText('白い粉状のカビが発生する病気')).not.toBeInTheDocument()
  })

  it('対応薬剤件数が0より大きい場合に表示する', () => {
    render(<DiseasePestList diseasePests={[makeItem({ _count: { effects: 5 } })]} />)
    expect(screen.getByText('対応薬剤 5件')).toBeInTheDocument()
  })

  it('対応薬剤件数が0の場合は表示しない', () => {
    render(<DiseasePestList diseasePests={[makeItem({ _count: { effects: 0 } })]} />)
    expect(screen.queryByText(/対応薬剤/)).not.toBeInTheDocument()
  })

  it('画像URLがある場合にImageを表示する', () => {
    render(<DiseasePestList diseasePests={[makeItem({ imageUrl: '/test.jpg' })]} />)
    expect(screen.getByTestId('next-image')).toBeInTheDocument()
  })

  it('画像URLがない場合にカテゴリ絵文字を表示する', () => {
    render(<DiseasePestList diseasePests={[makeItem({ category: 'pest', imageUrl: null })]} />)
    // pest category emoji
    expect(screen.getByText('🐛')).toBeInTheDocument()
  })

  it('カテゴリバッジを表示する', () => {
    render(<DiseasePestList diseasePests={[makeItem({ category: 'disease' })]} />)
    const badges = screen.getAllByText('病害')
    // フィルタボタンとバッジの両方に「病害」テキストが存在する
    expect(badges.length).toBeGreaterThanOrEqual(2)
  })

  it('益虫カテゴリバッジを表示する', () => {
    render(<DiseasePestList diseasePests={[makeItem({ category: 'beneficial_insect' })]} />)
    const badges = screen.getAllByText('益虫')
    expect(badges.length).toBeGreaterThanOrEqual(2)
  })

  it('リンク先が正しい slug で構成される', () => {
    render(<DiseasePestList diseasePests={[makeItem({ slug: 'test-slug' })]} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/pesticides/diseases-pests/test-slug')
  })

  it('カテゴリフィルタボタンが表示される', () => {
    render(<DiseasePestList diseasePests={[]} />)
    expect(screen.getByText('すべて')).toBeInTheDocument()
    expect(screen.getByText('病害')).toBeInTheDocument()
    expect(screen.getByText('害虫')).toBeInTheDocument()
    expect(screen.getByText('益虫')).toBeInTheDocument()
  })

  it('検索フォームを送信するとrouter.pushが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<DiseasePestList diseasePests={[]} />)

    const input = screen.getByPlaceholderText('病害虫名・色で検索...')
    await user.type(input, 'アブラムシ')
    await user.click(screen.getByRole('button', { name: '検索' }))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('search=%E3%82%A2%E3%83%96%E3%83%A9%E3%83%A0%E3%82%B7')
    )
  })

  it('カテゴリボタンをクリックするとrouter.pushが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<DiseasePestList diseasePests={[]} />)

    await user.click(screen.getByText('害虫'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('category=pest')
    )
  })

  it('「すべて」ボタンをクリックするとcategoryパラメータなしでナビゲートする', async () => {
    const user = userEvent.setup()
    render(<DiseasePestList diseasePests={[]} defaultCategory="pest" />)

    await user.click(screen.getByText('すべて'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/pesticides/diseases-pests?')
    )
  })

  it('defaultSearch で初期値が入力欄にセットされる', () => {
    render(<DiseasePestList diseasePests={[]} defaultSearch="カイガラムシ" />)
    const input = screen.getByPlaceholderText('病害虫名・色で検索...')
    expect(input).toHaveValue('カイガラムシ')
  })

  it('defaultBodySizeMm で体長入力欄に初期値がセットされる', () => {
    render(<DiseasePestList diseasePests={[]} defaultBodySizeMm="5" />)
    const input = screen.getByLabelText('体長（ミリメートル）で害虫を絞り込む')
    expect(input).toHaveValue(5)
  })

  it('体長フィールドに値を入力して検索するとbodySizeMmパラメータが含まれる', async () => {
    const user = userEvent.setup()
    render(<DiseasePestList diseasePests={[]} />)

    const input = screen.getByLabelText('体長（ミリメートル）で害虫を絞り込む')
    await user.type(input, '3')
    await user.click(screen.getByRole('button', { name: '検索' }))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('bodySizeMm=3')
    )
  })

  it('defaultCategory に応じてカテゴリボタンがハイライトされる', () => {
    render(<DiseasePestList diseasePests={[]} defaultCategory="pest" />)
    const pestButton = screen.getByText('害虫')
    expect(pestButton.className).toContain('bg-primary')
  })
})
