import { vi } from 'vitest'
/**
 * MapWrapper 追加カバレッジテスト
 */

import React from 'react'

vi.mock('@/components/shop/Map', () => ({
  Map: function MockMap({ shops, center, zoom }: { shops: unknown[]; center?: [number, number]; zoom?: number }) {
    return (
      <div data-testid="mock-map" data-center={JSON.stringify(center)} data-zoom={zoom}>
        店舗数: {shops.length}
      </div>
    )
  },
}))

vi.mock('next/dynamic', () => ({
  default: vi.fn(() => {
    return function MockDynamicMap(props: Record<string, unknown>) { return <div data-testid="mock-map" data-center={JSON.stringify(props.center)} data-zoom={props.zoom as number}>店舗数: {(props.shops as unknown[]).length}</div> }
  }),
}))

import { render, screen } from '../../utils/test-utils'
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

describe('MapWrapper - props passing', () => {
  it('center propsをMapに渡す', () => {
    render(<MapWrapper shops={mockShops} center={[34.0, 135.0]} />)
    const map = screen.getByTestId('mock-map')
    expect(map.getAttribute('data-center')).toBe('[34,135]')
  })

  it('zoom propsをMapに渡す', () => {
    render(<MapWrapper shops={mockShops} zoom={12} />)
    const map = screen.getByTestId('mock-map')
    expect(map.getAttribute('data-zoom')).toBe('12')
  })

  it('複数店舗を表示する', () => {
    const shops = [
      ...mockShops,
      { id: 'shop-2', name: '二号店', address: '大阪', latitude: 34.0, longitude: 135.0, averageRating: 3.0, reviewCount: 5 },
    ]
    render(<MapWrapper shops={shops} />)
    expect(screen.getByText('店舗数: 2')).toBeInTheDocument()
  })

  it('heightが指定された場合はstyle.heightが設定される', () => {
    const { container } = render(<MapWrapper shops={mockShops} height="600px" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.height).toBe('600px')
  })

  it('heightが指定された場合はレスポンシブクラスを使わない', () => {
    const { container } = render(<MapWrapper shops={mockShops} height="600px" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className || '').not.toContain('h-[250px]')
  })

  it('heightが未指定の場合はクラスベースの高さを使用する', () => {
    const { container } = render(<MapWrapper shops={mockShops} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-[250px]')
    expect(wrapper.style.height).toBe('')
  })

  it('height指定時にcenter/zoomも渡せる', () => {
    render(<MapWrapper shops={mockShops} height="500px" center={[35.0, 139.0]} zoom={10} />)
    const map = screen.getByTestId('mock-map')
    expect(map.getAttribute('data-center')).toBe('[35,139]')
    expect(map.getAttribute('data-zoom')).toBe('10')
  })

  it('propsなしでデフォルト表示される', () => {
    render(<MapWrapper shops={[]} />)
    expect(screen.getByText('店舗数: 0')).toBeInTheDocument()
  })
})

describe('MapWrapperSmall - props passing', () => {
  it('center propsをMapに渡す', () => {
    render(<MapWrapperSmall shops={mockShops} center={[34.0, 135.0]} />)
    const map = screen.getByTestId('mock-map')
    expect(map.getAttribute('data-center')).toBe('[34,135]')
  })

  it('zoom propsをMapに渡す', () => {
    render(<MapWrapperSmall shops={mockShops} zoom={18} />)
    const map = screen.getByTestId('mock-map')
    expect(map.getAttribute('data-zoom')).toBe('18')
  })

  it('h-[300px]クラスを持つ', () => {
    const { container } = render(<MapWrapperSmall shops={mockShops} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-[300px]')
  })

  it('空の店舗リストでも動作する', () => {
    render(<MapWrapperSmall shops={[]} />)
    expect(screen.getByText('店舗数: 0')).toBeInTheDocument()
  })

  it('center未指定でも動作する', () => {
    render(<MapWrapperSmall shops={mockShops} />)
    expect(screen.getByTestId('mock-map')).toBeInTheDocument()
  })

  it('zoom未指定でも動作する', () => {
    render(<MapWrapperSmall shops={mockShops} />)
    const map = screen.getByTestId('mock-map')
    expect(map.getAttribute('data-zoom')).toBeNull()
  })
})
