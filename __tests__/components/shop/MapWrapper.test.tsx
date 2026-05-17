import { vi } from 'vitest'
/**
 * マップラッパーコンポーネントのテスト
 *
 * @module __tests__/components/shop/MapWrapper.test
 */

import { render, screen, waitFor } from '../../utils/test-utils'

// Mapコンポーネントをモック（動的インポートの代わり）
vi.mock('@/components/shop/Map', () => ({
  Map: ({ shops }: { shops: unknown[] }) => (
    <div data-testid="mock-map">店舗数: {shops.length}</div>
  ),
}))

// next/dynamicをモック
vi.mock('next/dynamic', () => ({
  default: function dynamic(_loader: () => Promise<{ default: React.ComponentType }>) {
    return (props: { shops: unknown[] }) => <div data-testid="mock-map">店舗数: {props.shops.length}</div>
  },
}))

import { MapWrapper, MapWrapperSmall } from '@/components/shop/MapWrapper'

const mockShops = [
  {
    id: 'shop-1',
    name: 'テスト盆栽園',
    address: '東京都渋谷区1-2-3',
    latitude: 35.6762,
    longitude: 139.6503,
    averageRating: 4.5,
    reviewCount: 10,
  },
]

describe('MapWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('マップコンポーネントを表示する', async () => {
    render(<MapWrapper shops={mockShops} />)

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
    })
  })

  it('店舗情報をMapコンポーネントに渡す', async () => {
    render(<MapWrapper shops={mockShops} />)

    await waitFor(() => {
      expect(screen.getByText('店舗数: 1')).toBeInTheDocument()
    })
  })

  it('空の店舗リストでも動作する', async () => {
    render(<MapWrapper shops={[]} />)

    await waitFor(() => {
      expect(screen.getByText('店舗数: 0')).toBeInTheDocument()
    })
  })

  it('centerとzoomプロパティを受け入れる', async () => {
    render(
      <MapWrapper
        shops={mockShops}
        center={[35.0, 135.0]}
        zoom={15}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
    })
  })

  it('heightプロパティが指定された場合、inline styleで高さを設定する', async () => {
    const { container } = render(
      <MapWrapper shops={mockShops} height="500px" />
    )

    await waitFor(() => {
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.style.height).toBe('500px')
    })
  })

  it('heightプロパティが未指定の場合、レスポンシブクラスを使用する', async () => {
    const { container } = render(
      <MapWrapper shops={mockShops} />
    )

    await waitFor(() => {
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('h-[250px]')
      expect(wrapper.className).toContain('md:h-[400px]')
    })
  })
})

describe('MapWrapperSmall', () => {
  it('マップコンポーネントを表示する', async () => {
    render(<MapWrapperSmall shops={mockShops} />)

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
    })
  })

  it('高さ300pxのコンテナで表示する', async () => {
    const { container } = render(<MapWrapperSmall shops={mockShops} />)

    await waitFor(() => {
      const wrapper = container.firstChild as HTMLElement
      expect(wrapper.className).toContain('h-[300px]')
    })
  })

  it('centerとzoomを受け取る', async () => {
    render(
      <MapWrapperSmall shops={mockShops} center={[35.0, 135.0]} zoom={15} />
    )

    await waitFor(() => {
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
    })
  })
})
