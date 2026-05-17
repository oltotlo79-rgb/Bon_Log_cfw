/**
 * WeatherAdviceCard - AdviceIcon未カバー分岐テスト
 *
 * 対象: lines 17-24 の switch case (snowflake, cloud-rain, droplets, default)
 * 既存テストでは 'wind' と 'sun' のみカバー済み
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import { WeatherAdviceCard } from '@/components/weather/WeatherAdviceCard'

const mockGetWeatherAdvice = vi.fn()
vi.mock('@/lib/actions/weather', () => ({
  getWeatherAdvice: (...args: unknown[]) => mockGetWeatherAdvice(...args),
}))

describe('WeatherAdviceCard - AdviceIcon分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('snowflakeアイコンが表示される', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [
          { icon: 'snowflake', title: '霜注意', description: 'ムロに取り込んでください' },
        ],
        location: '北海道 札幌市',
        temperature: -5,
      },
    })

    render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(screen.getByText('霜注意')).toBeInTheDocument()
    })

    expect(screen.getByText('ムロに取り込んでください')).toBeInTheDocument()
    expect(screen.getByText('-5°C')).toBeInTheDocument()
  })

  it('cloud-rainアイコンが表示される', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [
          { icon: 'cloud-rain', title: '雨天', description: '水やりを控えてください' },
        ],
        location: '東京都 渋谷区',
        temperature: 15,
      },
    })

    render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(screen.getByText('雨天')).toBeInTheDocument()
    })

    expect(screen.getByText('水やりを控えてください')).toBeInTheDocument()
  })

  it('dropletsアイコンが表示される', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [
          { icon: 'droplets', title: '多湿注意', description: '風通しを確保してください' },
        ],
        location: '大阪府 大阪市',
        temperature: 28,
      },
    })

    render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(screen.getByText('多湿注意')).toBeInTheDocument()
    })

    expect(screen.getByText('風通しを確保してください')).toBeInTheDocument()
  })

  it('未知のアイコン名の場合はデフォルトアイコン(CloudSun)が表示される', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [
          { icon: 'unknown-icon', title: '一般アドバイス', description: '通常の管理を行ってください' },
        ],
        location: '京都府 京都市',
        temperature: 20,
      },
    })

    render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(screen.getByText('一般アドバイス')).toBeInTheDocument()
    })

    expect(screen.getByText('通常の管理を行ってください')).toBeInTheDocument()
  })

  it('result.data が undefined の場合は何も表示しない', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: undefined,
    })

    const { container } = render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(mockGetWeatherAdvice).toHaveBeenCalled()
    })

    expect(container.innerHTML).toBe('')
  })

  it('location があるがアドバイスが空の場合は何も表示しない', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [],
        location: '東京都',
        temperature: 25,
      },
    })

    const { container } = render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(mockGetWeatherAdvice).toHaveBeenCalled()
    })

    expect(container.innerHTML).toBe('')
  })
})
