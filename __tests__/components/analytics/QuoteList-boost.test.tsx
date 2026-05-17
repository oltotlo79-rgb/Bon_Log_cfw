import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { QuoteList } from '@/components/analytics/QuoteList'

/**
 * QuoteList - ブランチカバレッジ向上テスト
 * formatRelativeTime の各ブランチ（週間前、ヶ月前）、
 * originalContentなし、contentなしのバリエーションをカバー
 */

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="avatar">{children}</div>
  ),
  AvatarImage: ({ src, alt }: { src?: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    src ? <img src={src} alt={alt} data-testid="avatar-image" /> : null
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="avatar-fallback">{children}</span>
  ),
}))

const createQuote = (overrides: Record<string, unknown> = {}) => ({
  id: 'quote-1',
  content: '引用コンテンツ',
  user: {
    id: 'user-1',
    nickname: 'テストユーザー',
    avatarUrl: null,
  },
  originalPostId: 'post-1',
  originalContent: '元の投稿',
  likeCount: 5,
  commentCount: 3,
  createdAt: new Date(),
  ...overrides,
})

describe('QuoteList - ブランチカバレッジ向上', () => {
  describe('formatRelativeTime のブランチ', () => {
    it('3日前を表示する', () => {
      const quote = createQuote({
        id: 'q-3days',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      })
      render(<QuoteList quotes={[quote]} />)
      expect(screen.getByText('3日前')).toBeInTheDocument()
    })

    it('6日前を表示する', () => {
      const quote = createQuote({
        id: 'q-6days',
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      })
      render(<QuoteList quotes={[quote]} />)
      expect(screen.getByText('6日前')).toBeInTheDocument()
    })

    it('2週間前を表示する', () => {
      const quote = createQuote({
        id: 'q-2weeks',
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      })
      render(<QuoteList quotes={[quote]} />)
      expect(screen.getByText('2週間前')).toBeInTheDocument()
    })

    it('3週間前を表示する', () => {
      const quote = createQuote({
        id: 'q-3weeks',
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      })
      render(<QuoteList quotes={[quote]} />)
      expect(screen.getByText('3週間前')).toBeInTheDocument()
    })

    it('1ヶ月前を表示する', () => {
      const quote = createQuote({
        id: 'q-1month',
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      })
      render(<QuoteList quotes={[quote]} />)
      expect(screen.getByText('1ヶ月前')).toBeInTheDocument()
    })

    it('3ヶ月前を表示する', () => {
      const quote = createQuote({
        id: 'q-3months',
        createdAt: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000),
      })
      render(<QuoteList quotes={[quote]} />)
      expect(screen.getByText('3ヶ月前')).toBeInTheDocument()
    })
  })

  describe('コンテンツのバリエーション', () => {
    it('originalContentがnullの場合は引用元を表示しない', () => {
      const quote = createQuote({
        id: 'q-no-original',
        originalContent: null,
      })
      render(<QuoteList quotes={[quote]} />)
      expect(screen.queryByText(/引用元:/)).not.toBeInTheDocument()
    })

    it('contentがnullでoriginalContentがある場合', () => {
      const quote = createQuote({
        id: 'q-null-content',
        content: null,
        originalContent: '元の投稿内容',
      })
      render(<QuoteList quotes={[quote]} />)
      expect(screen.queryByText('引用コンテンツ')).not.toBeInTheDocument()
      expect(screen.getByText(/元の投稿内容/)).toBeInTheDocument()
    })

    it('両方nullの場合', () => {
      const quote = createQuote({
        id: 'q-both-null',
        content: null,
        originalContent: null,
      })
      render(<QuoteList quotes={[quote]} />)
      // ユーザー名は表示される
      expect(screen.getByText('テストユーザー')).toBeInTheDocument()
      // コンテンツ関連は表示されない
      expect(screen.queryByText(/引用元:/)).not.toBeInTheDocument()
    })
  })
})
