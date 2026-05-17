import { vi } from 'vitest'
import React from 'react'

/**
 * MapWrapper ブランチカバレッジ追加テスト
 * - dynamic importのloading状態テスト
 * - next/dynamicの呼び出し検証
 * - 各コンポーネントのprops組み合わせ
 */

vi.mock('next/dynamic', () => ({
  default: vi.fn((_loader: unknown, options?: { loading?: () => React.ReactNode; ssr?: boolean }) => {
    // Store loading fn on globalThis (self-initializing to avoid TDZ)
     
    if (!((globalThis as any).__mwCapture)) {
       
      ;(globalThis as any).__mwCapture = { loadingFn: null }
    }
    if (options?.loading) {
       
      ;(globalThis as any).__mwCapture.loadingFn = options.loading
    }
    return function MockDynamicMap(props: { shops: unknown[]; center?: [number, number]; zoom?: number }) {
      return (
        <div
          data-testid="dynamic-map"
          data-shop-count={props.shops.length}
          data-center={props.center ? JSON.stringify(props.center) : undefined}
          data-zoom={props.zoom}
        />
      )
    }
  }),
}))

vi.mock('@/components/shop/Map', () => ({
  Map: () => <div data-testid="real-map" />,
}))

import { render, screen } from '../../utils/test-utils'
import { MapWrapper, MapWrapperSmall } from '@/components/shop/MapWrapper'
import _dynamic from 'next/dynamic'

 
const getCapture = () => (globalThis as any).__mwCapture as { loadingFn: (() => React.ReactNode) | null }

const mockShop = {
  id: 'shop-1',
  name: 'テスト盆栽園',
  address: '東京都',
  latitude: 35.6762,
  longitude: 139.6503,
  averageRating: 4.0,
  reviewCount: 5,
}

describe('MapWrapper - dynamic import verification', () => {
  it('loading fallbackが地図読み込み中テキストを表示する', () => {
    const cap = getCapture()
    expect(cap.loadingFn).not.toBeNull()
    if (cap.loadingFn) {
      const loadingElement = cap.loadingFn()
      const { container } = render(<>{loadingElement}</>)
      expect(container.textContent).toContain('地図を読み込み中...')
    }
  })

  it('loading fallbackのスタイルが正しい', () => {
    const cap = getCapture()
    if (cap.loadingFn) {
      const loadingElement = cap.loadingFn()
      const { container } = render(<>{loadingElement}</>)
      const div = container.firstChild as HTMLElement
      expect(div.className).toContain('bg-muted')
      expect(div.className).toContain('rounded-lg')
    }
  })
})

describe('MapWrapper - height branch coverage', () => {
  it('height指定時: style.heightが設定されクラスなし', () => {
    const { container } = render(<MapWrapper shops={[mockShop]} height="450px" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.height).toBe('450px')
    expect(wrapper.className).toBe('relative z-0')
  })

  it('height未指定時: classNameベースの高さ', () => {
    const { container } = render(<MapWrapper shops={[mockShop]} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-[250px]')
    expect(wrapper.className).toContain('md:h-[400px]')
    expect(wrapper.style.height).toBe('')
  })

  it('height空文字列: falsy なので className ブランチに入る', () => {
    const { container } = render(<MapWrapper shops={[mockShop]} height="" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-[250px]')
  })

  it('height="100%": style.heightが100%', () => {
    const { container } = render(<MapWrapper shops={[mockShop]} height="100%" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.height).toBe('100%')
  })
})

describe('MapWrapper - props combinations', () => {
  it('shopsのみ（center/zoom未指定）', () => {
    render(<MapWrapper shops={[mockShop]} />)
    const map = screen.getByTestId('dynamic-map')
    expect(map).toHaveAttribute('data-shop-count', '1')
    expect(map.getAttribute('data-center')).toBeNull()
    expect(map.getAttribute('data-zoom')).toBeNull()
  })

  it('全props指定', () => {
    render(<MapWrapper shops={[mockShop]} center={[36.0, 140.0]} zoom={8} height="600px" />)
    const map = screen.getByTestId('dynamic-map')
    expect(map).toHaveAttribute('data-shop-count', '1')
    expect(map).toHaveAttribute('data-center', '[36,140]')
    expect(map).toHaveAttribute('data-zoom', '8')
  })

  it('空のshops配列', () => {
    render(<MapWrapper shops={[]} />)
    const map = screen.getByTestId('dynamic-map')
    expect(map).toHaveAttribute('data-shop-count', '0')
  })

  it('複数店舗', () => {
    const shops = [
      mockShop,
      { ...mockShop, id: 'shop-2', name: '二号店' },
      { ...mockShop, id: 'shop-3', name: '三号店' },
    ]
    render(<MapWrapper shops={shops} />)
    expect(screen.getByTestId('dynamic-map')).toHaveAttribute('data-shop-count', '3')
  })
})

describe('MapWrapperSmall - comprehensive', () => {
  it('h-[300px]クラスが適用される', () => {
    const { container } = render(<MapWrapperSmall shops={[mockShop]} />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-[300px]')
  })

  it('shopsがMapに渡される', () => {
    render(<MapWrapperSmall shops={[mockShop]} />)
    expect(screen.getByTestId('dynamic-map')).toHaveAttribute('data-shop-count', '1')
  })

  it('center/zoomがMapに渡される', () => {
    render(<MapWrapperSmall shops={[mockShop]} center={[35.0, 139.0]} zoom={15} />)
    const map = screen.getByTestId('dynamic-map')
    expect(map).toHaveAttribute('data-center', '[35,139]')
    expect(map).toHaveAttribute('data-zoom', '15')
  })

  it('空の店舗リスト', () => {
    render(<MapWrapperSmall shops={[]} />)
    expect(screen.getByTestId('dynamic-map')).toHaveAttribute('data-shop-count', '0')
  })

  it('center/zoom未指定でも動作する', () => {
    render(<MapWrapperSmall shops={[mockShop]} />)
    const map = screen.getByTestId('dynamic-map')
    expect(map.getAttribute('data-center')).toBeNull()
    expect(map.getAttribute('data-zoom')).toBeNull()
  })
})
