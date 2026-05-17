import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('lucide-react', () => ({
  ArrowUp: ({ className }: { className?: string }) => <span data-testid="arrow-up" className={className} />,
  ArrowDown: ({ className }: { className?: string }) => <span data-testid="arrow-down" className={className} />,
  Info: ({ className }: { className?: string }) => <span data-testid="info" className={className} />,
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="alert" className={className}>{children}</div>
  ),
  AlertDescription: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="alert-description" className={className}>{children}</div>
  ),
}))

vi.mock('@/components/hormone/HormoneCategoryBadge', () => ({
  HormoneCategoryBadge: ({ category }: { category: string }) => (
    <span data-testid={`category-badge-${category}`}>{category}</span>
  ),
}))

// ── HormoneCard ──────────────────────────────────────────────────

describe('HormoneCard', () => {
  it('ホルモン名・英名・説明を表示する', async () => {
    const { HormoneCard } = await import('@/components/hormone/HormoneCard')
    render(
      <HormoneCard
        hormone={{
          name: 'オーキシン',
          nameEn: 'Auxin',
          slug: 'auxin',
          category: 'major',
          description: '細胞伸長を促進するホルモン',
          _count: { effects: 3 },
        }}
      />
    )

    expect(screen.getByText('オーキシン')).toBeInTheDocument()
    expect(screen.getByText('Auxin')).toBeInTheDocument()
    expect(screen.getByText('細胞伸長を促進するホルモン')).toBeInTheDocument()
  })

  it('効果件数を表示する', async () => {
    const { HormoneCard } = await import('@/components/hormone/HormoneCard')
    render(
      <HormoneCard
        hormone={{
          name: 'オーキシン',
          nameEn: null,
          slug: 'auxin',
          category: 'major',
          description: null,
          _count: { effects: 5 },
        }}
      />
    )

    expect(screen.getByText('効果 5件')).toBeInTheDocument()
  })

  it('slugに基づくリンクを生成する', async () => {
    const { HormoneCard } = await import('@/components/hormone/HormoneCard')
    render(
      <HormoneCard
        hormone={{
          name: 'ジベレリン',
          nameEn: 'Gibberellin',
          slug: 'gibberellin',
          category: 'major',
          description: null,
        }}
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/hormones/gibberellin')
  })

  it('nameEnがnullの場合は英名を表示しない', async () => {
    const { HormoneCard } = await import('@/components/hormone/HormoneCard')
    render(
      <HormoneCard
        hormone={{
          name: 'オーキシン',
          nameEn: null,
          slug: 'auxin',
          category: 'major',
          description: null,
        }}
      />
    )

    expect(screen.queryByText('Auxin')).not.toBeInTheDocument()
  })
})

// ── HormoneCategoryBadge ──────────────────────────────────────────

describe('HormoneCategoryBadge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('majorカテゴリで五大ホルモンと表示する', async () => {
    // Use the real component (remove mock for this describe)
    vi.doUnmock('@/components/hormone/HormoneCategoryBadge')
    const { HormoneCategoryBadge } = await import('@/components/hormone/HormoneCategoryBadge')
    render(<HormoneCategoryBadge category="major" />)

    expect(screen.getByText('五大ホルモン')).toBeInTheDocument()
  })

  it('secondaryカテゴリで二次ホルモンと表示する', async () => {
    vi.doUnmock('@/components/hormone/HormoneCategoryBadge')
    const { HormoneCategoryBadge } = await import('@/components/hormone/HormoneCategoryBadge')
    render(<HormoneCategoryBadge category="secondary" />)

    expect(screen.getByText('二次ホルモン')).toBeInTheDocument()
  })
})

// ── HormoneEffectList ──────────────────────────────────────────────

