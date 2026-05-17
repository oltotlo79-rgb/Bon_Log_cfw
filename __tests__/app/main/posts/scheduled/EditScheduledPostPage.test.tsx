import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    scheduledPost: { findFirst: vi.fn() },
  },
}))
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn(),
  getMembershipLimits: vi.fn(),
}))
vi.mock('@/lib/actions/post', () => ({ getGenres: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('next/link', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('lucide-react', () => ({ ArrowLeft: () => <span data-testid="arrow-left" /> }))
vi.mock('@/components/post/ScheduledPostForm', () => ({
  ScheduledPostForm: (props: Record<string, unknown>) => <div data-testid="scheduled-form" data-edit-id={(props.editData as { id: string })?.id} />,
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isPremiumUser, getMembershipLimits } from '@/lib/premium'
import { getGenres } from '@/lib/actions/post'
import { redirect, notFound } from 'next/navigation'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockIsPremium = isPremiumUser as ReturnType<typeof vi.fn>
const mockGetLimits = getMembershipLimits as ReturnType<typeof vi.fn>
const mockGetGenres = getGenres as ReturnType<typeof vi.fn>

function makeScheduledPost() {
  return {
    id: 'sp-1',
    content: 'Scheduled content',
    scheduledAt: new Date('2025-12-01'),
    genres: [{ genreId: 'g1' }],
    media: [{ url: '/img.jpg', type: 'image', sortOrder: 0 }],
  }
}

describe('EditScheduledPostPage', async () => {
  let Page: typeof import('@/app/(main)/posts/scheduled/[id]/edit/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetGenres.mockResolvedValue({ genres: { '松柏': [{ id: 'g1', name: '黒松' }] } } as never)
    mockGetLimits.mockResolvedValue({ maxPosts: 20, maxMedia: 4, maxContent: 500, maxScheduledPosts: 10 } as never)

    const mod = await import('@/app/(main)/posts/scheduled/[id]/edit/page')
    Page = mod.default
  })

  it('redirects to login when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as never)

    await expect(
      Page({ params: Promise.resolve({ id: 'sp-1' }) })
    ).rejects.toThrow('REDIRECT:/login')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to scheduled when not premium', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me' }, expires: '' } as never)
    mockIsPremium.mockResolvedValue(false)

    await expect(
      Page({ params: Promise.resolve({ id: 'sp-1' }) })
    ).rejects.toThrow('REDIRECT:/posts/scheduled')
  })

  it('calls notFound when scheduled post not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me' }, expires: '' } as never)
    mockIsPremium.mockResolvedValue(true)
    ;(prisma.scheduledPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    await expect(
      Page({ params: Promise.resolve({ id: 'sp-1' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('renders edit form when authorized', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'me' }, expires: '' } as never)
    mockIsPremium.mockResolvedValue(true)
    ;(prisma.scheduledPost.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(makeScheduledPost())

    const result = await Page({ params: Promise.resolve({ id: 'sp-1' }) })
    render(result)

    expect(screen.getByText('予約投稿を編集')).toBeInTheDocument()
    expect(screen.getByTestId('scheduled-form')).toHaveAttribute('data-edit-id', 'sp-1')
  })
})
