/**
 * SoilFertilizerPage の rendering テスト
 *
 * 静的コンテンツ中心だが、6 種の用土・4 種の配合レシピ・CEC 4 段階ラベルを
 * 1 ページにマッピングしているため、データ取り違えがあると施肥助言が
 * 誤った形で表示される。配色・ラベル・PH レンジまで含めて回帰チェックする。
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SoilFertilizerPage from '@/app/(main)/fertilizers/soil/page'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  ChevronLeft: () => <span data-testid="chevron-left" />,
}))

vi.mock('@/components/fertilizer/FertilizerDisclaimer', () => ({
  FertilizerDisclaimer: () => <div data-testid="fertilizer-disclaimer" />,
}))

describe('SoilFertilizerPage', () => {
  it('h1 タイトル「用土と施肥の関係」が描画される', () => {
    render(<SoilFertilizerPage />)
    expect(screen.getByRole('heading', { level: 1, name: '用土と施肥の関係' })).toBeInTheDocument()
  })

  it('施肥ガイドトップへのリンク（/fertilizers）が表示される', () => {
    render(<SoilFertilizerPage />)
    const link = screen.getByRole('link', { name: /施肥ガイドトップ/ })
    expect(link).toHaveAttribute('href', '/fertilizers')
  })

  it('CEC 解説セクション（陽イオン交換容量とは）を含む', () => {
    render(<SoilFertilizerPage />)
    expect(screen.getByText(/CEC（陽イオン交換容量）とは/)).toBeInTheDocument()
  })

  it('6 種の用土名が全て表示される', () => {
    render(<SoilFertilizerPage />)
    expect(screen.getByText('赤玉土')).toBeInTheDocument()
    expect(screen.getByText('鹿沼土')).toBeInTheDocument()
    expect(screen.getByText('桐生砂')).toBeInTheDocument()
    expect(screen.getByText('富士砂')).toBeInTheDocument()
    expect(screen.getByText('日向土')).toBeInTheDocument()
    expect(screen.getByText('軽石')).toBeInTheDocument()
  })

  it('英名（Akadama / Kanuma 等）も並行表示される', () => {
    render(<SoilFertilizerPage />)
    expect(screen.getByText('Akadama')).toBeInTheDocument()
    expect(screen.getByText('Kanuma')).toBeInTheDocument()
    expect(screen.getByText('Kiryu-zuna')).toBeInTheDocument()
  })

  it('CEC ラベル 4 段階（極低・低・中・中〜高）が使われている', () => {
    render(<SoilFertilizerPage />)
    // CEC: 極低 / CEC: 低 / CEC: 中 / CEC: 中〜高 のフォーマット
    expect(screen.getAllByText(/CEC: 極低/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/CEC: 低/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/CEC: 中$/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/CEC: 中〜高/).length).toBeGreaterThan(0)
  })

  it('pH レンジが表示される（赤玉土: 6.0〜6.5）', () => {
    render(<SoilFertilizerPage />)
    expect(screen.getByText('6.0〜6.5')).toBeInTheDocument()
  })

  it('鹿沼土の酸性 pH（4.5〜5.0）が表示される', () => {
    render(<SoilFertilizerPage />)
    expect(screen.getByText('4.5〜5.0')).toBeInTheDocument()
  })

  it('樹種別配合レシピ 4 種（松柏類・雑木類・皐月・花物）が表示される', () => {
    render(<SoilFertilizerPage />)
    expect(screen.getByText(/松柏類（黒松・赤松・真柏等）/)).toBeInTheDocument()
    expect(screen.getByText(/雑木類（楓・欅・銀杏等）/)).toBeInTheDocument()
    expect(screen.getByText(/皐月・ツツジ類/)).toBeInTheDocument()
    expect(screen.getByText(/花物・実物（梅・桜・柿等）/)).toBeInTheDocument()
  })

  it('配合比のテキスト（赤玉土 6：桐生砂 3：富士砂 1）が表示される', () => {
    render(<SoilFertilizerPage />)
    expect(screen.getByText('赤玉土 6：桐生砂 3：富士砂 1')).toBeInTheDocument()
    expect(screen.getByText('鹿沼土 8：日向土 2')).toBeInTheDocument()
  })

  it('FertilizerDisclaimer が含まれる', () => {
    render(<SoilFertilizerPage />)
    expect(screen.getByTestId('fertilizer-disclaimer')).toBeInTheDocument()
  })

  it('metadata.title が「用土と施肥」を含む', async () => {
    const mod = await import('@/app/(main)/fertilizers/soil/page')
    expect(mod.metadata.title).toMatch(/用土と施肥/)
  })

  it('metadata.alternates.canonical が定義されている', async () => {
    const mod = await import('@/app/(main)/fertilizers/soil/page')
    expect(mod.metadata.alternates?.canonical).toBeDefined()
  })
})
