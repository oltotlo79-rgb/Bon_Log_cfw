import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { mockUser } from '../../utils/test-utils'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockHidePost = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => '/feed',
}))
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
vi.mock('@/components/post/PostCardIcons', () => ({
  MoreHorizontalIcon: () => <svg data-testid="more-icon" />,
  EyeOffIcon: () => <svg data-testid="eye-off-icon" />,
}))
vi.mock('@/components/post/DeletePostButton', () => ({
  DeletePostButton: ({ postId }: { postId: string }) => (
    <button data-testid="delete-post-button" data-post-id={postId}>削除</button>
  ),
}))
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => <button data-testid="report-button">通報</button>,
}))
vi.mock('@/lib/actions/hide-post', () => ({
  hidePost: (...args: unknown[]) => mockHidePost(...args),
}))
const mockPinPost = vi.fn()
const mockUnpinPost = vi.fn()
vi.mock('@/lib/actions/pin-post', () => ({
  pinPost: (...args: unknown[]) => mockPinPost(...args),
  unpinPost: (...args: unknown[]) => mockUnpinPost(...args),
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))
vi.mock('@/lib/constants/routes', () => ({
  ROUTE_FEED: '/feed',
}))

const testUser = {
  id: mockUser.id,
  nickname: mockUser.nickname,
  avatarUrl: mockUser.avatarUrl,
}

async function importComponent() {
  const { PostCardHeader } = await import('@/components/post/PostCardHeader')
  return PostCardHeader
}

describe('PostCardHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockHidePost.mockResolvedValue({ success: true })
    mockPinPost.mockResolvedValue({ success: true })
    mockUnpinPost.mockResolvedValue({ success: true })
  })

  describe('基本表示', () => {
    it('ユーザー名が表示される', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={testUser}
          timeAgo="1時間前"
          postId="post-1"
          isOwner={false}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      expect(screen.getByTestId('post-author')).toHaveTextContent(testUser.nickname)
    })

    it('相対時刻が表示される', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={testUser}
          timeAgo="2時間前"
          postId="post-1"
          isOwner={false}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      expect(screen.getByTestId('post-time')).toHaveTextContent('2時間前')
    })

    it('アバター画像が表示される', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={testUser}
          timeAgo="1分前"
          postId="post-1"
          isOwner={false}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      const img = screen.getByAltText(testUser.nickname)
      expect(img).toBeInTheDocument()
      expect(img).toHaveAttribute('src', testUser.avatarUrl)
    })

    it('avatarUrl がない場合はイニシャルが表示される', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={{ ...testUser, avatarUrl: null }}
          timeAgo="1分前"
          postId="post-1"
          isOwner={false}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      // ニックネームの最初の文字が表示される
      expect(screen.getByText(testUser.nickname.charAt(0))).toBeInTheDocument()
    })

    it('ユーザーアバターが /users/:id へのリンクになっている', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={testUser}
          timeAgo="1分前"
          postId="post-1"
          isOwner={false}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      const links = screen.getAllByRole('link')
      const userLinks = links.filter(l => l.getAttribute('href') === `/users/${testUser.id}`)
      expect(userLinks.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('メニューボタン', () => {
    it('ケバブメニューボタンをクリックするとメニューが開く', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={testUser}
          timeAgo="1分前"
          postId="post-1"
          isOwner={true}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      const menuButton = screen.getByTestId('post-menu-button')
      fireEvent.click(menuButton)
      const dropdown = screen.getByTestId('post-menu-dropdown')
      expect(dropdown).toBeInTheDocument()
      // 「プロフィールに固定」等の長いラベルが折り返さないこと
      expect(dropdown).toHaveClass('whitespace-nowrap')
    })

    it('オーナーかつ非リポストの場合に削除ボタンが表示される', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={testUser}
          timeAgo="1分前"
          postId="post-1"
          isOwner={true}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      fireEvent.click(screen.getByTestId('post-menu-button'))
      expect(screen.getByTestId('delete-post-button')).toBeInTheDocument()
    })

    it('オーナーの場合は非表示ボタンが表示されない', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={testUser}
          timeAgo="1分前"
          postId="post-1"
          isOwner={true}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      fireEvent.click(screen.getByTestId('post-menu-button'))
      expect(screen.queryByTestId('hide-post-button')).not.toBeInTheDocument()
    })

    it('他ユーザーの場合は非表示ボタンと通報ボタンが表示される', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={{ ...testUser, id: 'other-user-id' }}
          timeAgo="1分前"
          postId="post-1"
          isOwner={false}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      fireEvent.click(screen.getByTestId('post-menu-button'))
      expect(screen.getByTestId('hide-post-button')).toBeInTheDocument()
      expect(screen.getByTestId('report-button')).toBeInTheDocument()
    })

    it('未ログインの場合はメニュー内にアクションが表示されない', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={testUser}
          timeAgo="1分前"
          postId="post-1"
          isOwner={false}
          isRepost={false}
          currentUserId={undefined}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      fireEvent.click(screen.getByTestId('post-menu-button'))
      expect(screen.queryByTestId('delete-post-button')).not.toBeInTheDocument()
      expect(screen.queryByTestId('hide-post-button')).not.toBeInTheDocument()
      expect(screen.queryByTestId('report-button')).not.toBeInTheDocument()
    })

    it('リポストの場合はオーナーでも削除ボタンが表示されない', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={testUser}
          timeAgo="1分前"
          postId="post-1"
          isOwner={true}
          isRepost={true}
          currentUserId={mockUser.id}
          displayPostId="post-1"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      fireEvent.click(screen.getByTestId('post-menu-button'))
      expect(screen.queryByTestId('delete-post-button')).not.toBeInTheDocument()
    })
  })

  describe('編集・固定', () => {
    function renderOwner(extra: Record<string, unknown> = {}) {
      return importComponent().then((PostCardHeader) =>
        render(
          <PostCardHeader
            user={testUser}
            timeAgo="1分前"
            postId="post-9"
            isOwner={true}
            isRepost={false}
            currentUserId={mockUser.id}
            displayPostId="post-9"
            disableNavigation={false}
            onHidden={() => {}}
            {...extra}
          />
        )
      )
    }

    it('オーナーのメニューに編集リンクと固定ボタンが表示される', async () => {
      await renderOwner()
      fireEvent.click(screen.getByTestId('post-menu-button'))
      expect(screen.getByTestId('edit-post-link')).toHaveAttribute('href', '/posts/post-9/edit')
      expect(screen.getByTestId('pin-post-button')).toHaveTextContent('プロフィールに固定')
    })

    it('固定ボタンをクリックすると pinPost が呼ばれる', async () => {
      await renderOwner()
      fireEvent.click(screen.getByTestId('post-menu-button'))
      fireEvent.click(screen.getByTestId('pin-post-button'))
      expect(mockPinPost).toHaveBeenCalledWith('post-9')
    })

    it('固定済みの場合はバッジと「固定を解除」を表示し unpinPost を呼ぶ', async () => {
      await renderOwner({ isPinned: true })
      expect(screen.getByTestId('post-pinned-badge')).toBeInTheDocument()
      fireEvent.click(screen.getByTestId('post-menu-button'))
      const pinButton = screen.getByTestId('pin-post-button')
      expect(pinButton).toHaveTextContent('固定を解除')
      fireEvent.click(pinButton)
      expect(mockUnpinPost).toHaveBeenCalled()
      expect(mockPinPost).not.toHaveBeenCalled()
    })

    it('非オーナーには編集・固定が表示されない', async () => {
      const PostCardHeader = await importComponent()
      render(
        <PostCardHeader
          user={{ ...testUser, id: 'other' }}
          timeAgo="1分前"
          postId="post-9"
          isOwner={false}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="post-9"
          disableNavigation={false}
          onHidden={() => {}}
        />
      )
      fireEvent.click(screen.getByTestId('post-menu-button'))
      expect(screen.queryByTestId('edit-post-link')).not.toBeInTheDocument()
      expect(screen.queryByTestId('pin-post-button')).not.toBeInTheDocument()
    })
  })

  describe('非表示アクション', () => {
    it('非表示ボタンをクリックすると hidePost が呼ばれる', async () => {
      const PostCardHeader = await importComponent()
      const onHidden = vi.fn()
      render(
        <PostCardHeader
          user={{ ...testUser, id: 'other-user-id' }}
          timeAgo="1分前"
          postId="post-1"
          isOwner={false}
          isRepost={false}
          currentUserId={mockUser.id}
          displayPostId="display-post-1"
          disableNavigation={false}
          onHidden={onHidden}
        />
      )
      fireEvent.click(screen.getByTestId('post-menu-button'))
      fireEvent.click(screen.getByTestId('hide-post-button'))
      expect(onHidden).toHaveBeenCalled()
    })
  })
})
