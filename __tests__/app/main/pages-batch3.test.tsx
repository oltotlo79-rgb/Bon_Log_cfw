import { vi } from 'vitest'
/**
 * Batch test for events page, shops page, shops/new, events/new
 */

import React from 'react'

/**
 * Helper to render a page that contains async Server Components.
 */
async function resolveAsyncJsx(element: React.ReactElement): Promise<React.ReactElement> {
  if (!element || typeof element !== 'object') return element

  const { type, props } = element
  const typedProps = props as Record<string, unknown>

  if (typeof type === 'function') {
    try {
      const result = (type as (props: Record<string, unknown>) => Promise<React.ReactElement>)(typedProps)
      if (result && typeof result === 'object' && 'then' in result) {
        const resolved = await result
        return resolveAsyncJsx(resolved)
      }
      return resolveAsyncJsx(result as React.ReactElement)
    } catch {
      return element
    }
  }

  if (typedProps?.children) {
    const children = Array.isArray(typedProps.children)
      ? await Promise.all((typedProps.children as React.ReactNode[]).map(async (child: React.ReactNode, i: number) => {
          if (!React.isValidElement(child)) return child
          const resolved = await resolveAsyncJsx(child)
          // cloneElement で静的 children を明示配列にすると React が key を要求するため、
          // key の無い要素には index ベースの key を補う (test 専用 render で reconcile しない)
          return React.isValidElement(resolved) && resolved.key == null
            ? React.cloneElement(resolved, { key: `__rk${i}` })
            : resolved
        }))
      : React.isValidElement(typedProps.children)
        ? await resolveAsyncJsx(typedProps.children as React.ReactElement)
        : typedProps.children

    return React.cloneElement(element, { ...typedProps, children } as React.Attributes)
  }

  return element
}

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => { mockRedirect(...args); throw new Error('REDIRECT') },
}))

vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))

// Event mocks
const mockGetEvents = vi.fn()
vi.mock('@/lib/actions/event', () => ({ getEvents: (params: unknown) => mockGetEvents(params) }))

// Shop mocks
const mockGetShops = vi.fn()
const mockGetShopGenres = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  getShops: (params: unknown) => mockGetShops(params),
  getShopGenres: () => mockGetShopGenres(),
}))

// Component mocks
vi.mock('@/components/event/EventCalendarWrapper', () => ({ EventCalendarWrapper: () => <div data-testid="event-calendar" /> }))
vi.mock('@/components/event/EventList', () => ({ EventList: ({ events, emptyMessage }: { events?: unknown[]; emptyMessage: string }) => <div data-testid="event-list" data-event-count={events?.length ?? 0}>{emptyMessage}</div> }))
vi.mock('@/components/event/RegionFilter', () => ({ RegionFilter: () => <div data-testid="region-filter" /> }))
vi.mock('@/components/event/ShowPastToggle', () => ({ ShowPastToggle: () => <div data-testid="show-past" /> }))
vi.mock('@/components/event/EventFilterPersistence', () => ({ EventFilterPersistence: () => null }))
vi.mock('@/components/event/EventForm', () => ({ EventForm: () => <div data-testid="event-form" /> }))
vi.mock('@/components/shop/ShopList', () => ({ ShopList: () => <div data-testid="shop-list" /> }))
vi.mock('@/components/shop/MapWrapper', () => ({ MapWrapper: () => <div data-testid="map-wrapper" /> }))
vi.mock('@/components/shop/ShopForm', () => ({ ShopForm: () => <div data-testid="shop-form" /> }))
vi.mock('@/app/(main)/shops/ShopSearchForm', () => ({ ShopSearchForm: () => <div data-testid="shop-search" /> }))

import { render, screen } from '@testing-library/react'

