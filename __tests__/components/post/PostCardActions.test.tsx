import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { mockPost, mockUser } from '../../utils/test-utils'

// LikeButton / BookmarkButton を軽くモック
vi.mock('@/components/post/LikeButton', () => ({
  LikeButton: ({ postId, initialLiked, initialCount }: { postId: string; initialLiked: boolean; initialCount: number }) => (
    <button data-testid="like-button" data-post-id={postId} data-liked={initialLiked}>
      {initialCount > 0 && initialCount}
    </button>
  ),
}))
vi.mock('@/components/post/BookmarkButton', () => ({
  BookmarkButton: ({ postId, initialBookmarked }: { postId: string; initialBookmarked: boolean }) => (
    <button data-testid="bookmark-button" data-post-id={postId} data-bookmarked={initialBookmarked} />
  ),
}))
vi.mock('@/components/post/PostCardIcons', () => ({
  HeartIcon: () => <svg data-testid="heart-icon" />,
  MessageCircleIcon: () => <svg data-testid="comment-icon" />,
  RepeatIcon: () => <svg data-testid="repeat-icon" />,
  BookmarkIcon: () => <svg data-testid="bookmark-icon" />,
}))
vi.mock('@/lib/constants/routes', () => ({
  ROUTE_LOGIN: '/login',
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

async function importComponent() {
  const { PostCardActions } = await import('@/components/post/PostCardActions')
  return PostCardActions
}

describe('PostCardActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('ログイン状態', () => {
    it('LikeButton と BookmarkButton が表示される', async () => {
      const PostCardActions = await importComponent()
      render(
        <PostCardActions
          postId={mockPost.id}
          currentUserId={mockUser.id}
          isLiked={false}
          isBookmarked={false}
          likesCount={0}
          commentsCount={0}
        />
      )
      expect(screen.getByTestId('like-button')).toBeInTheDocument()
      expect(screen.getByTestId('bookmark-button')).toBeInTheDocument()
    })

    it('LikeButton に postId が渡される', async () => {
      const PostCardActions = await importComponent()
      render(
        <PostCardActions
          postId={mockPost.id}
          currentUserId={mockUser.id}
          isLiked={true}
          isBookmarked={false}
          likesCount={5}
          commentsCount={0}
        />
      )
      const likeBtn = screen.getByTestId('like-button')
      expect(likeBtn).toHaveAttribute('data-post-id', mockPost.id)
      expect(likeBtn).toHaveAttribute('data-liked', 'true')
      expect(likeBtn).toHaveTextContent('5')
    })

    it('コメントリンクが /posts/:id を向いている', async () => {
      const PostCardActions = await importComponent()
      render(
        <PostCardActions
          postId={mockPost.id}
          currentUserId={mockUser.id}
          isLiked={false}
          isBookmarked={false}
          likesCount={0}
          commentsCount={3}
        />
      )
      const commentLink = screen.getByTestId('comment-link')
      expect(commentLink.closest('a')).toHaveAttribute('href', `/posts/${mockPost.id}`)
    })

    it('commentsCount が 0 のとき数字が表示されない', async () => {
      const PostCardActions = await importComponent()
      render(
        <PostCardActions
          postId={mockPost.id}
          currentUserId={mockUser.id}
          isLiked={false}
          isBookmarked={false}
          likesCount={0}
          commentsCount={0}
        />
      )
      // 0 は表示しない
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })

    it('commentsCount が正の数のときに数字が表示される', async () => {
      const PostCardActions = await importComponent()
      render(
        <PostCardActions
          postId={mockPost.id}
          currentUserId={mockUser.id}
          isLiked={false}
          isBookmarked={false}
          likesCount={0}
          commentsCount={7}
        />
      )
      expect(screen.getByText('7')).toBeInTheDocument()
    })
  })

  describe('未ログイン状態', () => {
    it('いいねはログインページへのリンクになる', async () => {
      const PostCardActions = await importComponent()
      render(
        <PostCardActions
          postId={mockPost.id}
          currentUserId={undefined}
          isLiked={false}
          isBookmarked={false}
          likesCount={2}
          commentsCount={0}
        />
      )
      // LikeButton ではなく Link(/login) が表示される
      expect(screen.queryByTestId('like-button')).not.toBeInTheDocument()
      const links = screen.getAllByRole('link')
      const loginLinks = links.filter(l => l.getAttribute('href') === '/login')
      expect(loginLinks.length).toBeGreaterThanOrEqual(1)
    })

    it('ブックマークはログインページへのリンクになる', async () => {
      const PostCardActions = await importComponent()
      render(
        <PostCardActions
          postId={mockPost.id}
          currentUserId={undefined}
          isLiked={false}
          isBookmarked={false}
          likesCount={0}
          commentsCount={0}
        />
      )
      expect(screen.queryByTestId('bookmark-button')).not.toBeInTheDocument()
    })

    it('likesCount が 0 のとき数字が表示されない（未ログイン）', async () => {
      const PostCardActions = await importComponent()
      render(
        <PostCardActions
          postId={mockPost.id}
          currentUserId={undefined}
          isLiked={false}
          isBookmarked={false}
          likesCount={0}
          commentsCount={0}
        />
      )
      expect(screen.queryByText('0')).not.toBeInTheDocument()
    })
  })

  describe('data-testid', () => {
    it('post-actions コンテナが存在する', async () => {
      const PostCardActions = await importComponent()
      render(
        <PostCardActions
          postId={mockPost.id}
          currentUserId={mockUser.id}
          isLiked={false}
          isBookmarked={false}
          likesCount={0}
          commentsCount={0}
        />
      )
      expect(screen.getByTestId('post-actions')).toBeInTheDocument()
    })
  })
})
