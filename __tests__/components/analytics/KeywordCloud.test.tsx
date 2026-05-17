import { render, screen } from '../../utils/test-utils'
import { KeywordCloud } from '@/components/analytics/KeywordCloud'

describe('KeywordCloud', () => {
  const mockKeywords = [
    { word: '盆栽', count: 50 },
    { word: '松', count: 30 },
    { word: '剪定', count: 15 },
    { word: '植え替え', count: 5 },
    { word: '水やり', count: 1 },
  ]

  it('キーワードを表示する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    expect(screen.getByText('盆栽')).toBeInTheDocument()
    expect(screen.getByText('松')).toBeInTheDocument()
    expect(screen.getByText('剪定')).toBeInTheDocument()
    expect(screen.getByText('植え替え')).toBeInTheDocument()
    expect(screen.getByText('水やり')).toBeInTheDocument()
  })

  it('キーワードがない場合は空メッセージを表示する', () => {
    render(<KeywordCloud keywords={[]} />)

    expect(screen.getByText('キーワードがありません')).toBeInTheDocument()
  })

  it('キーワードにtitle属性を設定する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const bonsaiElement = screen.getByText('盆栽')
    expect(bonsaiElement).toHaveAttribute('title', '盆栽: 50回')
  })

  it('出現回数が多いキーワードに大きいフォントサイズを適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const bonsaiElement = screen.getByText('盆栽')
    expect(bonsaiElement).toHaveClass('text-xl', 'font-bold')
  })

  it('出現回数が少ないキーワードに小さいフォントサイズを適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const waterElement = screen.getByText('水やり')
    expect(waterElement).toHaveClass('text-xs')
  })

  it('中間の出現回数のキーワードに中間サイズを適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    // 松: count=30, ratio = (30-1)/(50-1) ≈ 0.59 → text-base font-medium
    const matsElement = screen.getByText('松')
    expect(matsElement).toHaveClass('text-base', 'font-medium')
  })

  it('出現回数が多いキーワードに高い不透明度を適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const bonsaiElement = screen.getByText('盆栽')
    expect(bonsaiElement).toHaveClass('opacity-100')
  })

  it('出現回数が少ないキーワードに低い不透明度を適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const waterElement = screen.getByText('水やり')
    expect(waterElement).toHaveClass('opacity-60')
  })

  it('全てのキーワードが同じ回数の場合デフォルトスタイルを適用する', () => {
    const sameCountKeywords = [
      { word: 'キーワードA', count: 10 },
      { word: 'キーワードB', count: 10 },
      { word: 'キーワードC', count: 10 },
    ]
    render(<KeywordCloud keywords={sameCountKeywords} />)

    const keywordA = screen.getByText('キーワードA')
    expect(keywordA).toHaveClass('text-base')
    expect(keywordA).toHaveClass('opacity-100')
  })

  it('キーワードにカーソルデフォルトスタイルを適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const bonsaiElement = screen.getByText('盆栽')
    expect(bonsaiElement).toHaveClass('cursor-default')
  })

  it('キーワードにホバースタイルを適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const bonsaiElement = screen.getByText('盆栽')
    expect(bonsaiElement).toHaveClass('hover:bg-primary/20')
  })

  it('キーワードにトランジションスタイルを適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const bonsaiElement = screen.getByText('盆栽')
    expect(bonsaiElement).toHaveClass('transition-colors')
  })

  it('キーワードに背景色を適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const bonsaiElement = screen.getByText('盆栽')
    expect(bonsaiElement).toHaveClass('bg-primary/10')
  })

  it('キーワードにテキスト色を適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const bonsaiElement = screen.getByText('盆栽')
    expect(bonsaiElement).toHaveClass('text-primary')
  })

  it('キーワードに丸みを適用する', () => {
    render(<KeywordCloud keywords={mockKeywords} />)

    const bonsaiElement = screen.getByText('盆栽')
    expect(bonsaiElement).toHaveClass('rounded')
  })

  it('コンテナにフレックスボックスレイアウトを適用する', () => {
    const { container } = render(<KeywordCloud keywords={mockKeywords} />)

    expect(container.firstChild).toHaveClass('flex', 'flex-wrap', 'justify-center')
  })

  it('キーワード間にgapを適用する', () => {
    const { container } = render(<KeywordCloud keywords={mockKeywords} />)

    expect(container.firstChild).toHaveClass('gap-2')
  })

  it('単一のキーワードを表示する', () => {
    const singleKeyword = [{ word: '単一', count: 1 }]
    render(<KeywordCloud keywords={singleKeyword} />)

    expect(screen.getByText('単一')).toBeInTheDocument()
    // 単一キーワードの場合はデフォルトスタイル
    expect(screen.getByText('単一')).toHaveClass('text-base', 'opacity-100')
  })

  it('出現回数0.2～0.4範囲のキーワードにtext-smを適用する', () => {
    const keywords = [
      { word: 'max', count: 100 },
      { word: 'low', count: 25 }, // ratio = 0.25
      { word: 'min', count: 0 },
    ]
    render(<KeywordCloud keywords={keywords} />)

    expect(screen.getByText('low')).toHaveClass('text-sm')
  })

  it('出現回数0.4～0.6範囲のキーワードにtext-base font-mediumを適用する', () => {
    const keywords = [
      { word: 'max', count: 100 },
      { word: 'mid', count: 50 }, // ratio = 0.5
      { word: 'min', count: 0 },
    ]
    render(<KeywordCloud keywords={keywords} />)

    expect(screen.getByText('mid')).toHaveClass('text-base', 'font-medium')
  })

  it('出現回数0.6～0.8範囲のキーワードにtext-lg font-semiboldを適用する', () => {
    const keywords = [
      { word: 'max', count: 100 },
      { word: 'high', count: 70 }, // ratio = 0.7
      { word: 'min', count: 0 },
    ]
    render(<KeywordCloud keywords={keywords} />)

    expect(screen.getByText('high')).toHaveClass('text-lg', 'font-semibold')
  })

  it('出現回数0.3～0.6範囲のキーワードにopacity-80を適用する', () => {
    const keywords = [
      { word: 'max', count: 100 },
      { word: 'mid', count: 40 }, // ratio = 0.4
      { word: 'min', count: 0 },
    ]
    render(<KeywordCloud keywords={keywords} />)

    expect(screen.getByText('mid')).toHaveClass('opacity-80')
  })
})
