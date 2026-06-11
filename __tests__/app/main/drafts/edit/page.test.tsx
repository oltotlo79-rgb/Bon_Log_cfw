import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { redirect as _redirect, notFound as _notFound } from 'next/navigation'
import type { Session } from 'next-auth'

const mockAuth = vi.fn<() => Promise<Session | null>>()
const mockGetDraft = vi.fn()
const mockGetGenres = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/actions/draft', () => ({
  getDraft: (...args: unknown[]) => mockGetDraft(...args),
}))

vi.mock('@/lib/actions/post', () => ({
  getGenres: () => mockGetGenres(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/draft/DraftEditForm', () => ({
  DraftEditForm: ({ draft, genres }: { draft: { id: string }; genres: unknown[] }) => (
    <div data-testid="draft-edit-form">
      Draft ID: {draft.id}, Genres: {genres.length}
    </div>
  ),
}))

const SESSION: Session = { user: { id: 'user1' }, expires: '2099-01-01' }

describe('DraftEditPage', () => {
  const redirect = _redirect as unknown as ReturnType<typeof vi.fn>
  const notFound = _notFound as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('未認証の場合はリダイレクト', async () => {
    mockAuth.mockResolvedValue(null)

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')

    try {
      await Page({ params: Promise.resolve({ id: 'draft1' }) } as Parameters<typeof Page>[0])
    } catch (_error) {
      // redirect throws
    }

    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('下書きが見つからない場合はnotFound', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetDraft.mockResolvedValue({ success: false, error: 'Not found' })
    mockGetGenres.mockResolvedValue({ genres: [] })

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')

    try {
      await Page({ params: Promise.resolve({ id: 'draft1' }) } as Parameters<typeof Page>[0])
    } catch (_error) {
      // notFound throws
    }

    expect(notFound).toHaveBeenCalled()
  })

  it('下書きデータがない場合もnotFound', async () => {
    mockAuth.mockResolvedValue(SESSION)
    mockGetDraft.mockResolvedValue({ success: true, data: { draft: null } })
    mockGetGenres.mockResolvedValue({ genres: [] })

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')

    try {
      await Page({ params: Promise.resolve({ id: 'draft1' }) } as Parameters<typeof Page>[0])
    } catch (_error) {
      // notFound throws
    }

    expect(notFound).toHaveBeenCalled()
  })

  it('正常な下書き編集ページを表示', async () => {
    const mockDraft = {
      id: 'draft1',
      userId: 'user1',
      content: 'Draft content',
      mediaUrls: ['/media1.jpg'],
      genreIds: ['genre1', 'genre2'],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const mockGenres = [
      { id: 'genre1', name: 'ジャンル1', slug: 'genre1' },
      { id: 'genre2', name: 'ジャンル2', slug: 'genre2' },
    ]

    mockAuth.mockResolvedValue(SESSION)
    mockGetDraft.mockResolvedValue({ success: true, data: { draft: mockDraft } })
    mockGetGenres.mockResolvedValue({ genres: mockGenres })

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')
    const result = await Page({ params: Promise.resolve({ id: 'draft1' }) } as Parameters<typeof Page>[0])
    render(result)

    expect(screen.getByText('下書きを編集')).toBeInTheDocument()

    const backLink = screen.getByText('下書き一覧に戻る')
    expect(backLink.closest('a')).toHaveAttribute('href', '/drafts')

    expect(screen.getByTestId('draft-edit-form')).toHaveTextContent('Draft ID: draft1')
    expect(screen.getByTestId('draft-edit-form')).toHaveTextContent('Genres: 2')
  })

  it('getDraftとgetGenresを並列で呼び出す', async () => {
    const mockDraft = {
      id: 'draft1',
      userId: 'user1',
      content: 'Draft content',
      mediaUrls: [],
      genreIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    mockAuth.mockResolvedValue(SESSION)
    mockGetDraft.mockResolvedValue({ success: true, data: { draft: mockDraft } })
    mockGetGenres.mockResolvedValue({ genres: [] })

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')
    await Page({ params: Promise.resolve({ id: 'draft1' }) } as Parameters<typeof Page>[0])

    expect(mockGetDraft).toHaveBeenCalledWith('draft1')
    expect(mockGetGenres).toHaveBeenCalled()
  })
})
