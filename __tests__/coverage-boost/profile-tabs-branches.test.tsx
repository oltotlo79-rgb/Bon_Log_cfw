import { vi } from 'vitest'
/**
 * ProfileTabs ブランチカバレッジ向上テスト
 */
import { render, screen } from '../utils/test-utils'
import userEvent from '@testing-library/user-event'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string; content?: string } }) => (
    <div data-testid={`post-card-${post.id}`}>{post.content || 'post'}</div>
  ),
}))

vi.mock('@/lib/actions/like', () => ({ toggleLike: vi.fn() }))
vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn() }))

import { ProfileTabs } from '@/components/user/ProfileTabs'
import type { Post } from '@/types/post'

function createComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comment-1',
    content: 'テストコメント',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    media: [] as { id: string; url: string; type: string; sortOrder: number }[],
    post: {
      id: 'post-1',
      content: '元の投稿内容',
    },
    ...overrides,
  }
}

describe('ProfileTabs ブランチカバレッジ', () => {
  const user = userEvent.setup()

  describe('投稿タブ', () => {
    it('投稿が空の場合「まだ投稿がありません」を表示する', () => {
      render(<ProfileTabs posts={[]} comments={[]} />)
      expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument()
    })

    it('投稿がある場合PostCardを表示する', () => {
      const posts = [
        { id: 'post-1', content: '最初の投稿' },
        { id: 'post-2', content: '2番目の投稿' },
      ] as unknown as Post[]
      render(<ProfileTabs posts={posts} comments={[]} />)
      expect(screen.getByTestId('post-card-post-1')).toBeInTheDocument()
      expect(screen.getByTestId('post-card-post-2')).toBeInTheDocument()
    })

    it('currentUserIdをPostCardに渡す', () => {
      const posts = [{ id: 'post-1', content: '投稿' }] as unknown as Post[]
      render(<ProfileTabs posts={posts} comments={[]} currentUserId="user-1" />)
      expect(screen.getByTestId('post-card-post-1')).toBeInTheDocument()
    })
  })

  describe('コメントタブ', () => {
    it('コメントが空の場合「まだコメントがありません」を表示する', async () => {
      render(<ProfileTabs posts={[]} comments={[]} />)
      await user.click(screen.getByRole('tab', { name: /コメント/i }))
      expect(screen.getByText('まだコメントがありません')).toBeInTheDocument()
    })

    it('コメントがある場合コメント内容を表示する', async () => {
      const comments = [createComment({ id: 'c1', content: 'コメントテキスト' })]
      render(<ProfileTabs posts={[]} comments={comments} />)
      await user.click(screen.getByRole('tab', { name: /コメント/i }))
      expect(screen.getByText('コメントテキスト')).toBeInTheDocument()
    })

    it('画像メディアがある場合Imageを表示する', async () => {
      const comments = [
        createComment({
          id: 'c-img',
          media: [{ id: 'm1', url: '/test.jpg', type: 'image', sortOrder: 0 }],
        }),
      ]
      render(<ProfileTabs posts={[]} comments={comments} />)
      await user.click(screen.getByRole('tab', { name: /コメント/i }))
      // Image mock renders as img tag
      const imgs = document.querySelectorAll('img')
      expect(imgs.length).toBeGreaterThan(0)
    })

    it('動画メディアがある場合videoを表示する', async () => {
      const comments = [
        createComment({
          id: 'c-vid',
          media: [{ id: 'm2', url: '/test.mp4', type: 'video', sortOrder: 0 }],
        }),
      ]
      render(<ProfileTabs posts={[]} comments={comments} />)
      await user.click(screen.getByRole('tab', { name: /コメント/i }))
      const video = document.querySelector('video')
      expect(video).toBeTruthy()
      expect(video?.getAttribute('src')).toBe('/test.mp4')
    })

    it('投稿内容が50文字を超える場合省略する', async () => {
      const longContent = 'あ'.repeat(60)
      const comments = [
        createComment({
          id: 'c-long',
          post: { id: 'p-long', content: longContent },
        }),
      ]
      render(<ProfileTabs posts={[]} comments={comments} />)
      await user.click(screen.getByRole('tab', { name: /コメント/i }))
      // Format: 「{content.slice(0,50)}...」への返信
      const expectedText = `「${'あ'.repeat(50)}...」への返信`
      expect(screen.getByText(expectedText)).toBeInTheDocument()
    })

    it('投稿内容が50文字以下の場合省略しない', async () => {
      const shortContent = '短い投稿内容'
      const comments = [
        createComment({
          id: 'c-short',
          post: { id: 'p-short', content: shortContent },
        }),
      ]
      render(<ProfileTabs posts={[]} comments={comments} />)
      await user.click(screen.getByRole('tab', { name: /コメント/i }))
      expect(screen.getByText(`「${shortContent}」への返信`)).toBeInTheDocument()
    })

    it('投稿内容がnullの場合「投稿への返信」を表示する', async () => {
      const comments = [
        createComment({
          id: 'c-null',
          post: { id: 'p-null', content: null },
        }),
      ]
      render(<ProfileTabs posts={[]} comments={comments} />)
      await user.click(screen.getByRole('tab', { name: /コメント/i }))
      expect(screen.getByText('投稿への返信')).toBeInTheDocument()
    })

    it('メディアが空の場合メディアセクションを表示しない', async () => {
      const comments = [createComment({ id: 'c-nomedia', media: [] })]
      render(<ProfileTabs posts={[]} comments={comments} />)
      await user.click(screen.getByRole('tab', { name: /コメント/i }))
      expect(document.querySelector('video')).not.toBeInTheDocument()
    })

    it('ちょうど50文字の投稿内容は省略しない', async () => {
      const content50 = 'あ'.repeat(50)
      const comments = [
        createComment({
          id: 'c-50',
          post: { id: 'p-50', content: content50 },
        }),
      ]
      render(<ProfileTabs posts={[]} comments={comments} />)
      await user.click(screen.getByRole('tab', { name: /コメント/i }))
      expect(screen.getByText(`「${content50}」への返信`)).toBeInTheDocument()
    })
  })
})
