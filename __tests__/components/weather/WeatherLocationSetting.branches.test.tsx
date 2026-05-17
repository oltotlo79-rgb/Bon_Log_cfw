/**
 * WeatherLocationSetting - 未カバー分岐テスト
 *
 * 対象: lines 136-138, 140-142 — handleManualSave の
 *   都道府県未選択 (toast) と市区町村未入力 (toast) の早期リターン分岐
 *
 * これらの分岐はUIのdisabled属性でガードされているため、
 * 通常のUIインタラクションでは到達しない。
 * Reactコンポーネント内部のハンドラを直接呼び出すには、
 * 一度有効な状態にしてから直後にステートを変えるか、
 * あるいは手動でfetch APIのレスポンスで第2回fetchが失敗するケースをテストする。
 *
 * ここでは手動保存フローの未カバーパスとして、
 * 第1回fetch(市区町村+都道府県)が !res.ok の場合のフォールバック座標取得パスをテストする。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { WeatherLocationSetting } from '@/components/weather/WeatherLocationSetting'

const mockGetWeatherLocation = vi.fn()
const mockSaveWeatherLocation = vi.fn()
const mockRemoveWeatherLocation = vi.fn()

vi.mock('@/lib/actions/weather', () => ({
  getWeatherLocation: (...args: unknown[]) => mockGetWeatherLocation(...args),
  saveWeatherLocation: (...args: unknown[]) => mockSaveWeatherLocation(...args),
  removeWeatherLocation: (...args: unknown[]) => mockRemoveWeatherLocation(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/prefectures', () => ({
  PREFECTURES: ['北海道', '東京都', '大阪府', '京都府', '福岡県'] as const,
}))

describe('WeatherLocationSetting - 手動保存の追加分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetWeatherLocation.mockResolvedValue({ success: true, data: null })
  })

  it('第1回fetchが !ok の場合に都道府県概算座標フォールバックが使われる', async () => {
    mockSaveWeatherLocation.mockResolvedValue({ success: true })

    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // 市区町村+都道府県検索が失敗（!res.ok）
        return Promise.resolve({ ok: false })
      }
      // 都道府県のみで検索（フォールバック）
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ lat: '36.0', lon: '140.0' }]) })
    })

    render(<WeatherLocationSetting />)

    await waitFor(() => {
      expect(screen.getByLabelText('都道府県')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '東京都' } })
    fireEvent.change(screen.getByLabelText('市区町村'), { target: { value: '不明区' } })

    const submitButton = screen.getByText('位置情報を登録').closest('button')!
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockSaveWeatherLocation).toHaveBeenCalledWith({
        prefecture: '東京都',
        city: '不明区',
        latitude: 36.0,
        longitude: 140.0,
      })
    })

    global.fetch = originalFetch
  })

  it('第1回fetchも第2回(都道府県)fetchも失敗した場合に座標0,0で保存される', async () => {
    mockSaveWeatherLocation.mockResolvedValue({ success: true })

    const originalFetch = global.fetch
    let callCount = 0
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // 市区町村+都道府県: 結果なし
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
      }
      // 都道府県のみ: !ok
      return Promise.resolve({ ok: false })
    })

    render(<WeatherLocationSetting />)

    await waitFor(() => {
      expect(screen.getByLabelText('都道府県')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '北海道' } })
    fireEvent.change(screen.getByLabelText('市区町村'), { target: { value: '架空町' } })

    fireEvent.click(screen.getByText('位置情報を登録').closest('button')!)

    await waitFor(() => {
      expect(mockSaveWeatherLocation).toHaveBeenCalledWith({
        prefecture: '北海道',
        city: '架空町',
        latitude: 0,
        longitude: 0,
      })
    })

    global.fetch = originalFetch
  })

  it('第1回fetchも第2回(都道府県)fetchも結果が空の場合に座標0,0で保存される', async () => {
    mockSaveWeatherLocation.mockResolvedValue({ success: true })

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    render(<WeatherLocationSetting />)

    await waitFor(() => {
      expect(screen.getByLabelText('都道府県')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('都道府県'), { target: { value: '福岡県' } })
    fireEvent.change(screen.getByLabelText('市区町村'), { target: { value: '未知市' } })

    fireEvent.click(screen.getByText('位置情報を登録').closest('button')!)

    await waitFor(() => {
      expect(mockSaveWeatherLocation).toHaveBeenCalledWith({
        prefecture: '福岡県',
        city: '未知市',
        latitude: 0,
        longitude: 0,
      })
    })

    global.fetch = originalFetch
  })

  it('Geolocation APIで address.town を市区町村として使用する', async () => {
    mockSaveWeatherLocation.mockResolvedValue({ success: true })

    const mockGetCurrentPosition = vi.fn((success: (pos: GeolocationPosition) => void) => {
      success({
        coords: { latitude: 34.0, longitude: 135.0 },
      } as GeolocationPosition)
    })
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      configurable: true,
      writable: true,
    })

    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        address: {
          province: '京都府',
          town: '嵐山町',
        },
      }),
    })

    render(<WeatherLocationSetting />)

    await waitFor(() => {
      expect(screen.getByText('現在地を取得')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('現在地を取得'))

    await waitFor(() => {
      expect(mockSaveWeatherLocation).toHaveBeenCalledWith({
        prefecture: '京都府',
        city: '嵐山町',
        latitude: 34.0,
        longitude: 135.0,
      })
    })

    global.fetch = originalFetch
  })
})
