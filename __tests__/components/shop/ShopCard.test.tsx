import { render, screen } from '../../utils/test-utils'
import { ShopCard } from '@/components/shop/ShopCard'

const mockShop = {
  id: 'shop-1',
  name: '松風盆栽園',
  address: '東京都練馬区関町1-2-3',
  phone: '03-1234-5678',
  website: 'https://example.com',
  businessHours: '9:00-17:00',
  closedDays: '水曜日',
  genres: [
    { id: 'genre-1', name: '松柏', category: 'tree' },
    { id: 'genre-2', name: '雑木', category: 'tree' },
  ],
  averageRating: 4.5,
  reviewCount: 10,
}

describe('ShopCard', () => {
  it('店舗名を表示する', () => {
    render(<ShopCard shop={mockShop} />)
    expect(screen.getByText('松風盆栽園')).toBeInTheDocument()
  })

  it('住所を表示する', () => {
    render(<ShopCard shop={mockShop} />)
    expect(screen.getByText('東京都練馬区関町1-2-3')).toBeInTheDocument()
  })

  it('電話番号を表示する', () => {
    render(<ShopCard shop={mockShop} />)
    expect(screen.getByText('03-1234-5678')).toBeInTheDocument()
  })

  it('営業時間を表示する', () => {
    render(<ShopCard shop={mockShop} />)
    expect(screen.getByText('9:00-17:00')).toBeInTheDocument()
  })

  it('ジャンルを表示する', () => {
    render(<ShopCard shop={mockShop} />)
    expect(screen.getByText('松柏')).toBeInTheDocument()
    expect(screen.getByText('雑木')).toBeInTheDocument()
  })

  it('レビュー数を表示する', () => {
    render(<ShopCard shop={mockShop} />)
    expect(screen.getByText('(10)')).toBeInTheDocument()
  })

  it('店舗詳細ページへのリンクを持つ', () => {
    render(<ShopCard shop={mockShop} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/shops/shop-1')
  })

  it('電話番号がない場合は表示しない', () => {
    const shopWithoutPhone = { ...mockShop, phone: null }
    render(<ShopCard shop={shopWithoutPhone} />)
    expect(screen.queryByText('03-1234-5678')).not.toBeInTheDocument()
  })

  it('営業時間がない場合は表示しない', () => {
    const shopWithoutHours = { ...mockShop, businessHours: null }
    render(<ShopCard shop={shopWithoutHours} />)
    expect(screen.queryByText('9:00-17:00')).not.toBeInTheDocument()
  })

  it('評価がない場合は星評価を表示しない', () => {
    const shopWithoutRating = { ...mockShop, averageRating: null, reviewCount: 0 }
    const { container } = render(<ShopCard shop={shopWithoutRating} />)
    expect(container.querySelector('.text-yellow-400')).not.toBeInTheDocument()
  })

  it('ジャンルがない場合はジャンルを表示しない', () => {
    const shopWithoutGenres = { ...mockShop, genres: [] }
    render(<ShopCard shop={shopWithoutGenres} />)
    expect(screen.queryByText('松柏')).not.toBeInTheDocument()
  })
})
