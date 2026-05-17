import { render, screen } from '../../utils/test-utils'
import { PremiumBadge } from '@/components/subscription/PremiumBadge'

describe('PremiumBadge', () => {
  it('バッジを表示する', () => {
    const { container } = render(<PremiumBadge />)

    // Imageコンポーネントが存在する
    const img = container.querySelector('img')
    expect(img).toBeInTheDocument()
  })

  it('デフォルトサイズ（sm）で表示する', () => {
    const { container } = render(<PremiumBadge />)

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('width', '14')
    expect(img).toHaveAttribute('height', '14')
  })

  it('中サイズ（md）で表示する', () => {
    const { container } = render(<PremiumBadge size="md" />)

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('width', '16')
    expect(img).toHaveAttribute('height', '16')
  })

  it('大サイズ（lg）で表示する', () => {
    const { container } = render(<PremiumBadge size="lg" />)

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('width', '20')
    expect(img).toHaveAttribute('height', '20')
  })

  it('デフォルトでツールチップが有効', () => {
    const { container } = render(<PremiumBadge />)

    // TooltipTriggerがdata-slotで識別できる
    const trigger = container.querySelector('[data-slot="tooltip-trigger"]')
    expect(trigger).toBeInTheDocument()
  })

  it('ツールチップを無効にできる', () => {
    render(<PremiumBadge showTooltip={false} />)

    // ツールチップなしの場合、buttonロールがなくなる
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('プレミアムバッジ画像が使用されている', () => {
    const { container } = render(<PremiumBadge />)

    const img = container.querySelector('img')
    expect(img).toHaveAttribute('alt', 'プレミアム')
  })

  it('ライト/ダークモード用に2枚の画像がある', () => {
    const { container } = render(<PremiumBadge />)

    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)
  })
})
