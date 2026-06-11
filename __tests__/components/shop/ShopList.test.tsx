import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { ShopList } from '@/components/shop/ShopList'

// ShopCard モック
vi.mock('@/components/shop/ShopCard', () => ({
  ShopCard: ({ shop }: { shop: { id: string; name: string } }) => (
    <div data-testid={`shop-${shop.id}`}>
      {shop.name}
    </div>
  ),
}))

describe('ShopList', () => {
  const mockShops = [
    {
      id: 'shop-1',
      name: '盆栽園A',
      address: '東京都渋谷区1-1-1',
      phone: '03-1234-5678',
      website: 'https://bonsai-a.com',
      businessHours: '9:00〜17:00',
      closedDays: '水曜日',
      genres: [{ id: 'g1', name: '松柏類', category: '樹種' }],
      averageRating: 4.5,
      reviewCount: 10,
    },
    {
      id: 'shop-2',
      name: '盆栽園B',
      address: '大阪府大阪市2-2-2',
      phone: null,
      website: null,
      businessHours: null,
      closedDays: null,
      genres: [],
      averageRating: null,
      reviewCount: 0,
    },
    {
      id: 'shop-3',
      name: '盆栽園C',
      address: '京都府京都市3-3-3',
      phone: '075-1234-5678',
      website: 'https://bonsai-c.com',
      businessHours: '10:00〜18:00',
      closedDays: '月曜日',
      genres: [
        { id: 'g1', name: '松柏類', category: '樹種' },
        { id: 'g2', name: '雑木類', category: '樹種' },
      ],
      averageRating: 4.0,
      reviewCount: 5,
    },
  ]

  it('盆栽園一覧を表示する', () => {
    render(<ShopList shops={mockShops} />)

    expect(screen.getByTestId('shop-shop-1')).toBeInTheDocument()
    expect(screen.getByTestId('shop-shop-2')).toBeInTheDocument()
    expect(screen.getByTestId('shop-shop-3')).toBeInTheDocument()
  })

  it('各盆栽園の名前を表示する', () => {
    render(<ShopList shops={mockShops} />)

    expect(screen.getByText('盆栽園A')).toBeInTheDocument()
    expect(screen.getByText('盆栽園B')).toBeInTheDocument()
    expect(screen.getByText('盆栽園C')).toBeInTheDocument()
  })

  it('盆栽園が0件の場合は空メッセージを表示する', () => {
    render(<ShopList shops={[]} />)

    expect(screen.getByText('盆栽園が見つかりません')).toBeInTheDocument()
    expect(screen.getByText(/検索条件を変更するか/)).toBeInTheDocument()
  })

  it('盆栽園が1件の場合も正しく表示する', () => {
    render(<ShopList shops={[mockShops[0]!]} />)

    expect(screen.getByTestId('shop-shop-1')).toBeInTheDocument()
    expect(screen.queryByText('盆栽園が見つかりません')).not.toBeInTheDocument()
  })

  it('グリッドレイアウトのクラスが適用されている', () => {
    const { container } = render(<ShopList shops={mockShops} />)

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
    expect(grid).toHaveClass('sm:grid-cols-2')
    expect(grid).toHaveClass('lg:grid-cols-1')
    expect(grid).toHaveClass('xl:grid-cols-2')
  })
})
