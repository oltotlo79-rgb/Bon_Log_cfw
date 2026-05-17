import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/actions/shop', () => ({ getShop: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/components/shop/StarRating', () => ({
  StarRatingDisplay: () => <div data-testid="star-rating" />,
}))
vi.mock('@/components/shop/ReviewForm', () => ({
  ReviewForm: () => <div data-testid="review-form" />,
}))
vi.mock('@/components/shop/ReviewList', () => ({
  ReviewList: () => <div data-testid="review-list" />,
}))
vi.mock('@/components/shop/MapWrapper', () => ({
  MapWrapperSmall: () => <div data-testid="map" />,
}))
vi.mock('@/components/seo/JsonLd', () => ({
  LocalBusinessJsonLd: () => <script data-testid="json-ld" />,
  BreadcrumbJsonLd: () => <script data-testid="breadcrumb-json-ld" />,
}))
vi.mock('@/components/shop/ShopActions', () => ({
  ShopActions: () => <div data-testid="shop-actions" />,
}))
vi.mock('@/components/shop/ShopGenreEditor', () => ({
  ShopGenreEditor: () => <div data-testid="genre-editor" />,
}))

import { auth } from '@/lib/auth'
import { getShop } from '@/lib/actions/shop'
import { notFound } from 'next/navigation'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockGetShop = getShop as ReturnType<typeof vi.fn>

function makeShop(overrides = {}) {
  return {
    id: 'shop-1',
    name: 'Bonsai Garden',
    address: 'Tokyo, Japan',
    phone: '03-1234-5678',
    website: 'https://bonsai.example.com',
    businessHours: '9:00-17:00',
    closedDays: '水曜日',
    latitude: 35.6,
    longitude: 139.7,
    averageRating: 4.5,
    reviewCount: 10,
    isOwner: false,
    genres: [{ id: 'g1', name: '松柏類' }],
    reviews: [],
    ...overrides,
  }
}

describe('ShopDetailPage', async () => {
  let Page: typeof import('@/app/(main)/shops/[id]/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/shops/[id]/page')
    Page = mod.default
  })

  it('renders shop details', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockGetShop.mockResolvedValue({ shop: makeShop() } as never)

    const result = await Page({ params: Promise.resolve({ id: 'shop-1' }) })
    render(result)

    expect(screen.getByRole('heading', { name: 'Bonsai Garden' })).toBeInTheDocument()
    expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument()
    expect(screen.getByText('03-1234-5678')).toBeInTheDocument()
    expect(screen.getByText('https://bonsai.example.com')).toBeInTheDocument()
    expect(screen.getByText('9:00-17:00')).toBeInTheDocument()
    expect(screen.getByText('定休日: 水曜日')).toBeInTheDocument()
    expect(screen.getByTestId('map')).toBeInTheDocument()
    expect(screen.getByTestId('star-rating')).toBeInTheDocument()
  })

  it('calls notFound when shop not found', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockGetShop.mockResolvedValue({ error: 'Not found' } as never)

    await expect(
      Page({ params: Promise.resolve({ id: 'none' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('shows review form for logged-in user who has not reviewed', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me' }, expires: '' } as never)
    mockGetShop.mockResolvedValue({ shop: makeShop({ reviews: [] }) } as never)

    const result = await Page({ params: Promise.resolve({ id: 'shop-1' }) })
    render(result)

    expect(screen.getByTestId('review-form')).toBeInTheDocument()
  })

  it('shows reviewed message when user already reviewed', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me' }, expires: '' } as never)
    mockGetShop.mockResolvedValue({
      shop: makeShop({ reviews: [{ user: { id: 'me' } }] }),
    } as never)

    const result = await Page({ params: Promise.resolve({ id: 'shop-1' }) })
    render(result)

    expect(screen.getByText('この盆栽園にはレビュー済みです')).toBeInTheDocument()
  })

  it('shows login prompt for unauthenticated users', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockGetShop.mockResolvedValue({ shop: makeShop() } as never)

    const result = await Page({ params: Promise.resolve({ id: 'shop-1' }) })
    render(result)

    expect(screen.getByText('レビューを投稿するにはログインしてください')).toBeInTheDocument()
  })

  it('does not render map when no coordinates', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockGetShop.mockResolvedValue({
      shop: makeShop({ latitude: null, longitude: null }),
    } as never)

    const result = await Page({ params: Promise.resolve({ id: 'shop-1' }) })
    render(result)

    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
  })
})

describe('generateMetadata for shops', async () => {
  let generateMetadata: typeof import('@/app/(main)/shops/[id]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/shops/[id]/page')
    generateMetadata = mod.generateMetadata
  })

  it('returns shop metadata', async () => {
    mockGetShop.mockResolvedValue({ shop: makeShop() } as never)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'shop-1' }) })
    expect(result.title).toBe('Bonsai Garden')
  })

  it('returns fallback when not found', async () => {
    mockGetShop.mockResolvedValue({ error: 'Not found' } as never)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('盆栽園が見つかりません')
  })
})
