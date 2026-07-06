import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * SearchResultsContent (検索ページの Suspense 境界コンテンツ) のテスト。
 * tab ごとに異なる検索 Server Action を呼び分け、ActionResult エラー時は
 * 空配列にフォールバックする振る舞いを検証する。
 */

const mockSearchPosts = vi.fn()
const mockSearchUsers = vi.fn()
const mockSearchByTag = vi.fn()
vi.mock('@/lib/actions/search', () => ({
  searchPosts: (...args: unknown[]) => mockSearchPosts(...args),
  searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
  searchByTag: (...args: unknown[]) => mockSearchByTag(...args),
}))

vi.mock('@/components/search/SearchResults', () => ({
  PostSearchResults: ({ query, genreIds, initialPosts, currentUserId, filters }: {
    query: string; genreIds?: string[]; initialPosts: unknown[]; currentUserId?: string; filters?: Record<string, unknown>
  }) => (
    <div
      data-testid="post-results"
      data-query={query}
      data-genre-ids={JSON.stringify(genreIds ?? null)}
      data-post-count={initialPosts.length}
      data-user-id={currentUserId ?? ''}
      data-filters={JSON.stringify(filters ?? null)}
    />
  ),
  UserSearchResults: ({ query, initialUsers }: { query: string; initialUsers: unknown[] }) => (
    <div data-testid="user-results" data-query={query} data-user-count={initialUsers.length} />
  ),
  TagSearchResults: ({ tag, initialPosts, currentUserId }: { tag: string; initialPosts: unknown[]; currentUserId?: string }) => (
    <div data-testid="tag-results" data-tag={tag} data-post-count={initialPosts.length} data-user-id={currentUserId ?? ''} />
  ),
}))

describe('SearchResultsContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('tab=posts', () => {
    it('検索結果を PostSearchResults に渡す', async () => {
      mockSearchPosts.mockResolvedValue({ success: true, data: { posts: [{ id: 'p1' }, { id: 'p2' }] } })

      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      const result = await SearchResultsContent({ tab: 'posts', query: '松', genreIds: [], currentUserId: 'user-1' })
      render(result)

      const el = screen.getByTestId('post-results')
      expect(el).toHaveAttribute('data-post-count', '2')
      expect(el).toHaveAttribute('data-genre-ids', 'null')
      expect(mockSearchPosts).toHaveBeenCalledWith('松', undefined, undefined, expect.any(Number), undefined)
    })

    it('genreIds が指定されている場合はそのまま渡す', async () => {
      mockSearchPosts.mockResolvedValue({ success: true, data: { posts: [] } })

      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      await SearchResultsContent({ tab: 'posts', query: '松', genreIds: ['g1', 'g2'] })

      expect(mockSearchPosts).toHaveBeenCalledWith('松', ['g1', 'g2'], undefined, expect.any(Number), undefined)
    })

    it('filters が PostSearchResults に伝播する', async () => {
      mockSearchPosts.mockResolvedValue({ success: true, data: { posts: [] } })
      const filters = { minLikes: 10, mediaType: 'images' as const }

      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      const result = await SearchResultsContent({ tab: 'posts', query: '松', genreIds: [], filters })
      render(result)

      expect(screen.getByTestId('post-results')).toHaveAttribute('data-filters', JSON.stringify(filters))
      expect(mockSearchPosts).toHaveBeenCalledWith('松', undefined, undefined, expect.any(Number), filters)
    })

    it('ActionResult エラー時は空配列にフォールバックする', async () => {
      mockSearchPosts.mockResolvedValue({ success: false, error: 'search failed' })

      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      const result = await SearchResultsContent({ tab: 'posts', query: '松', genreIds: [] })
      render(result)

      expect(screen.getByTestId('post-results')).toHaveAttribute('data-post-count', '0')
    })
  })

  describe('tab=users', () => {
    it('検索結果を UserSearchResults に渡す', async () => {
      mockSearchUsers.mockResolvedValue({ success: true, data: { users: [{ id: 'u1' }] } })

      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      const result = await SearchResultsContent({ tab: 'users', query: '盆栽太郎', genreIds: [] })
      render(result)

      const el = screen.getByTestId('user-results')
      expect(el).toHaveAttribute('data-user-count', '1')
      expect(mockSearchUsers).toHaveBeenCalledWith('盆栽太郎')
    })

    it('ActionResult エラー時は空配列にフォールバックする', async () => {
      mockSearchUsers.mockResolvedValue({ success: false, error: 'x' })

      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      const result = await SearchResultsContent({ tab: 'users', query: 'q', genreIds: [] })
      render(result)

      expect(screen.getByTestId('user-results')).toHaveAttribute('data-user-count', '0')
    })
  })

  describe('tab=tags', () => {
    it('クエリが空の場合は案内メッセージを表示し、検索を実行しない', async () => {
      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      const result = await SearchResultsContent({ tab: 'tags', query: '', genreIds: [] })
      render(result)

      expect(screen.getByText('検索したいタグを入力してください')).toBeInTheDocument()
      expect(mockSearchByTag).not.toHaveBeenCalled()
    })

    it('検索結果を TagSearchResults に渡す', async () => {
      mockSearchByTag.mockResolvedValue({ success: true, data: { posts: [{ id: 'p1' }] } })

      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      const result = await SearchResultsContent({ tab: 'tags', query: '黒松', genreIds: [], currentUserId: 'user-1' })
      render(result)

      const el = screen.getByTestId('tag-results')
      expect(el).toHaveAttribute('data-tag', '黒松')
      expect(el).toHaveAttribute('data-post-count', '1')
      expect(mockSearchByTag).toHaveBeenCalledWith('黒松')
    })

    it('ActionResult エラー時は空配列にフォールバックする', async () => {
      mockSearchByTag.mockResolvedValue({ success: false, error: 'x' })

      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      const result = await SearchResultsContent({ tab: 'tags', query: '黒松', genreIds: [] })
      render(result)

      expect(screen.getByTestId('tag-results')).toHaveAttribute('data-post-count', '0')
    })
  })

  describe('未知の tab', () => {
    it('null を返す（何も描画しない）', async () => {
      const { SearchResultsContent } = await import('@/app/(main)/search/SearchResultsContent')
      const result = await SearchResultsContent({ tab: 'unknown', query: 'q', genreIds: [] })

      expect(result).toBeNull()
    })
  })
})

describe('SearchResultsLoading', () => {
  it('3件分のプレースホルダーを描画する', async () => {
    const { SearchResultsLoading } = await import('@/app/(main)/search/SearchResultsContent')
    const { container } = render(<SearchResultsLoading />)

    expect(container.querySelectorAll('.animate-pulse').length).toBe(3)
  })
})
