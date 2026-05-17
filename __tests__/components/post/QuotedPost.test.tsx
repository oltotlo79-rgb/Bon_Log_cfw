import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { QuotedPost } from '@/components/post/QuotedPost'

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, className }: {
    src: string
    alt: string
    width?: number
    height?: number
    className?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} className={className} />
  ),
}))

// date-fns モック
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '3時間前',
}))

vi.mock('date-fns/locale', () => ({
  ja: {},
}))

describe('QuotedPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockPost = {
    id: 'quoted-post-1',
    content: '引用元の投稿内容です。盆栽について語っています。',
    createdAt: new Date('2024-01-15T10:00:00Z'),
    user: {
      id: 'user-1',
      nickname: '盆栽マスター',
      avatarUrl: '/avatar.jpg',
    },
  }

  it('引用投稿の内容とユーザー情報を表示する', () => {
    render(<QuotedPost post={mockPost} />)

    expect(screen.getByText(mockPost.content)).toBeInTheDocument()
    expect(screen.getByText(mockPost.user.nickname)).toBeInTheDocument()
    expect(screen.getByText('3時間前')).toBeInTheDocument()
  })

  it('投稿詳細ページへのリンクを設定する', () => {
    render(<QuotedPost post={mockPost} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `/posts/${mockPost.id}`)
  })

  it('アバター画像を表示する', () => {
    render(<QuotedPost post={mockPost} />)

    const avatar = screen.getByAltText(mockPost.user.nickname)
    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveAttribute('src', mockPost.user.avatarUrl)
  })

  it('アバターがない場合はニックネームの頭文字を表示する', () => {
    const postWithoutAvatar = {
      ...mockPost,
      user: { ...mockPost.user, avatarUrl: null },
    }

    render(<QuotedPost post={postWithoutAvatar} />)

    expect(screen.getByText('盆')).toBeInTheDocument()
  })

  it('contentがnullの場合は本文を表示しない', () => {
    const postWithoutContent = {
      ...mockPost,
      content: null,
    }

    render(<QuotedPost post={postWithoutContent} />)

    expect(screen.getByText(mockPost.user.nickname)).toBeInTheDocument()
    // contentのparagraphは存在しない
    expect(screen.queryByText(mockPost.content)).not.toBeInTheDocument()
  })
})
