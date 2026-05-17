import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { WeatherAdviceCard } from '@/components/weather/WeatherAdviceCard'

// Server Action モック
const mockGetWeatherAdvice = vi.fn()
vi.mock('@/lib/actions/weather', () => ({
  getWeatherAdvice: (...args: unknown[]) => mockGetWeatherAdvice(...args),
}))

describe('WeatherAdviceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('アドバイスがある場合にカードを表示する', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [
          { icon: 'wind', title: '強風注意', description: '棚場の盆栽を低い位置に移動してください' },
          { icon: 'sun', title: '猛暑日', description: '遮光ネットの設置と夕方の葉水を推奨' },
        ],
        location: '東京都 渋谷区',
        temperature: 32,
      },
    })

    render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(screen.getByText('天気アドバイス')).toBeInTheDocument()
    })

    expect(screen.getByText('強風注意')).toBeInTheDocument()
    expect(screen.getByText('棚場の盆栽を低い位置に移動してください')).toBeInTheDocument()
    expect(screen.getByText('猛暑日')).toBeInTheDocument()
    expect(screen.getByText('東京都 渋谷区')).toBeInTheDocument()
    expect(screen.getByText('32°C')).toBeInTheDocument()
  })

  it('位置情報未登録（空ロケーション）の場合は何も表示しない', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [],
        location: '',
        temperature: null,
      },
    })

    const { container } = render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(mockGetWeatherAdvice).toHaveBeenCalled()
    })

    // アドバイスなし + ロケーション空 → 何も表示しない
    expect(container.innerHTML).toBe('')
  })

  it('アドバイスが空の場合は何も表示しない', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [],
        location: '東京都 渋谷区',
        temperature: 25,
      },
    })

    const { container } = render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(mockGetWeatherAdvice).toHaveBeenCalled()
    })

    expect(container.innerHTML).toBe('')
  })

  it('閉じるボタンでカードを非表示にする', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [
          { icon: 'wind', title: '強風注意', description: 'テスト' },
        ],
        location: '東京都',
        temperature: 20,
      },
    })

    render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(screen.getByText('強風注意')).toBeInTheDocument()
    })

    const closeButton = screen.getByLabelText('閉じる')
    fireEvent.click(closeButton)

    expect(screen.queryByText('強風注意')).not.toBeInTheDocument()
    expect(screen.queryByText('天気アドバイス')).not.toBeInTheDocument()
  })

  it('API失敗時は何も表示しない', async () => {
    mockGetWeatherAdvice.mockRejectedValue(new Error('Network error'))

    const { container } = render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(mockGetWeatherAdvice).toHaveBeenCalled()
    })

    expect(container.innerHTML).toBe('')
  })

  it('API結果がsuccess=falseの場合は何も表示しない', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: false,
      error: '認証が必要です',
    })

    const { container } = render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(mockGetWeatherAdvice).toHaveBeenCalled()
    })

    expect(container.innerHTML).toBe('')
  })

  it('設定リンクが表示される', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [
          { icon: 'wind', title: '強風注意', description: 'テスト' },
        ],
        location: '東京都',
        temperature: 20,
      },
    })

    render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(screen.getByText('位置情報を変更')).toBeInTheDocument()
    })

    const settingsLink = screen.getByText('位置情報を変更')
    expect(settingsLink.closest('a')).toHaveAttribute('href', '/settings')
  })

  it('temperatureがnullの場合は温度表示しない', async () => {
    mockGetWeatherAdvice.mockResolvedValue({
      success: true,
      data: {
        advice: [
          { icon: 'sun', title: '猛暑日', description: 'テスト' },
        ],
        location: '東京都',
        temperature: null,
      },
    })

    render(<WeatherAdviceCard />)

    await waitFor(() => {
      expect(screen.getByText('猛暑日')).toBeInTheDocument()
    })

    expect(screen.queryByText('°C')).not.toBeInTheDocument()
  })

  it('ローディング中は何も表示しない', () => {
    // getWeatherAdvice が resolve されない状態
    mockGetWeatherAdvice.mockReturnValue(new Promise(() => {}))

    const { container } = render(<WeatherAdviceCard />)

    // isLoading = true の間は null を返す
    expect(container.innerHTML).toBe('')
  })
})
