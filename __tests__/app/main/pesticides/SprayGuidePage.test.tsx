/**
 * SprayGuidePage の rendering テスト
 *
 * このページは静的コンテンツのみだが、希釈倍率テーブルを内部関数で
 * 計算しており、コンテンツの正確性が農薬使用の安全性に直結する。
 * - calculatePesticideAmount: 整数 / 小数の出力フォーマット
 * - waterVolumeLabel: mL / L 単位の自動切替
 * - 希釈倍率と水量の組み合わせテーブルの整合性
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SprayGuidePage from '@/app/(main)/pesticides/spray-guide/page'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Droplets: () => <span data-testid="icon-droplets" />,
  Clock: () => <span data-testid="icon-clock" />,
  Crosshair: () => <span data-testid="icon-crosshair" />,
  Shield: () => <span data-testid="icon-shield" />,
  TreePine: () => <span data-testid="icon-tree-pine" />,
}))

vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="pesticide-disclaimer" />,
}))

describe('SprayGuidePage', () => {
  it('h1 タイトル「散布方法ガイド」が描画される', () => {
    render(<SprayGuidePage />)
    expect(screen.getByRole('heading', { level: 1, name: '散布方法ガイド' })).toBeInTheDocument()
  })

  it('戻るリンク（/pesticides）が表示される', () => {
    render(<SprayGuidePage />)
    expect(screen.getByRole('link', { name: /農薬・病害虫トップへ/ })).toHaveAttribute(
      'href',
      '/pesticides',
    )
  })

  it('5 つのセクションカードを描画する（希釈・タイミング・対象・安全・盆栽特有）', () => {
    render(<SprayGuidePage />)
    expect(screen.getByText('希釈の基本')).toBeInTheDocument()
    expect(screen.getByText('散布のタイミング')).toBeInTheDocument()
    expect(screen.getByText('散布方法のポイント')).toBeInTheDocument()
    expect(screen.getByText('安全対策')).toBeInTheDocument()
    expect(screen.getByText('盆栽特有の注意点')).toBeInTheDocument()
  })

  it('希釈テーブルに 4 つの倍率（500/1000/1500/2000）が表示される', () => {
    render(<SprayGuidePage />)
    expect(screen.getByText('500倍')).toBeInTheDocument()
    expect(screen.getByText('1000倍')).toBeInTheDocument()
    expect(screen.getByText('1500倍')).toBeInTheDocument()
    expect(screen.getByText('2000倍')).toBeInTheDocument()
  })

  it('水量ラベルは 1000mL 以上で L 単位（水1L, 水2L, 水5L）になる', () => {
    render(<SprayGuidePage />)
    expect(screen.getByText('水1L')).toBeInTheDocument()
    expect(screen.getByText('水2L')).toBeInTheDocument()
    expect(screen.getByText('水5L')).toBeInTheDocument()
  })

  it('1000mL 未満は mL 単位（水500mL）で表示される', () => {
    render(<SprayGuidePage />)
    expect(screen.getByText('水500mL')).toBeInTheDocument()
  })

  it('希釈計算が整数値の場合は小数点なしで表示される（例: 水1L × 500倍 = 2mL）', () => {
    render(<SprayGuidePage />)
    // 水1000mL ÷ 500 = 2mL（整数）
    // 全テーブルから「2mL」が見つかれば OK
    expect(screen.getAllByText('2mL').length).toBeGreaterThan(0)
  })

  it('希釈計算が小数の場合は 2 桁固定（例: 水500mL × 1500倍 = 0.33mL）', () => {
    render(<SprayGuidePage />)
    // 水500mL ÷ 1500 = 0.333... → 0.33mL
    expect(screen.getAllByText('0.33mL').length).toBeGreaterThan(0)
  })

  it('PesticideDisclaimer が含まれる', () => {
    render(<SprayGuidePage />)
    expect(screen.getByTestId('pesticide-disclaimer')).toBeInTheDocument()
  })

  it('安全対策の必須装備（マスク・手袋・ゴーグル）が記載される', () => {
    render(<SprayGuidePage />)
    expect(screen.getByText(/マスク/)).toBeInTheDocument()
    expect(screen.getByText(/手袋/)).toBeInTheDocument()
    expect(screen.getByText(/ゴーグル/)).toBeInTheDocument()
  })

  it('metadata.title が「散布方法ガイド」を含む', async () => {
    const mod = await import('@/app/(main)/pesticides/spray-guide/page')
    expect(mod.metadata.title).toContain('散布方法ガイド')
  })
})
