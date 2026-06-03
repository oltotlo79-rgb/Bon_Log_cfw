import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockPostFindFirst = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: { post: { findFirst: (...args: unknown[]) => mockPostFindFirst(...args) } },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/premium', () => ({ getMembershipLimits: vi.fn() }))
vi.mock('@/lib/actions/post', () => ({ getGenres: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('REDIRECT')
  }),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('@/components/post/PostEditForm', () => ({
  PostEditForm: (props: { editData: { id: string; content: string | null; genreIds: string[]; media: unknown[] } }) => (
    <div
      data-testid="post-edit-form"
      data-editid={props.editData.id}
      data-content={props.editData.content ?? ''}
      data-genres={props.editData.genreIds.join(',')}
      data-media-count={props.editData.media.length}
    />
  ),
}))

import { auth } from '@/lib/auth'
import { getMembershipLimits } from '@/lib/premium'
import { getGenres } from '@/lib/actions/post'
import { redirect, notFound } from 'next/navigation'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockGetMembershipLimits = getMembershipLimits as ReturnType<typeof vi.fn>
const mockGetGenres = getGenres as ReturnType<typeof vi.fn>

describe('EditPostPage', async () => {
  let Page: typeof import('@/app/(main)/posts/[id]/edit/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetGenres.mockResolvedValue({ genres: { 樹種: [{ id: 'g1', name: '松柏類', category: '樹種' }] } } as never)
    mockGetMembershipLimits.mockResolvedValue({ maxPostLength: 500, maxImages: 4, maxVideos: 1 } as never)
    const mod = await import('@/app/(main)/posts/[id]/edit/page')
    Page = mod.default
  })

  it('未認証なら /login にリダイレクトする', async () => {
    mockAuth.mockResolvedValue(null as never)

    await expect(Page({ params: Promise.resolve({ id: 'post-1' }) })).rejects.toThrow('REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
    expect(mockPostFindFirst).not.toHaveBeenCalled()
  })

  it('編集可能な投稿が無ければ notFound を呼ぶ（他人の投稿・純粋リポスト・不存在）', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never)
    mockPostFindFirst.mockResolvedValue(null)

    await expect(Page({ params: Promise.resolve({ id: 'post-1' }) })).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
    // 所有者・純粋リポスト除外の条件で問い合わせていること
    expect(mockPostFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post-1', userId: 'u1', repostPostId: null },
      }),
    )
  })

  it('所有者なら editData を組み立てて PostEditForm を描画する', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as never)
    mockPostFindFirst.mockResolvedValue({
      id: 'post-1',
      content: '本文',
      userId: 'u1',
      repostPostId: null,
      media: [
        { url: 'https://example.com/a.webp', type: 'image', sortOrder: 0 },
        { url: 'https://example.com/b.webp', type: 'image', sortOrder: 1 },
      ],
      genres: [{ genreId: 'g1' }, { genreId: 'g2' }],
    })

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    const form = screen.getByTestId('post-edit-form')
    expect(form).toHaveAttribute('data-editid', 'post-1')
    expect(form).toHaveAttribute('data-content', '本文')
    expect(form).toHaveAttribute('data-genres', 'g1,g2')
    expect(form).toHaveAttribute('data-media-count', '2')
  })
})
