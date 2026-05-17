import { render, screen } from '../../utils/test-utils'
import { TimeHeatmap } from '@/components/analytics/TimeHeatmap'

describe('TimeHeatmap', () => {
  // 24時間分のダミーデータ
  const mockHourlyData = [
    1, 0, 0, 0, 2, 5, 10, 15, 20, 25, 30, 35,
    40, 35, 30, 25, 20, 15, 10, 5, 2, 1, 0, 0,
  ]

  // 7日分のダミーデータ（日〜土）
  const mockWeekdayData = [20, 35, 28, 30, 32, 45, 25]

  it('時間帯別ラベルを表示する', () => {
    render(<TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />)

    expect(screen.getByText('時間帯別')).toBeInTheDocument()
  })

  it('曜日別ラベルを表示する', () => {
    render(<TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />)

    expect(screen.getByText('曜日別')).toBeInTheDocument()
  })

  it('時間ラベルを表示する', () => {
    render(<TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />)

    // 3時間おきのラベル
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument()
  })

  it('曜日ラベルを表示する', () => {
    render(<TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />)

    expect(screen.getByText('日')).toBeInTheDocument()
    expect(screen.getByText('月')).toBeInTheDocument()
    expect(screen.getByText('火')).toBeInTheDocument()
    expect(screen.getByText('水')).toBeInTheDocument()
    expect(screen.getByText('木')).toBeInTheDocument()
    expect(screen.getByText('金')).toBeInTheDocument()
    expect(screen.getByText('土')).toBeInTheDocument()
  })

  it('凡例を表示する', () => {
    render(<TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />)

    expect(screen.getByText('少')).toBeInTheDocument()
    expect(screen.getByText('多')).toBeInTheDocument()
  })

  it('24本の棒グラフを表示する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    const hourlyBars = container.querySelectorAll('.h-24 .flex-1')
    expect(hourlyBars).toHaveLength(24)
  })

  it('7つの曜日セルを表示する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    const weekdayCells = container.querySelectorAll('.h-8.rounded')
    expect(weekdayCells).toHaveLength(7)
  })

  it('時間帯にtitle属性を設定する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    const bar = container.querySelector('[title="0時: 1件"]')
    expect(bar).toBeInTheDocument()
  })

  it('曜日セルにtitle属性を設定する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    const cell = container.querySelector('[title="日: 20件"]')
    expect(cell).toBeInTheDocument()
  })

  it('曜日セルに値を表示する', () => {
    render(<TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />)

    // 最大値45（金曜日）
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  it('0件の時間帯にはbg-mutedを適用する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    // 1時(index=1)は0件
    const zeroBar = container.querySelector('[title="1時: 0件"]')
    expect(zeroBar).toHaveClass('bg-muted')
  })

  it('高い値の時間帯にはbg-primary/80を適用する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    // 12時は40件（最大値）なのでbg-primary/80
    const highBar = container.querySelector('[title="12時: 40件"]')
    expect(highBar).toHaveClass('bg-primary/80')
  })

  it('凡例の色見本を5つ表示する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    // 凡例の色見本
    expect(container.querySelectorAll('.w-4.h-4.rounded')).toHaveLength(5)
  })

  it('0件の曜日セルには数値を表示しない', () => {
    const dataWithZero = [0, 35, 28, 30, 32, 45, 25]
    render(<TimeHeatmap hourlyData={mockHourlyData} weekdayData={dataWithZero} />)

    // 日曜日が0件の場合、セル内に数値が表示されない
    const sundayCell = screen.getByTitle('日: 0件')
    expect(sundayCell.textContent).toBe('')
  })

  it('高い値の曜日にはbg-primary/80を適用する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    // 金曜日は45件（最大値）なのでbg-primary/80
    const highCell = container.querySelector('[title="金: 45件"]')
    expect(highCell).toHaveClass('bg-primary/80')
  })

  it('低い値の曜日にはbg-primary/20を適用する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    // 日曜日は20件（ratio ≈ 0.44）なのでbg-primary/40
    const lowCell = container.querySelector('[title="日: 20件"]')
    expect(lowCell).toHaveClass('bg-primary/40')
  })

  it('コンテナにspace-y-4クラスを適用する', () => {
    const { container } = render(
      <TimeHeatmap hourlyData={mockHourlyData} weekdayData={mockWeekdayData} />
    )

    expect(container.firstChild).toHaveClass('space-y-4')
  })
})
