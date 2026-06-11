/**
 * 静的・準静的なガイドページ群（0% カバレッジだったもの）の rendering テスト
 *
 * 対象:
 *  - /pesticides/dilution-calculator (希釈計算ツールページ - クライアントコンポーネントのラッパー)
 *  - /pesticides/mixing-checker (混用チェッカー - 複数の Server Action 結果をマップする)
 *  - /fertilizers/watering (水やりと施肥 - 静的セクションを 4 ブロック描画)
 *  - /fertilizers/products (定番肥料ガイド - getFertilizerColumns の結果を描画)
 *  - /fertilizers/troubles (施肥トラブル事例集 - 上に同じ + 公開日表示の分岐)
 *  - /hormones/interactions (ホルモン相互作用 - getHormoneInteractions の結果)
 *
 * 共通モック設計:
 *  - 内部の重い子コンポーネントは data-testid プレースホルダで置換し、
 *    page 自身の Mapping / 条件分岐 / metadata に集中する。
 *  - Server Action 系は vi.mock で固定値を返す。
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// --- 共通モック ---
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  ChevronLeft: () => <span data-testid="icon-chevron-left" />,
  AlertTriangle: () => <span data-testid="icon-alert-triangle" />,
}))

vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="pesticide-disclaimer" />,
}))

vi.mock('@/components/fertilizer/FertilizerDisclaimer', () => ({
  FertilizerDisclaimer: () => <div data-testid="fertilizer-disclaimer" />,
}))

vi.mock('@/components/hormone/HormoneDisclaimer', () => ({
  HormoneDisclaimer: () => <div data-testid="hormone-disclaimer" />,
}))

vi.mock('@/components/pesticide/DilutionCalculator', () => ({
  DilutionCalculator: () => <div data-testid="dilution-calculator" />,
}))

vi.mock('@/components/pesticide/MixingChecker', () => ({
  MixingChecker: ({ pesticides, incompatibilities }: { pesticides: unknown[]; incompatibilities: unknown[] }) => (
    <div data-testid="mixing-checker">
      <span data-testid="mc-pesticide-count">{pesticides.length}</span>
      <span data-testid="mc-incomp-count">{incompatibilities.length}</span>
    </div>
  ),
}))

vi.mock('@/components/hormone/HormoneInteractionCard', () => ({
  HormoneInteractionCard: ({ hormoneAName, hormoneBName, type }: { hormoneAName: string; hormoneBName: string; type: string }) => (
    <div data-testid="interaction-card" data-type={type}>
      {hormoneAName} ↔ {hormoneBName}
    </div>
  ),
}))

// Server Action モック
const mockGetPesticideOptions = vi.fn()
const mockGetPesticideIncompatibilities = vi.fn()
vi.mock('@/lib/actions/pesticide', () => ({
  getPesticideOptions: () => mockGetPesticideOptions(),
  getPesticideIncompatibilities: () => mockGetPesticideIncompatibilities(),
}))

const mockGetFertilizerColumns = vi.fn()
vi.mock('@/lib/actions/fertilizer', () => ({
  getFertilizerColumns: (...args: unknown[]) => mockGetFertilizerColumns(...args),
}))

const mockGetHormoneInteractions = vi.fn()
vi.mock('@/lib/actions/hormone', () => ({
  getHormoneInteractions: () => mockGetHormoneInteractions(),
}))

// ============================================================
// /pesticides/dilution-calculator
// ============================================================

describe('DilutionCalculatorPage', () => {
  it('h1「希釈計算ツール」と DilutionCalculator・PesticideDisclaimer を含む', async () => {
    const { default: Page } = await import('@/app/(main)/pesticides/dilution-calculator/page')
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: '希釈計算ツール' })).toBeInTheDocument()
    expect(screen.getByTestId('dilution-calculator')).toBeInTheDocument()
    expect(screen.getByTestId('pesticide-disclaimer')).toBeInTheDocument()
  })

  it('戻るリンクが /pesticides を指す', async () => {
    const { default: Page } = await import('@/app/(main)/pesticides/dilution-calculator/page')
    render(<Page />)
    expect(screen.getByRole('link', { name: /農薬・病害虫トップへ/ })).toHaveAttribute(
      'href',
      '/pesticides',
    )
  })

  it('metadata.title が「希釈計算ツール」を含む', async () => {
    const mod = await import('@/app/(main)/pesticides/dilution-calculator/page')
    expect(mod.metadata.title).toContain('希釈計算ツール')
  })
})

// ============================================================
// /pesticides/mixing-checker
// ============================================================

describe('MixingCheckerPage', () => {
  it('Server Action の結果を MixingChecker props に整形して渡す', async () => {
    mockGetPesticideOptions.mockResolvedValueOnce({
      pesticides: [
        { id: 'p1', name: 'A', slug: 'a', pesticideType: 'fungicide', extraField: 'x' },
        { id: 'p2', name: 'B', slug: 'b', pesticideType: 'insecticide', extraField: 'y' },
      ],
    })
    mockGetPesticideIncompatibilities.mockResolvedValueOnce({
      incompatibilities: [
        { pesticideId: 'p1', incompatibleWithId: 'p2', otherField: 'z' },
      ],
    })

    const { default: Page } = await import('@/app/(main)/pesticides/mixing-checker/page')
    render(await Page())
    expect(screen.getByTestId('mixing-checker')).toBeInTheDocument()
    expect(screen.getByTestId('mc-pesticide-count')).toHaveTextContent('2')
    expect(screen.getByTestId('mc-incomp-count')).toHaveTextContent('1')
  })

  it('h1「混用チェッカー」と PesticideDisclaimer を含む', async () => {
    mockGetPesticideOptions.mockResolvedValueOnce({ pesticides: [] })
    mockGetPesticideIncompatibilities.mockResolvedValueOnce({ incompatibilities: [] })
    const { default: Page } = await import('@/app/(main)/pesticides/mixing-checker/page')
    render(await Page())
    expect(screen.getByRole('heading', { level: 1, name: '混用チェッカー' })).toBeInTheDocument()
    expect(screen.getByTestId('pesticide-disclaimer')).toBeInTheDocument()
  })

  it('metadata.title が「混用チェッカー」を含む', async () => {
    const mod = await import('@/app/(main)/pesticides/mixing-checker/page')
    expect(mod.metadata.title).toContain('混用チェッカー')
  })
})

// ============================================================
// /fertilizers/watering
// ============================================================

describe('WateringFertilizerPage', () => {
  it('4 つの h2 セクション（液肥/置き肥/季節別/失敗）を描画する', async () => {
    const { default: Page } = await import('@/app/(main)/fertilizers/watering/page')
    render(<Page />)
    expect(screen.getByRole('heading', { level: 2, name: '液肥の希釈と使い方' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '置き肥と灌水の関係' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '季節別の水やりと施肥の調整' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'よくある失敗' })).toBeInTheDocument()
  })

  it('h1「水やりと施肥の関係」と FertilizerDisclaimer を含む', async () => {
    const { default: Page } = await import('@/app/(main)/fertilizers/watering/page')
    render(<Page />)
    expect(screen.getByRole('heading', { level: 1, name: '水やりと施肥の関係' })).toBeInTheDocument()
    expect(screen.getByTestId('fertilizer-disclaimer')).toBeInTheDocument()
  })

  it('施肥ガイドトップへの戻るリンクがある', async () => {
    const { default: Page } = await import('@/app/(main)/fertilizers/watering/page')
    render(<Page />)
    expect(screen.getByRole('link', { name: /施肥ガイドトップ/ })).toHaveAttribute(
      'href',
      '/fertilizers',
    )
  })
})

// ============================================================
// /fertilizers/products
// ============================================================

describe('FertilizerProductsPage', () => {
  it('カラムが 1 件以上ある場合は記事カードを描画する', async () => {
    mockGetFertilizerColumns.mockResolvedValueOnce({
      columns: [
        { id: 'c1', slug: 'c-1', title: 'マグァンプ K の使い方', content: '緩効性の固形肥料です。' },
        { id: 'c2', slug: 'c-2', title: 'ハイポネックス原液', content: '液肥の代表格。' },
      ],
    })
    const { default: Page } = await import('@/app/(main)/fertilizers/products/page')
    render(await Page())
    expect(screen.getByText('マグァンプ K の使い方')).toBeInTheDocument()
    expect(screen.getByText('ハイポネックス原液')).toBeInTheDocument()
  })

  it('カラムが空のときは空メッセージを描画する', async () => {
    mockGetFertilizerColumns.mockResolvedValueOnce({ columns: [] })
    const { default: Page } = await import('@/app/(main)/fertilizers/products/page')
    render(await Page())
    expect(screen.getByText(/製品ガイドはまだ公開されていません/)).toBeInTheDocument()
  })

  it('getFertilizerColumns に category=product_guide が渡される', async () => {
    mockGetFertilizerColumns.mockResolvedValueOnce({ columns: [] })
    const { default: Page } = await import('@/app/(main)/fertilizers/products/page')
    await Page()
    expect(mockGetFertilizerColumns).toHaveBeenCalledWith({ category: 'product_guide' })
  })
})

// ============================================================
// /fertilizers/troubles
// ============================================================

describe('TroublesPage', () => {
  it('カラムがあると記事リンクと公開日が表示される', async () => {
    mockGetFertilizerColumns.mockResolvedValueOnce({
      columns: [
        { id: 't1', slug: 't-1', title: '肥料焼けの原因と対処', category: 'trouble', publishedAt: new Date('2026-04-01') },
      ],
    })
    const { default: Page } = await import('@/app/(main)/fertilizers/troubles/page')
    render(await Page())
    const link = screen.getByRole('link', { name: /肥料焼けの原因と対処/ })
    expect(link).toHaveAttribute('href', '/fertilizers/columns/t-1')
    // 日付（ja-JP の slash 形式 例: 2026/4/1）
    expect(screen.getByText(/2026/)).toBeInTheDocument()
  })

  it('publishedAt が null のカラムでは日付を出さない', async () => {
    mockGetFertilizerColumns.mockResolvedValueOnce({
      columns: [
        { id: 't2', slug: 't-2', title: 'タイトルのみ', category: 'trouble', publishedAt: null },
      ],
    })
    const { default: Page } = await import('@/app/(main)/fertilizers/troubles/page')
    render(await Page())
    expect(screen.getByText('タイトルのみ')).toBeInTheDocument()
    // 日付（4桁数字）が画面に存在しないこと
    expect(screen.queryByText(/\d{4}/)).toBeNull()
  })

  it('カラムが空なら空メッセージを描画する', async () => {
    mockGetFertilizerColumns.mockResolvedValueOnce({ columns: [] })
    const { default: Page } = await import('@/app/(main)/fertilizers/troubles/page')
    render(await Page())
    expect(screen.getByText(/トラブル事例はまだ公開されていません/)).toBeInTheDocument()
  })

  it('getFertilizerColumns に category=trouble が渡される', async () => {
    mockGetFertilizerColumns.mockResolvedValueOnce({ columns: [] })
    const { default: Page } = await import('@/app/(main)/fertilizers/troubles/page')
    await Page()
    expect(mockGetFertilizerColumns).toHaveBeenCalledWith({ category: 'trouble' })
  })
})

// ============================================================
// /hormones/interactions
// ============================================================

describe('HormoneInteractionsPage', () => {
  it('相互作用が 0 件なら「データはまだありません」を表示', async () => {
    mockGetHormoneInteractions.mockResolvedValueOnce({ interactions: [] })
    const { default: Page } = await import('@/app/(main)/hormones/interactions/page')
    render(await Page())
    expect(screen.getByText(/相互作用のデータはまだありません/)).toBeInTheDocument()
  })

  it('相互作用ごとに HormoneInteractionCard を描画', async () => {
    mockGetHormoneInteractions.mockResolvedValueOnce({
      interactions: [
        {
          id: 'i1',
          type: 'synergistic',
          description: '相乗効果',
          bonsaiRelevance: '剪定に応用',
          hormoneA: { name: 'オーキシン' },
          hormoneB: { name: 'ジベレリン' },
        },
        {
          id: 'i2',
          type: 'antagonistic',
          description: '拮抗',
          bonsaiRelevance: null,
          hormoneA: { name: 'サイトカイニン' },
          hormoneB: { name: 'アブシジン酸' },
        },
      ],
    })
    const { default: Page } = await import('@/app/(main)/hormones/interactions/page')
    render(await Page())
    const cards = screen.getAllByTestId('interaction-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.dataset.type).toBe('synergistic')
    expect(cards[1]?.dataset.type).toBe('antagonistic')
  })

  it('ダイアグラムページへの導線リンクがある', async () => {
    mockGetHormoneInteractions.mockResolvedValueOnce({ interactions: [] })
    const { default: Page } = await import('@/app/(main)/hormones/interactions/page')
    render(await Page())
    expect(screen.getByRole('link', { name: /ネットワーク図で見る/ })).toHaveAttribute(
      'href',
      '/hormones/diagram',
    )
  })

  it('h1「ホルモン相互作用」と HormoneDisclaimer を含む', async () => {
    mockGetHormoneInteractions.mockResolvedValueOnce({ interactions: [] })
    const { default: Page } = await import('@/app/(main)/hormones/interactions/page')
    render(await Page())
    expect(screen.getByRole('heading', { level: 1, name: 'ホルモン相互作用' })).toBeInTheDocument()
    expect(screen.getByTestId('hormone-disclaimer')).toBeInTheDocument()
  })

  it('force-dynamic が宣言されている（(main) レイアウト/PremiumProvider が auth() を使うため静的化不可）', async () => {
    const mod = await import('@/app/(main)/hormones/interactions/page')
    expect(mod.dynamic).toBe('force-dynamic')
    expect((mod as Record<string, unknown>).revalidate).toBeUndefined()
  })
})
