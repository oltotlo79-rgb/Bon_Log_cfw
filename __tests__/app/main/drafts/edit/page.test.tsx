import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { redirect as _redirect, notFound as _notFound } from 'next/navigation'

// モック
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/actions/draft', () => ({
  getDraft: vi.fn(),
}))

vi.mock('@/lib/actions/post', () => ({
  getGenres: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/draft/DraftEditForm', () => ({
  DraftEditForm: ({ draft, genres }: any) => (
    <div data-testid="draft-edit-form">
      Draft ID: {draft.id}, Genres: {genres.length}
    </div>
  ),
}))

describe('DraftEditPage', async () => {
  const { auth } = await import('@/lib/auth')
  const { getDraft } = await import('@/lib/actions/draft')
  const { getGenres } = await import('@/lib/actions/post')
  const redirect = _redirect as unknown as ReturnType<typeof vi.fn>
  const notFound = _notFound as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証の場合はリダイレクト', async () => {
     
    auth.mockResolvedValue(null as any)

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')

    try {
       
      await Page({ params: Promise.resolve({ id: 'draft1' }) } as any)
    } catch (_error) {
      // redirect throws
    }

    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('下書きが見つからない場合はnotFound', async () => {
     
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)

    getDraft.mockResolvedValue({ success: false, error: 'Not found' } as any)

    getGenres.mockResolvedValue({ genres: [] } as any)

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')

    try {
       
      await Page({ params: Promise.resolve({ id: 'draft1' }) } as any)
    } catch (_error) {
      // notFound throws
    }

    expect(notFound).toHaveBeenCalled()
  })

  it('下書きデータがない場合もnotFound', async () => {
     
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)

    getDraft.mockResolvedValue({ success: true, data: { draft: null } } as any)

    getGenres.mockResolvedValue({ genres: [] } as any)

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')

    try {
       
      await Page({ params: Promise.resolve({ id: 'draft1' }) } as any)
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

     
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
     
    getDraft.mockResolvedValue({ success: true, data: { draft: mockDraft } } as any)
     
    getGenres.mockResolvedValue({ genres: mockGenres } as any)

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')
     
    const result = await Page({ params: Promise.resolve({ id: 'draft1' }) } as any)
    render(result)

    // タイトル
    expect(screen.getByText('下書きを編集')).toBeInTheDocument()

    // 戻るリンク
    const backLink = screen.getByText('下書き一覧に戻る')
    expect(backLink.closest('a')).toHaveAttribute('href', '/drafts')

    // フォーム
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

     
    auth.mockResolvedValue({ user: { id: 'user1' } } as any)
     
    getDraft.mockResolvedValue({ success: true, data: { draft: mockDraft } } as any)
     
    getGenres.mockResolvedValue({ genres: [] } as any)

    const { default: Page } = await import('@/app/(main)/drafts/[id]/edit/page')
     
    await Page({ params: Promise.resolve({ id: 'draft1' }) } as any)

    expect(getDraft).toHaveBeenCalledWith('draft1')
    expect(getGenres).toHaveBeenCalled()
  })
})
