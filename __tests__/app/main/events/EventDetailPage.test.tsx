import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/event', () => ({ getEvent: vi.fn() }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/image', () => ({ __esModule: true, default: (props: Record<string, unknown>) => <span data-testid="image" {...props} /> }))
vi.mock('@/app/(main)/events/[id]/DeleteEventButton', () => ({
  DeleteEventButton: () => <button data-testid="delete-btn">Delete</button>,
}))
vi.mock('@/components/seo/JsonLd', () => ({
  EventJsonLd: () => <script data-testid="json-ld" />,
  BreadcrumbJsonLd: () => <script data-testid="breadcrumb-json-ld" />,
}))

import { getEvent } from '@/lib/actions/event'
import { notFound } from 'next/navigation'

const mockGetEvent = getEvent as ReturnType<typeof vi.fn>

function makeEvent(overrides = {}) {
  return {
    id: 'evt-1',
    title: 'Bonsai Exhibition',
    startDate: new Date('2025-06-01T10:00:00Z'),
    endDate: new Date('2025-06-02T18:00:00Z'),
    prefecture: '東京都',
    city: '台東区',
    venue: '上野公園',
    organizer: 'Bonsai Society',
    admissionFee: '500円',
    externalUrl: 'https://example.com',
    description: 'Great event',
    hasSales: true,
    isOwner: false,
    creator: { id: 'u1', nickname: 'Creator', avatarUrl: null },
    ...overrides,
  }
}

describe('EventDetailPage', async () => {
  let Page: typeof import('@/app/(main)/events/[id]/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/events/[id]/page')
    Page = mod.default
  }, 20000)

  it('renders event details', async () => {
    mockGetEvent.mockResolvedValue({ success: true, data: { event: makeEvent() } } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await Page({ params: Promise.resolve({ id: 'evt-1' }) })
    render(result)

    expect(screen.getByRole('heading', { name: 'Bonsai Exhibition' })).toBeInTheDocument()
    expect(screen.getByText('東京都 台東区')).toBeInTheDocument()
    expect(screen.getByText('上野公園')).toBeInTheDocument()
    expect(screen.getByText(/主催: Bonsai Society/)).toBeInTheDocument()
    expect(screen.getByText(/入場料: 500円/)).toBeInTheDocument()
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
    expect(screen.getByText('Great event')).toBeInTheDocument()
    expect(screen.getByText('即売あり')).toBeInTheDocument()
  }, 20000)

  it('calls notFound when event not found', async () => {
    mockGetEvent.mockResolvedValue({ success: false, error: 'Not found' } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    await expect(
      Page({ params: Promise.resolve({ id: 'none' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('shows ended badge for past events', async () => {
    mockGetEvent.mockResolvedValue({
      success: true,
      data: {
        event: makeEvent({
          startDate: new Date('2020-01-01'),
          endDate: new Date('2020-01-02'),
        }),
      },
    } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await Page({ params: Promise.resolve({ id: 'evt-1' }) })
    render(result)

    expect(screen.getByText('終了')).toBeInTheDocument()
  })

  it('shows edit/delete buttons for owner', async () => {
    mockGetEvent.mockResolvedValue({
      success: true,
      data: { event: makeEvent({ isOwner: true }) },
    } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await Page({ params: Promise.resolve({ id: 'evt-1' }) })
    render(result)

    expect(screen.getByText('編集')).toBeInTheDocument()
    expect(screen.getByTestId('delete-btn')).toBeInTheDocument()
  })

  it('shows creator info', async () => {
    mockGetEvent.mockResolvedValue({
      success: true,
      data: { event: makeEvent({ creator: { id: 'u1', nickname: 'Alice', avatarUrl: '/a.jpg' } }) },
    } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await Page({ params: Promise.resolve({ id: 'evt-1' }) })
    render(result)

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows ongoing badge for current events', async () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000)
    const tomorrow = new Date(now.getTime() + 86400000)
    mockGetEvent.mockResolvedValue({
      success: true,
      data: { event: makeEvent({ startDate: yesterday, endDate: tomorrow }) },
    } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await Page({ params: Promise.resolve({ id: 'evt-1' }) })
    render(result)

    expect(screen.getByText('開催中')).toBeInTheDocument()
  })

  it('does not show edit/delete for non-owner', async () => {
    mockGetEvent.mockResolvedValue({
      success: true,
      data: { event: makeEvent({ isOwner: false }) },
    } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await Page({ params: Promise.resolve({ id: 'evt-1' }) })
    render(result)

    expect(screen.queryByText('編集')).not.toBeInTheDocument()
  })

  it('renders event without optional fields', async () => {
    mockGetEvent.mockResolvedValue({
      success: true,
      data: {
        event: makeEvent({
          organizer: null,
          admissionFee: null,
          externalUrl: null,
          description: null,
          endDate: null,
          hasSales: false,
        }),
      },
    } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await Page({ params: Promise.resolve({ id: 'evt-1' }) })
    render(result)

    expect(screen.getByRole('heading', { name: 'Bonsai Exhibition' })).toBeInTheDocument()
    expect(screen.queryByText(/主催:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/入場料:/)).not.toBeInTheDocument()
    expect(screen.queryByText('即売あり')).not.toBeInTheDocument()
  })

  it('renders creator without avatar', async () => {
    mockGetEvent.mockResolvedValue({
      success: true,
      data: { event: makeEvent({ creator: { id: 'u1', nickname: 'NoAvatar', avatarUrl: null } }) },
    } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await Page({ params: Promise.resolve({ id: 'evt-1' }) })
    render(result)

    expect(screen.getByText('NoAvatar')).toBeInTheDocument()
  })
})

describe('generateMetadata for events', async () => {
  let generateMetadata: typeof import('@/app/(main)/events/[id]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/events/[id]/page')
    generateMetadata = mod.generateMetadata
  })

  it('returns event metadata', async () => {
    mockGetEvent.mockResolvedValue({
      success: true,
      data: { event: makeEvent() },
    } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'evt-1' }) })
    expect(result.title).toBe('Bonsai Exhibition | BON-LOG')
  })

  it('returns fallback when not found', async () => {
    mockGetEvent.mockResolvedValue({ success: false, error: 'Not found' } as ReturnType<typeof getEvent> extends Promise<infer T> ? T : never)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('イベントが見つかりません')
  })
})
