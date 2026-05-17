import { render, screen } from '../../utils/test-utils'
import { PremiumUpgradeCard } from '@/components/subscription/PremiumUpgradeCard'

describe('PremiumUpgradeCard', () => {
  it('デフォルトタイトルを表示する', () => {
    render(<PremiumUpgradeCard />)

    expect(screen.getByText('プレミアム会員限定機能')).toBeInTheDocument()
  })

  it('デフォルト説明文を表示する', () => {
    render(<PremiumUpgradeCard />)

    expect(screen.getByText('この機能を利用するにはプレミアム会員への登録が必要です。')).toBeInTheDocument()
  })

  it('カスタムタイトルを表示する', () => {
    render(<PremiumUpgradeCard title="この機能はプレミアム限定です" />)

    expect(screen.getByText('この機能はプレミアム限定です')).toBeInTheDocument()
  })

  it('カスタム説明文を表示する', () => {
    render(<PremiumUpgradeCard description="今すぐアップグレードしましょう" />)

    expect(screen.getByText('今すぐアップグレードしましょう')).toBeInTheDocument()
  })

  it('プレミアム機能リストを表示する', () => {
    render(<PremiumUpgradeCard />)

    expect(screen.getByText('投稿文字数 2000文字')).toBeInTheDocument()
    expect(screen.getByText('画像添付 6枚まで')).toBeInTheDocument()
    expect(screen.getByText('動画添付 3本まで')).toBeInTheDocument()
    expect(screen.getByText('予約投稿機能')).toBeInTheDocument()
    expect(screen.getByText('投稿分析ダッシュボード')).toBeInTheDocument()
  })

  it('機能リストを非表示にできる', () => {
    render(<PremiumUpgradeCard showFeatures={false} />)

    expect(screen.queryByText('投稿文字数 2000文字')).not.toBeInTheDocument()
    expect(screen.queryByText('画像添付 6枚まで')).not.toBeInTheDocument()
  })

  it('月額料金を表示する', () => {
    render(<PremiumUpgradeCard />)

    expect(screen.getByText('¥500')).toBeInTheDocument()
    expect(screen.getByText('/月')).toBeInTheDocument()
  })

  it('登録ボタンを表示する', () => {
    render(<PremiumUpgradeCard />)

    expect(screen.getByRole('link', { name: 'プレミアムに登録する' })).toBeInTheDocument()
  })

  it('登録ボタンが正しいhrefを持つ', () => {
    render(<PremiumUpgradeCard />)

    expect(screen.getByRole('link', { name: 'プレミアムに登録する' })).toHaveAttribute(
      'href',
      '/settings/subscription'
    )
  })

  it('王冠アイコンを表示する', () => {
    const { container } = render(<PremiumUpgradeCard />)

    // ヘッダーの大きな王冠アイコン
    const headerIcon = container.querySelector('.w-8.h-8')
    expect(headerIcon).toBeInTheDocument()
  })

  it('チェックマークアイコンを表示する（機能リスト）', () => {
    const { container } = render(<PremiumUpgradeCard />)

    // 5つの機能に対応するチェックマーク
    const checkIcons = container.querySelectorAll('.w-4.h-4.text-primary')
    expect(checkIcons.length).toBeGreaterThanOrEqual(5)
  })

  it('グラデーション背景が適用される', () => {
    const { container } = render(<PremiumUpgradeCard />)

    const card = container.querySelector('.bg-gradient-to-br')
    expect(card).toBeInTheDocument()
  })
})