describe('EventsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEvents.mockResolvedValue({ events: [] })
  })

  it('renders events page with calendar view and upcoming events by default', async () => {
    const { default: Page } = await import('@/app/(main)/events/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(await resolveAsyncJsx(result))
    expect(screen.getByText('イベント')).toBeInTheDocument()
    expect(screen.getByTestId('event-calendar')).toBeInTheDocument()
    expect(screen.getByText('イベントを登録')).toBeInTheDocument()
    // カレンダー下部に今後のイベントセクションが表示される
    expect(screen.getByText('今後のイベント')).toBeInTheDocument()
  })

  it('renders list view when view=list', async () => {
    const { default: Page } = await import('@/app/(main)/events/page')
    const result = await Page({ searchParams: Promise.resolve({ view: 'list' }) })
    render(await resolveAsyncJsx(result))
    expect(screen.getByText('イベント一覧')).toBeInTheDocument()
    expect(screen.getByTestId('event-list')).toBeInTheDocument()
  })

  it('filters out past events in calendar upcoming section', async () => {
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    const pastDate = new Date('2020-01-01')
    mockGetEvents.mockResolvedValue({
      events: [
        { id: 'future1', title: '未来のイベント', startDate: futureDate, endDate: null },
        { id: 'past1', title: '過去のイベント', startDate: pastDate, endDate: null },
      ],
    })
    const { default: Page } = await import('@/app/(main)/events/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(await resolveAsyncJsx(result))
    // 今後のイベントは1件（過去のイベントが除外される）
    expect(screen.getByText('(1件)')).toBeInTheDocument()
  })

  it('sorts upcoming events by date ascending', async () => {
    const laterDate = new Date()
    laterDate.setFullYear(laterDate.getFullYear() + 2)
    const soonerDate = new Date()
    soonerDate.setFullYear(soonerDate.getFullYear() + 1)
    mockGetEvents.mockResolvedValue({
      events: [
        { id: 'later', title: '後のイベント', startDate: laterDate, endDate: null },
        { id: 'sooner', title: '先のイベント', startDate: soonerDate, endDate: null },
      ],
    })
    const { default: Page } = await import('@/app/(main)/events/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(await resolveAsyncJsx(result))
    // EventListのモックがdata-event-countを受け取る
    const eventLists = screen.getAllByTestId('event-list')
    const calendarList = eventLists[0]
    expect(calendarList).toHaveAttribute('data-event-count', '2')
  })

  it('passes region filter params', async () => {
    const { default: Page } = await import('@/app/(main)/events/page')
    const result = await Page({ searchParams: Promise.resolve({ region: '関東', prefecture: '東京都' }) })
    render(await resolveAsyncJsx(result))
    expect(mockGetEvents).toHaveBeenCalledWith(expect.objectContaining({ region: '関東', prefecture: '東京都' }))
  })

  it('passes showPast param', async () => {
    const { default: Page } = await import('@/app/(main)/events/page')
    const result = await Page({ searchParams: Promise.resolve({ showPast: 'true' }) })
    render(await resolveAsyncJsx(result))
    expect(mockGetEvents).toHaveBeenCalledWith(expect.objectContaining({ showPast: true }))
  })

  it('shows event count in list view', async () => {
    mockGetEvents.mockResolvedValue({ events: [{ id: '1' }, { id: '2' }] })
    const { default: Page } = await import('@/app/(main)/events/page')
    const result = await Page({ searchParams: Promise.resolve({ view: 'list' }) })
    render(await resolveAsyncJsx(result))
    expect(screen.getByText('(2件)')).toBeInTheDocument()
  })
})

describe('NewEventPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/events/new/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('renders event form', async () => {
    const { default: Page } = await import('@/app/(main)/events/new/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('イベントを登録')).toBeInTheDocument()
    expect(screen.getByTestId('event-form')).toBeInTheDocument()
    expect(screen.getByText('イベント一覧に戻る')).toBeInTheDocument()
  })
})

describe('ShopsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetShops.mockResolvedValue({ shops: [] })
    mockGetShopGenres.mockResolvedValue({ genres: [] })
  })

  it('renders shops page', async () => {
    const { default: Page } = await import('@/app/(main)/shops/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(await resolveAsyncJsx(result))
    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
    expect(screen.getByText('盆栽園を登録')).toBeInTheDocument()
    expect(screen.getByTestId('map-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('shop-list')).toBeInTheDocument()
  })

  it('shows shop count', async () => {
    mockGetShops.mockResolvedValue({ shops: [{ id: '1' }, { id: '2' }, { id: '3' }] })
    const { default: Page } = await import('@/app/(main)/shops/page')
    const result = await Page({ searchParams: Promise.resolve({}) })
    render(await resolveAsyncJsx(result))
    expect(screen.getByText('(3件)')).toBeInTheDocument()
  })

  it('passes search params', async () => {
    const { default: Page } = await import('@/app/(main)/shops/page')
    const result = await Page({ searchParams: Promise.resolve({ search: 'test', genre: 'g1', sort: 'rating' }) })
    render(await resolveAsyncJsx(result))
    expect(mockGetShops).toHaveBeenCalledWith(expect.objectContaining({ search: 'test', genreId: 'g1', sortBy: 'rating' }))
  })
})

describe('NewShopPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetShopGenres.mockResolvedValue({ genres: [] })
  })

  it('renders shop form', async () => {
    const { default: Page } = await import('@/app/(main)/shops/new/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('盆栽園を登録')).toBeInTheDocument()
    expect(screen.getByTestId('shop-form')).toBeInTheDocument()
    expect(screen.getByText('盆栽園マップに戻る')).toBeInTheDocument()
  })
})
