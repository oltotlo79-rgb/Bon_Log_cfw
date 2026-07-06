import { describe, it, expect } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { BestTimeCard } from '@/components/analytics/BestTimeCard'

describe('BestTimeCard', () => {
  const defaultProps = {
    peakHour: 12,
    peakWeekday: 3,
    hourlyData: Array(24).fill(0).map((_, i) => (i === 12 ? 50 : i === 11 ? 20 : i === 13 ? 30 : 5)),
    weekdayData: [10, 15, 20, 40, 25, 10, 5],
  }

  it('renders without crashing', () => {
    render(<BestTimeCard {...defaultProps} />)
    expect(screen.getByText('ベスト投稿時間')).toBeInTheDocument()
    expect(screen.getByText('ベスト曜日')).toBeInTheDocument()
  })

  it('displays peak hour time range', () => {
    render(<BestTimeCard {...defaultProps} />)
    expect(screen.getByText('12:00 - 13:00')).toBeInTheDocument()
  })

  it('displays peak weekday name', () => {
    render(<BestTimeCard {...defaultProps} />)
    expect(screen.getByText('水曜日')).toBeInTheDocument()
  })

  it('displays engagement percentage for peak time range', () => {
    render(<BestTimeCard {...defaultProps} />)
    // Total likes = 50 + 20 + 30 + (21 * 5) = 205
    // Peak range (11, 12, 13) = 20 + 50 + 30 = 100
    // Percentage = Math.round(100/205 * 100) = 49%
    expect(screen.getByText(/49%を獲得/)).toBeInTheDocument()
  })

  it('displays weekday like count and percentage', () => {
    render(<BestTimeCard {...defaultProps} />)
    // weekdayData[3] = 40, total = 10+15+20+40+25+10+5 = 125... but totalLikes is from hourlyData
    // totalLikes from hourlyData = 205
    // weekdayData[3] = 40 -> 40/205 * 100 = 20%
    expect(screen.getByText(/40いいね/)).toBeInTheDocument()
  })

  it('shows empty state when all data is zero', () => {
    render(
      <BestTimeCard
        peakHour={0}
        peakWeekday={0}
        hourlyData={Array(24).fill(0)}
        weekdayData={Array(7).fill(0)}
      />
    )
    expect(screen.getByText('データが不足しています')).toBeInTheDocument()
    expect(screen.queryByText('ベスト投稿時間')).not.toBeInTheDocument()
  })

  // 境界条件: 0時 / 23時で peakRange の wrap-around を確認
  it('peakHour=0 で前後1時間の範囲は (23, 0, 1)', () => {
    const hourly = Array(24).fill(0).map((_, i) => (i === 0 ? 50 : i === 23 ? 20 : i === 1 ? 30 : 1))
    render(
      <BestTimeCard
        peakHour={0}
        peakWeekday={0}
        hourlyData={hourly}
        weekdayData={[100, 0, 0, 0, 0, 0, 0]}
      />
    )
    // 23時〜2時 (= (1+1)%24 = 2)
    expect(screen.getByText(/23時〜2時/)).toBeInTheDocument()
    expect(screen.getByText('0:00 - 1:00')).toBeInTheDocument()
  })

  it('peakHour=23 で前後1時間の範囲は (22, 23, 0)、(23+1)%24 = 0:00 表示', () => {
    const hourly = Array(24).fill(0).map((_, i) => (i === 23 ? 50 : i === 22 ? 20 : i === 0 ? 30 : 1))
    render(
      <BestTimeCard
        peakHour={23}
        peakWeekday={6}
        hourlyData={hourly}
        weekdayData={[0, 0, 0, 0, 0, 0, 50]}
      />
    )
    expect(screen.getByText('23:00 - 0:00')).toBeInTheDocument()
    // peakRange[2]=0, (0+1)%24 = 1 -> "22時〜1時"
    expect(screen.getByText(/22時〜1時/)).toBeInTheDocument()
    expect(screen.getByText('土曜日')).toBeInTheDocument()
  })

  it('weekdayData の合計が hourlyData と異なってもパーセンテージは hourlyData 合計を分母にする', () => {
    // hourly 合計 = 100, weekday[3] = 40 → 40 / 100 * 100 = 40%
    const hourly = Array(24).fill(0).map((_, i) => (i === 12 ? 100 : 0))
    render(
      <BestTimeCard
        peakHour={12}
        peakWeekday={3}
        hourlyData={hourly}
        weekdayData={[10, 10, 10, 40, 10, 10, 10]}
      />
    )
    expect(screen.getByText(/40いいね（全体の40%）/)).toBeInTheDocument()
  })

  it('hourlyData が peakHour 近辺のインデックスを持たない（短い配列）場合、欠損分は0扱いで集計される', () => {
    // hourlyData は本来24要素だが、上流データ不備で短い配列が渡されるケースを想定
    const shortHourly = [10] // index 0 のみ存在。peakHour=5 の前後(4,5,6)は範囲外 → undefined ?? 0
    render(
      <BestTimeCard
        peakHour={5}
        peakWeekday={0}
        hourlyData={shortHourly}
        weekdayData={[10, 0, 0, 0, 0, 0, 0]}
      />
    )
    // totalLikes = 10, peakRangeLikes = 0(index4) + 0(index5) + 0(index6) = 0 → 0%
    expect(screen.getByText(/0%を獲得/)).toBeInTheDocument()
  })

  it('weekdayData が peakWeekday のインデックスを持たない場合、0いいね扱いになる', () => {
    render(
      <BestTimeCard
        peakHour={12}
        peakWeekday={5}
        hourlyData={Array(24).fill(0).map((_, i) => (i === 12 ? 100 : 0))}
        weekdayData={[10, 20, 30]} // index 5 は範囲外
      />
    )
    expect(screen.getByText(/0いいね（全体の0%）/)).toBeInTheDocument()
  })

  it('peakWeekday が WEEKDAY_NAMES の範囲外の場合、曜日名は空文字で表示される', () => {
    render(
      <BestTimeCard
        peakHour={12}
        peakWeekday={9}
        hourlyData={Array(24).fill(0).map((_, i) => (i === 12 ? 100 : 0))}
        weekdayData={[10, 20, 30]}
      />
    )
    // WEEKDAY_NAMES[9] は undefined → '' にフォールバックし、曜日名テキストは空になる
    expect(screen.queryByText('日曜日')).not.toBeInTheDocument()
    expect(screen.getByText('ベスト曜日')).toBeInTheDocument()
  })

  it('hourlyData の合計が負値（0以外）になる異常データでは、獲得率は0%にクランプされる', () => {
    // 通常は非負カウントだが、上流集計の不整合で負値合計になった場合の防御分岐を検証
    const anomalousHourly = Array(24).fill(0)
    anomalousHourly[12] = -5
    render(
      <BestTimeCard
        peakHour={12}
        peakWeekday={0}
        hourlyData={anomalousHourly}
        weekdayData={[0, 0, 0, 0, 0, 0, 0]}
      />
    )
    expect(screen.getByText(/0%を獲得/)).toBeInTheDocument()
    expect(screen.getByText(/0いいね（全体の0%）/)).toBeInTheDocument()
  })

  it('全曜日でいいね数が大きい配列でも、weekdayData[peakWeekday] が 0 なら 0% 表示', () => {
    const hourly = Array(24).fill(0).map((_, i) => (i === 12 ? 200 : 0))
    render(
      <BestTimeCard
        peakHour={12}
        peakWeekday={2} // 火曜日に 0 いいね（極端なケース）
        hourlyData={hourly}
        weekdayData={[100, 100, 0, 0, 0, 0, 0]}
      />
    )
    // weekdayData[2] = 0 -> 0いいね（全体の0%）
    expect(screen.getByText(/0いいね（全体の0%）/)).toBeInTheDocument()
    expect(screen.getByText('火曜日')).toBeInTheDocument()
  })
})
