import { render, screen } from '@testing-library/react'
import { FertilizationCalendar } from '@/components/fertilizer/FertilizationCalendar'
import type { FertilizerAction, NutrientLevel } from '@prisma/client'

function createMockPlans() {
  const actions: FertilizerAction[] = [
    'none', 'light', 'moderate', 'heavy',
    'moderate', 'heavy', 'light', 'none',
    'moderate', 'heavy', 'light', 'none',
  ] as FertilizerAction[]

  return Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    action: actions[i]!,
    nitrogenLevel: (i % 2 === 0 ? 'high' : 'low') as NutrientLevel | null,
    phosphorusLevel: (i % 3 === 0 ? 'balanced' : null) as NutrientLevel | null,
    potassiumLevel: (i < 6 ? 'high' : 'none') as NutrientLevel | null,
    description: i === 0 ? '休眠期のため施肥不要' : null,
    cautionNote: i === 6 ? '高温期は控える' : null,
  }))
}

describe('FertilizationCalendar', () => {
  it('12ヶ月分の行が表示される', () => {
    const plans = createMockPlans()
    render(<FertilizationCalendar plans={plans} />)

    for (let month = 1; month <= 12; month++) {
      // Desktop and mobile both render month labels (getAllByText since duplicated)
      expect(screen.getAllByText(`${month}月`).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('テーブルヘッダーに「月」「施肥」「ポイント」が表示される', () => {
    render(<FertilizationCalendar plans={createMockPlans()} />)
    expect(screen.getByText('月')).toBeInTheDocument()
    expect(screen.getByText('施肥')).toBeInTheDocument()
    expect(screen.getByText('ポイント')).toBeInTheDocument()
  })

  it('N/P/Kヘッダーが表示される', () => {
    render(<FertilizationCalendar plans={createMockPlans()} />)
    // N appears in table header and also in mobile NutrientLevelIndicator
    expect(screen.getAllByText('N').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('P').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('K').length).toBeGreaterThanOrEqual(1)
  })

  it('アクションバッジが表示される', () => {
    render(<FertilizationCalendar plans={createMockPlans()} />)
    // noneアクションは「不要」ラベル
    expect(screen.getAllByText('不要').length).toBeGreaterThan(0)
    // heavyアクションは「たっぷり」ラベル
    expect(screen.getAllByText('たっぷり').length).toBeGreaterThan(0)
  })

  it('descriptionのテキストが表示される', () => {
    render(<FertilizationCalendar plans={createMockPlans()} />)
    // Desktop and mobile both render description text
    expect(screen.getAllByText('休眠期のため施肥不要').length).toBeGreaterThanOrEqual(1)
  })

  it('cautionNoteのテキストが表示される', () => {
    render(<FertilizationCalendar plans={createMockPlans()} />)
    // Desktop and mobile both render caution note text
    expect(screen.getAllByText('高温期は控える').length).toBeGreaterThanOrEqual(1)
  })

  it('凡例が表示される', () => {
    render(<FertilizationCalendar plans={createMockPlans()} />)
    expect(screen.getByText('凡例:')).toBeInTheDocument()
  })

  it('季節区切りヘッダーが表示される', () => {
    render(<FertilizationCalendar plans={createMockPlans()} />)
    // Desktop table has season separator rows, mobile also has season labels
    expect(screen.getAllByText('春（3-5月）').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('夏（6-8月）').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('秋（9-11月）').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('冬（12-2月）').length).toBeGreaterThanOrEqual(1)
  })

  it('空のプランでもテーブルヘッダーが表示される', () => {
    render(<FertilizationCalendar plans={[]} />)
    expect(screen.getByText('月')).toBeInTheDocument()
    expect(screen.getByText('施肥')).toBeInTheDocument()
  })

  it('descriptionがnullの行はポイント列が空', () => {
    const plans = [{
      month: 5,
      action: 'moderate' as FertilizerAction,
      nitrogenLevel: null,
      phosphorusLevel: null,
      potassiumLevel: null,
      description: null,
      cautionNote: null,
    }]
    render(<FertilizationCalendar plans={plans} />)
    expect(screen.getAllByText('5月').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('休眠期')).not.toBeInTheDocument()
  })
})