describe('HormoneEffectList', () => {
  it('効果がない場合はメッセージを表示する', async () => {
    const { HormoneEffectList } = await import('@/components/hormone/HormoneEffectList')
    render(<HormoneEffectList effects={[]} />)

    expect(screen.getByText('効果情報はまだありません。')).toBeInTheDocument()
  })

  it('促進効果にはArrowUpアイコンを表示する', async () => {
    const { HormoneEffectList } = await import('@/components/hormone/HormoneEffectList')
    render(
      <HormoneEffectList
        effects={[{ effectName: '細胞伸長', description: '茎の伸長を促進', isPromoting: true }]}
      />
    )

    expect(screen.getByTestId('arrow-up')).toBeInTheDocument()
    expect(screen.getByText('細胞伸長')).toBeInTheDocument()
    expect(screen.getByText('茎の伸長を促進')).toBeInTheDocument()
  })

  it('抑制効果にはArrowDownアイコンを表示する', async () => {
    const { HormoneEffectList } = await import('@/components/hormone/HormoneEffectList')
    render(
      <HormoneEffectList
        effects={[{ effectName: '成長抑制', description: null, isPromoting: false }]}
      />
    )

    expect(screen.getByTestId('arrow-down')).toBeInTheDocument()
    expect(screen.getByText('成長抑制')).toBeInTheDocument()
  })

  it('複数の効果をリスト表示する', async () => {
    const { HormoneEffectList } = await import('@/components/hormone/HormoneEffectList')
    render(
      <HormoneEffectList
        effects={[
          { effectName: '細胞伸長', description: null, isPromoting: true },
          { effectName: '頂芽優勢', description: null, isPromoting: true },
          { effectName: '落葉促進', description: null, isPromoting: false },
        ]}
      />
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})

// ── HormoneInteractionCard ──────────────────────────────────────────

describe('HormoneInteractionCard', () => {
  it('ホルモン名と相互作用タイプを表示する', async () => {
    const { HormoneInteractionCard } = await import('@/components/hormone/HormoneInteractionCard')
    render(
      <HormoneInteractionCard
        hormoneAName="オーキシン"
        hormoneBName="サイトカイニン"
        type="antagonistic"
        description="互いに拮抗的に作用する"
        bonsaiRelevance={null}
      />
    )

    expect(screen.getByText('オーキシン')).toBeInTheDocument()
    expect(screen.getByText('サイトカイニン')).toBeInTheDocument()
    expect(screen.getByText('拮抗')).toBeInTheDocument()
    expect(screen.getByText('互いに拮抗的に作用する')).toBeInTheDocument()
  })

  it('盆栽関連情報を表示する', async () => {
    const { HormoneInteractionCard } = await import('@/components/hormone/HormoneInteractionCard')
    render(
      <HormoneInteractionCard
        hormoneAName="オーキシン"
        hormoneBName="ジベレリン"
        type="synergistic"
        description={null}
        bonsaiRelevance="枝の伸長に関与"
      />
    )

    expect(screen.getByText('相乗')).toBeInTheDocument()
    expect(screen.getByText('枝の伸長に関与')).toBeInTheDocument()
  })

  it('未知のtypeではtypeそのものをラベルとして表示する', async () => {
    const { HormoneInteractionCard } = await import('@/components/hormone/HormoneInteractionCard')
    render(
      <HormoneInteractionCard
        hormoneAName="A"
        hormoneBName="B"
        type="unknown_type"
        description={null}
        bonsaiRelevance={null}
      />
    )

    expect(screen.getByText('unknown_type')).toBeInTheDocument()
  })
})

// ── HormoneDisclaimer ──────────────────────────────────────────────

describe('HormoneDisclaimer', () => {
  it('免責事項テキストを表示する', async () => {
    const { HormoneDisclaimer } = await import('@/components/hormone/HormoneDisclaimer')
    render(<HormoneDisclaimer />)

    expect(screen.getByText(/植物ホルモン情報は植物生理学の一般的な知識に基づく教育目的の内容です/)).toBeInTheDocument()
  })

  it('Alert コンポーネントを使用する', async () => {
    const { HormoneDisclaimer } = await import('@/components/hormone/HormoneDisclaimer')
    render(<HormoneDisclaimer />)

    expect(screen.getByTestId('alert')).toBeInTheDocument()
    expect(screen.getByTestId('alert-description')).toBeInTheDocument()
  })
})

// ── HormoneSeasonalChart ──────────────────────────────────────────

describe('HormoneSeasonalChart', () => {
  it('12ヶ月分のラベルを表示する', async () => {
    const { HormoneSeasonalChart } = await import('@/components/hormone/HormoneSeasonalChart')
    render(<HormoneSeasonalChart seasonalLevels={[]} />)

    for (let m = 1; m <= 12; m++) {
      expect(screen.getByText(`${m}月`)).toBeInTheDocument()
    }
  })

  it('レベルデータに応じたバーを表示する', async () => {
    const { HormoneSeasonalChart } = await import('@/components/hormone/HormoneSeasonalChart')
    const { container } = render(
      <HormoneSeasonalChart
        seasonalLevels={[
          { month: 4, level: 'high', description: '春の活性期' },
          { month: 7, level: 'moderate', description: '夏の成長期' },
          { month: 12, level: 'low', description: '冬の休眠期' },
        ]}
      />
    )

    // high level bar has h-20 class
    const highBar = container.querySelector('.h-20.bg-green-500')
    expect(highBar).toBeInTheDocument()

    // moderate level bar has h-14 class
    const moderateBar = container.querySelector('.h-14.bg-yellow-500')
    expect(moderateBar).toBeInTheDocument()

    // low level bar has h-8 class
    const lowBar = container.querySelector('.h-8.bg-orange-400')
    expect(lowBar).toBeInTheDocument()
  })

  it('データのない月はminimalレベルで表示する', async () => {
    const { HormoneSeasonalChart } = await import('@/components/hormone/HormoneSeasonalChart')
    const { container } = render(
      <HormoneSeasonalChart
        seasonalLevels={[{ month: 1, level: 'high', description: null }]}
      />
    )

    // 11 months without data should render as minimal (h-3 bg-gray-400)
    const minimalBars = container.querySelectorAll('.h-3.bg-gray-400')
    expect(minimalBars).toHaveLength(11)
  })
})

// ── HormoneTechniqueCard ──────────────────────────────────────────

describe('HormoneTechniqueCard', () => {
  it('技法名と説明を表示する', async () => {
    const { HormoneTechniqueCard } = await import('@/components/hormone/HormoneTechniqueCard')
    render(
      <HormoneTechniqueCard
        techniqueName="摘芯（芽摘み）"
        techniqueNameEn="Pinching"
        description="頂芽を摘む技法"
        effects={[]}
      />
    )

    expect(screen.getByText('摘芯（芽摘み）')).toBeInTheDocument()
    expect(screen.getByText('Pinching')).toBeInTheDocument()
    expect(screen.getByText('頂芽を摘む技法')).toBeInTheDocument()
  })

  it('英名がnullの場合は英名を表示しない', async () => {
    const { HormoneTechniqueCard } = await import('@/components/hormone/HormoneTechniqueCard')
    render(
      <HormoneTechniqueCard
        techniqueName="剪定"
        techniqueNameEn={null}
        description="枝を切る"
        effects={[]}
      />
    )

    expect(screen.getByText('剪定')).toBeInTheDocument()
    expect(screen.queryByText('Pruning')).not.toBeInTheDocument()
  })

  it('効果がない場合はメッセージを表示する', async () => {
    const { HormoneTechniqueCard } = await import('@/components/hormone/HormoneTechniqueCard')
    render(
      <HormoneTechniqueCard
        techniqueName="剪定"
        techniqueNameEn={null}
        description="枝を切る"
        effects={[]}
      />
    )

    expect(screen.getByText('この技法のホルモン効果データはまだありません。')).toBeInTheDocument()
  })

  it('effectTypeバッジとmagnitudeを表示する', async () => {
    const { HormoneTechniqueCard } = await import('@/components/hormone/HormoneTechniqueCard')
    render(
      <HormoneTechniqueCard
        techniqueName="摘芯"
        techniqueNameEn={null}
        description="desc"
        effects={[
          { hormoneName: 'オーキシン', hormoneSlug: 'auxin', effectType: 'decrease', magnitude: 'strong', mechanism: 'メカニズム説明' },
        ]}
      />
    )

    expect(screen.getByText('オーキシン')).toBeInTheDocument()
    expect(screen.getByText('減少')).toBeInTheDocument()
    expect(screen.getByText('（影響度: 強）')).toBeInTheDocument()
    expect(screen.getByText('メカニズム説明')).toBeInTheDocument()
  })

  it('複数の効果を表示する', async () => {
    const { HormoneTechniqueCard } = await import('@/components/hormone/HormoneTechniqueCard')
    render(
      <HormoneTechniqueCard
        techniqueName="摘芯"
        techniqueNameEn={null}
        description="desc"
        effects={[
          { hormoneName: 'オーキシン', hormoneSlug: 'auxin', effectType: 'decrease', magnitude: 'strong', mechanism: null },
          { hormoneName: 'サイトカイニン', hormoneSlug: 'cytokinin', effectType: 'increase', magnitude: 'moderate', mechanism: null },
        ]}
      />
    )

    expect(screen.getByText('オーキシン')).toBeInTheDocument()
    expect(screen.getByText('サイトカイニン')).toBeInTheDocument()
    expect(screen.getByText('減少')).toBeInTheDocument()
    expect(screen.getByText('増加')).toBeInTheDocument()
  })

  it('再分配タイプのeffectTypeバッジを正しく表示する', async () => {
    const { HormoneTechniqueCard } = await import('@/components/hormone/HormoneTechniqueCard')
    render(
      <HormoneTechniqueCard
        techniqueName="日照管理"
        techniqueNameEn={null}
        description="desc"
        effects={[
          { hormoneName: 'オーキシン', hormoneSlug: 'auxin', effectType: 'redistribute', magnitude: 'strong', mechanism: null },
        ]}
      />
    )

    expect(screen.getByText('再分配')).toBeInTheDocument()
  })

  it('ホルモン名にリンクを生成する', async () => {
    const { HormoneTechniqueCard } = await import('@/components/hormone/HormoneTechniqueCard')
    render(
      <HormoneTechniqueCard
        techniqueName="摘芯"
        techniqueNameEn={null}
        description="desc"
        effects={[
          { hormoneName: 'オーキシン', hormoneSlug: 'auxin', effectType: 'decrease', magnitude: 'strong', mechanism: null },
        ]}
      />
    )

    const link = screen.getByRole('link', { name: 'オーキシン' })
    expect(link).toHaveAttribute('href', '/hormones/auxin')
  })
})

// ── HormoneAnnualCalendar ──────────────────────────────────────────

describe('HormoneAnnualCalendar', () => {
  const sampleHormones = [
    {
      name: 'オーキシン',
      slug: 'auxin',
      seasonalLevels: [
        { month: 1, level: 'minimal', description: '休眠中' },
        { month: 4, level: 'high', description: '成長ピーク' },
        { month: 7, level: 'moderate', description: '夏' },
        { month: 10, level: 'low', description: '休眠準備' },
      ],
    },
  ]

  it('ホルモン名を表示する', async () => {
    const { HormoneAnnualCalendar } = await import('@/components/hormone/HormoneAnnualCalendar')
    render(<HormoneAnnualCalendar hormones={sampleHormones} />)

    // Desktop table + mobile card both render, so multiple elements
    expect(screen.getAllByText('オーキシン').length).toBeGreaterThanOrEqual(1)
  })

  it('12ヶ月分のヘッダーを表示する', async () => {
    const { HormoneAnnualCalendar } = await import('@/components/hormone/HormoneAnnualCalendar')
    render(<HormoneAnnualCalendar hormones={sampleHormones} />)

    for (let m = 1; m <= 12; m++) {
      expect(screen.getAllByText(`${m}月`).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('凡例を表示する', async () => {
    const { HormoneAnnualCalendar } = await import('@/components/hormone/HormoneAnnualCalendar')
    render(<HormoneAnnualCalendar hormones={sampleHormones} />)

    expect(screen.getByText('凡例:')).toBeInTheDocument()
    expect(screen.getAllByText('高').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('中').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('低').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('微').length).toBeGreaterThanOrEqual(1)
  })

  it('空データの場合はメッセージを表示する', async () => {
    const { HormoneAnnualCalendar } = await import('@/components/hormone/HormoneAnnualCalendar')
    render(<HormoneAnnualCalendar hormones={[]} />)

    expect(screen.getByText('カレンダーデータがありません。')).toBeInTheDocument()
  })

  it('複数ホルモンを表示する', async () => {
    const { HormoneAnnualCalendar } = await import('@/components/hormone/HormoneAnnualCalendar')
    render(
      <HormoneAnnualCalendar
        hormones={[
          { name: 'オーキシン', slug: 'auxin', seasonalLevels: [{ month: 1, level: 'high', description: null }] },
          { name: 'ジベレリン', slug: 'gibberellin', seasonalLevels: [{ month: 1, level: 'low', description: null }] },
        ]}
      />
    )

    // Desktop + mobile both render each hormone name
    expect(screen.getAllByText('オーキシン').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ジベレリン').length).toBeGreaterThanOrEqual(1)
  })

  // ============================================================
  // onMonthClick がある場合の分岐 — cursor-pointer / tooltip / click
  // ============================================================
  it('onMonthClick あり: ツールチップが「クリックでシミュレーターへ」になりセルが click 可能', async () => {
    const { HormoneAnnualCalendar } = await import('@/components/hormone/HormoneAnnualCalendar')
    const onMonthClick = vi.fn()
    const { container } = render(
      <HormoneAnnualCalendar hormones={sampleHormones} onMonthClick={onMonthClick} />,
    )
    // 12 ヶ月 × 2 (table + mobile grid) = 24 のクリック対象が想定される。
    // tooltip text は ' クリックでシミュレーターへ '
    const tipNodes = container.querySelectorAll('[title="クリックでシミュレーターへ"]')
    expect(tipNodes.length).toBeGreaterThanOrEqual(12)
    // 1つだけ click する → onMonthClick(month) が呼ばれる
    ;(tipNodes[0] as HTMLElement).click()
    expect(onMonthClick).toHaveBeenCalledTimes(1)
    // 第一引数は month (1〜12)
    const arg = onMonthClick.mock.calls[0][0]
    expect(typeof arg).toBe('number')
    expect(arg).toBeGreaterThanOrEqual(1)
    expect(arg).toBeLessThanOrEqual(12)
  })

  it('onMonthClick なし: tooltip は entry.description (なければ空文字) で onClick は付かない', async () => {
    const { HormoneAnnualCalendar } = await import('@/components/hormone/HormoneAnnualCalendar')
    const { container } = render(
      <HormoneAnnualCalendar
        hormones={[
          {
            name: 'オーキシン',
            slug: 'auxin',
            seasonalLevels: [{ month: 1, level: 'high', description: '春の盛り' }],
          },
        ]}
      />,
    )
    // entry.description が存在する月セル
    const withTip = container.querySelector('[title="春の盛り"]')
    expect(withTip).not.toBeNull()
    // 「クリックでシミュレーターへ」は出ない
    expect(container.querySelector('[title="クリックでシミュレーターへ"]')).toBeNull()
    // entry が null の月セルでは tooltip は空文字（?? '' フォールバック）
    const emptyTip = container.querySelector('[title=""]')
    expect(emptyTip).not.toBeNull()
  })

  it('未知の level でも HORMONE_LEVEL_CONFIG.minimal にフォールバックする (?? 分岐)', async () => {
    const { HormoneAnnualCalendar } = await import('@/components/hormone/HormoneAnnualCalendar')
    const { container } = render(
      <HormoneAnnualCalendar
        hormones={[
          {
            name: 'X',
            slug: 'x',
            seasonalLevels: [
              { month: 1, level: 'totally-unknown-level-xyz', description: null },
            ],
          },
        ]}
      />,
    )
    // 描画は失敗せず、'微'(minimal label) が含まれる
    expect(container.querySelectorAll('span').length).toBeGreaterThan(0)
    expect(screen.getAllByText('微').length).toBeGreaterThanOrEqual(1)
  })
})

// ── HormoneInteractionDiagram ──────────────────────────────────────

describe('HormoneInteractionDiagram', () => {
  const sampleHormones = [
    { id: 'h1', name: 'オーキシン', slug: 'auxin', category: 'major' },
    { id: 'h2', name: 'サイトカイニン', slug: 'cytokinin', category: 'major' },
  ]

  const sampleInteractions = [
    { hormoneAId: 'h1', hormoneBId: 'h2', type: 'antagonistic', description: '拮抗関係' },
  ]

  it('SVG要素をレンダリングする', async () => {
    const { HormoneInteractionDiagram } = await import('@/components/hormone/HormoneInteractionDiagram')
    const { container } = render(
      <HormoneInteractionDiagram hormones={sampleHormones} interactions={sampleInteractions} />
    )

    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('ホルモン数に応じたノード（circle）を表示する', async () => {
    const { HormoneInteractionDiagram } = await import('@/components/hormone/HormoneInteractionDiagram')
    const { container } = render(
      <HormoneInteractionDiagram hormones={sampleHormones} interactions={sampleInteractions} />
    )

    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(2)
  })

  it('相互作用数に応じたエッジ（line）を表示する', async () => {
    const { HormoneInteractionDiagram } = await import('@/components/hormone/HormoneInteractionDiagram')
    const { container } = render(
      <HormoneInteractionDiagram hormones={sampleHormones} interactions={sampleInteractions} />
    )

    const lines = container.querySelectorAll('line')
    expect(lines).toHaveLength(1)
  })

  it('空データの場合はメッセージを表示する', async () => {
    const { HormoneInteractionDiagram } = await import('@/components/hormone/HormoneInteractionDiagram')
    render(<HormoneInteractionDiagram hormones={[]} interactions={[]} />)

    expect(screen.getByText('ダイアグラムデータがありません。')).toBeInTheDocument()
  })

  it('凡例を表示する', async () => {
    const { HormoneInteractionDiagram } = await import('@/components/hormone/HormoneInteractionDiagram')
    render(
      <HormoneInteractionDiagram hormones={sampleHormones} interactions={sampleInteractions} />
    )

    // Filter buttons + legend both render type labels
    expect(screen.getAllByText('相乗').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('拮抗').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('調節').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('五大ホルモン')).toBeInTheDocument()
    expect(screen.getByText('二次ホルモン')).toBeInTheDocument()
  })

  it('拮抗タイプのエッジに赤色を適用する', async () => {
    const { HormoneInteractionDiagram } = await import('@/components/hormone/HormoneInteractionDiagram')
    const { container } = render(
      <HormoneInteractionDiagram hormones={sampleHormones} interactions={sampleInteractions} />
    )

    const line = container.querySelector('line')
    expect(line).toHaveAttribute('stroke', '#ef4444')
  })
})

// ── HormoneBalanceSimulator ──────────────────────────────────────────

describe('HormoneBalanceSimulator', () => {
  const sampleHormones = [
    { id: 'h1', name: 'オーキシン', slug: 'auxin' },
    { id: 'h2', name: 'ジベレリン', slug: 'gibberellin' },
  ]

  const sampleTechniques = [
    { hormoneId: 'h1', techniqueSlug: 'pinching', effectType: 'decrease', magnitude: 'strong', hormone: { slug: 'auxin' } },
    { hormoneId: 'h2', techniqueSlug: 'pruning', effectType: 'increase', magnitude: 'mild', hormone: { slug: 'gibberellin' } },
  ]

  const sampleSeasonalLevels = [
    { hormoneId: 'h1', month: 4, level: 'high' },
    { hormoneId: 'h2', month: 4, level: 'moderate' },
  ]

  it('月セレクター12個を表示する', async () => {
    const { HormoneBalanceSimulator } = await import('@/components/hormone/HormoneBalanceSimulator')
    render(
      <HormoneBalanceSimulator
        hormones={sampleHormones}
        techniques={sampleTechniques}
        seasonalLevels={sampleSeasonalLevels}
      />
    )

    for (let m = 1; m <= 12; m++) {
      expect(screen.getByRole('button', { name: `${m}月` })).toBeInTheDocument()
    }
  })

  it('技法セレクターを9個表示する', async () => {
    const { HormoneBalanceSimulator } = await import('@/components/hormone/HormoneBalanceSimulator')
    render(
      <HormoneBalanceSimulator
        hormones={sampleHormones}
        techniques={sampleTechniques}
        seasonalLevels={sampleSeasonalLevels}
      />
    )

    expect(screen.getByRole('button', { name: '摘芯（芽摘み）' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '剪定' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '針金掛け' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '植替え' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '葉刈り' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取り木' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '挿し木' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '水やり管理' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '日照管理' })).toBeInTheDocument()
  })

  it('ホルモン名を表示する', async () => {
    const { HormoneBalanceSimulator } = await import('@/components/hormone/HormoneBalanceSimulator')
    render(
      <HormoneBalanceSimulator
        hormones={sampleHormones}
        techniques={sampleTechniques}
        seasonalLevels={sampleSeasonalLevels}
      />
    )

    expect(screen.getByText('オーキシン')).toBeInTheDocument()
    expect(screen.getByText('ジベレリン')).toBeInTheDocument()
  })

  it('注意書きを表示する', async () => {
    const { HormoneBalanceSimulator } = await import('@/components/hormone/HormoneBalanceSimulator')
    render(
      <HormoneBalanceSimulator
        hormones={sampleHormones}
        techniques={sampleTechniques}
        seasonalLevels={sampleSeasonalLevels}
      />
    )

    expect(screen.getByText(/シミュレーション結果は植物生理学の一般的な知見に基づく概算です/)).toBeInTheDocument()
  })
})
