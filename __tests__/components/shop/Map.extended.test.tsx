import { vi } from 'vitest'
/**
 * Map コンポーネントの拡張テスト
 * LocationButton、StarRating、geolocation、null座標フィルタリングをカバー
 */
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

// Leaflet モック
const mockSetView = vi.fn()
const mockUseMap = vi.fn(() => ({
  setView: mockSetView,
  locate: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => mockUseMap(),
}))

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({})),
    icon: vi.fn(() => ({})),
    latLng: vi.fn((lat: number, lng: number) => [lat, lng]),
    LatLng: vi.fn(),
  },
  divIcon: vi.fn(() => ({})),
  icon: vi.fn(() => ({})),
  latLng: vi.fn((lat: number, lng: number) => [lat, lng]),
  LatLng: vi.fn(),
}))

vi.mock('leaflet/dist/leaflet.css', () => ({}))

import { Map } from '@/components/shop/Map'

const mockShopsWithNull = [
  {
    id: 'shop-1',
    name: '有効な盆栽園',
    address: '東京都渋谷区1-2-3',
    latitude: 35.6762,
    longitude: 139.6503,
    averageRating: 4.5,
    reviewCount: 10,
  },
  {
    id: 'shop-null-lat',
    name: '無効な盆栽園（緯度なし）',
    address: '東京都新宿区',
    latitude: null,
    longitude: 139.6917,
    averageRating: 3.0,
    reviewCount: 2,
  },
  {
    id: 'shop-null-lng',
    name: '無効な盆栽園（経度なし）',
    address: '東京都池袋',
    latitude: 35.7295,
    longitude: null,
    averageRating: null,
    reviewCount: 0,
  },
  {
    id: 'shop-no-rating',
    name: 'レビューなし盆栽園',
    address: '東京都品川区',
    latitude: 35.6284,
    longitude: 139.7387,
    averageRating: null,
    reviewCount: 0,
  },
  {
    id: 'shop-half-star',
    name: '半星盆栽園',
    address: '東京都目黒区',
    latitude: 35.6339,
    longitude: 139.7156,
    averageRating: 3.5,
    reviewCount: 3,
  },
]

describe('Map 拡張テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('座標がnullの店舗はマーカーに含めない', () => {
    render(<Map shops={mockShopsWithNull} />)
    const markers = screen.getAllByTestId('marker')
    // shop-1, shop-no-rating, shop-half-star のみ表示（3つ）
    expect(markers).toHaveLength(3)
  })

  it('評価がnullの店舗は評価表示をしない', () => {
    render(
      <Map
        shops={[
          {
            id: 'shop-no-rating',
            name: 'レビューなし',
            address: '東京都品川区',
            latitude: 35.6284,
            longitude: 139.7387,
            averageRating: null,
            reviewCount: 0,
          },
        ]}
      />
    )
    expect(screen.queryByText(/件/)).not.toBeInTheDocument()
  })

  it('評価がある店舗はレビュー件数を表示する', () => {
    render(
      <Map
        shops={[
          {
            id: 'shop-rated',
            name: '評価あり',
            address: '東京都渋谷区',
            latitude: 35.6762,
            longitude: 139.6503,
            averageRating: 4.5,
            reviewCount: 10,
          },
        ]}
      />
    )
    expect(screen.getByText('(10件)')).toBeInTheDocument()
  })

  it('店舗名と住所を表示する', () => {
    render(
      <Map
        shops={[
          {
            id: 'shop-1',
            name: 'テスト盆栽園',
            address: '東京都渋谷区1-2-3',
            latitude: 35.6762,
            longitude: 139.6503,
            averageRating: null,
            reviewCount: 0,
          },
        ]}
      />
    )
    expect(screen.getByText('テスト盆栽園')).toBeInTheDocument()
    expect(screen.getByText('東京都渋谷区1-2-3')).toBeInTheDocument()
  })

  it('詳細リンクが正しいhrefを持つ', () => {
    render(
      <Map
        shops={[
          {
            id: 'shop-123',
            name: 'リンクテスト',
            address: '東京都',
            latitude: 35.6762,
            longitude: 139.6503,
            averageRating: null,
            reviewCount: 0,
          },
        ]}
      />
    )
    const link = screen.getByRole('link', { name: /詳細を見る/ })
    expect(link).toHaveAttribute('href', '/shops/shop-123')
  })

  it('現在地ボタンが表示される', () => {
    render(<Map shops={[]} />)
    expect(screen.getByTitle('現在地に移動')).toBeInTheDocument()
  })

  it('現在地ボタンクリックでGeolocation APIを呼ぶ', async () => {
    const mockGetCurrentPosition = vi.fn((successCb) => {
      successCb({ coords: { latitude: 35.6762, longitude: 139.6503 } })
    })
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      configurable: true,
    })

    const user = userEvent.setup()
    render(<Map shops={[]} />)

    await user.click(screen.getByTitle('現在地に移動'))

    expect(mockGetCurrentPosition).toHaveBeenCalled()
    expect(mockSetView).toHaveBeenCalledWith([35.6762, 139.6503], 14)
  })

  it('位置情報取得失敗時にトーストを表示する', async () => {
    const mockGetCurrentPosition = vi.fn((_successCb, errorCb) => {
      errorCb(new Error('Permission denied'))
    })
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: mockGetCurrentPosition },
      configurable: true,
    })

    const user = userEvent.setup()
    render(<Map shops={[]} />)

    await user.click(screen.getByTitle('現在地に移動'))

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '位置情報を取得できませんでした', variant: 'destructive' }))
  })

  it('Geolocation非対応ブラウザでトーストを表示する', async () => {
    // 'geolocation' in navigator をfalseにするため、
    // geolocationプロパティを完全に削除してundefinedに
    const desc = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
    // @ts-expect-error テスト用にgeolocationを削除
    delete navigator.geolocation

    const user = userEvent.setup()
    render(<Map shops={[]} />)

    await user.click(screen.getByTitle('現在地に移動'))

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'お使いのブラウザは位置情報に対応していません', variant: 'destructive' }))

    // 元に戻す
    if (desc) {
      Object.defineProperty(navigator, 'geolocation', desc)
    }
  })

  it('デフォルトのcenterとzoomが使用される', () => {
    render(<Map shops={[]} />)
    expect(screen.getByTestId('map-container')).toBeInTheDocument()
  })

  it('半星評価を正しく表示する（rating=3.5）', () => {
    render(
      <Map
        shops={[
          {
            id: 'shop-half',
            name: '半星',
            address: '東京都',
            latitude: 35.0,
            longitude: 139.0,
            averageRating: 3.5,
            reviewCount: 5,
          },
        ]}
      />
    )
    expect(screen.getByText('(5件)')).toBeInTheDocument()
  })

  it('整数評価を正しく表示する（rating=4.0）', () => {
    render(
      <Map
        shops={[
          {
            id: 'shop-full',
            name: '整数評価',
            address: '東京都',
            latitude: 35.0,
            longitude: 139.0,
            averageRating: 4.0,
            reviewCount: 8,
          },
        ]}
      />
    )
    expect(screen.getByText('(8件)')).toBeInTheDocument()
  })
})
