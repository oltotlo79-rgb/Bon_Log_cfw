import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ScheduledPostCard } from '@/components/post/ScheduledPostCard'

// Next.js navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Server Action モック
const mockDeleteScheduledPost = vi.fn()
vi.mock('@/lib/actions/scheduled-post', () => ({
  deleteScheduledPost: (...args: unknown[]) => mockDeleteScheduledPost(...args),
}))

// Next.js Image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} />
  ),
}))

describe('ScheduledPostCard', () => {
  const mockPendingPost = {
    id: 'scheduled-1',
    content: '予約投稿のテスト内容',
    scheduledAt: new Date('2024-06-01T10:30:00'),
    status: 'pending' as const,
    createdAt: new Date('2024-05-01T09:00:00'),
    publishedPostId: null,
    media: [],
    genres: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('予約中のステータスラベルを表示する', () => {
    render(<ScheduledPostCard post={mockPendingPost} />)
    expect(screen.getByText('予約中')).toBeInTheDocument()
  })

  it('公開済みのステータスラベルを表示する', () => {
    const publishedPost = {
      ...mockPendingPost,
      status: 'published' as const,
      publishedPostId: 'post-123',
    }
    render(<ScheduledPostCard post={publishedPost} />)
    expect(screen.getByText('公開済み')).toBeInTheDocument()
  })

  it('失敗のステータスラベルを表示する', () => {
    const failedPost = {
      ...mockPendingPost,
      status: 'failed' as const,
    }
    render(<ScheduledPostCard post={failedPost} />)
    expect(screen.getByText('公開失敗')).toBeInTheDocument()
  })

  it('キャンセルのステータスラベルを表示する', () => {
    const cancelledPost = {
      ...mockPendingPost,
      status: 'cancelled' as const,
    }
    render(<ScheduledPostCard post={cancelledPost} />)
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  it('投稿内容を表示する', () => {
    render(<ScheduledPostCard post={mockPendingPost} />)
    expect(screen.getByText('予約投稿のテスト内容')).toBeInTheDocument()
  })

  it('テキストがない場合は「テキストなし」を表示する', () => {
    const postWithoutContent = { ...mockPendingPost, content: null }
    render(<ScheduledPostCard post={postWithoutContent} />)
    expect(screen.getByText('（テキストなし）')).toBeInTheDocument()
  })

  it('予約中の場合は編集ボタンを表示する', () => {
    render(<ScheduledPostCard post={mockPendingPost} />)
    expect(screen.getByRole('link', { name: /編集/i })).toBeInTheDocument()
  })

  it('予約中の場合は削除ボタンを表示する', () => {
    render(<ScheduledPostCard post={mockPendingPost} />)
    expect(screen.getByRole('button', { name: /削除/i })).toBeInTheDocument()
  })

  it('公開済みの場合は編集・削除ボタンを表示しない', () => {
    const publishedPost = {
      ...mockPendingPost,
      status: 'published' as const,
      publishedPostId: 'post-123',
    }
    render(<ScheduledPostCard post={publishedPost} />)
    expect(screen.queryByRole('link', { name: /編集/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /削除/i })).not.toBeInTheDocument()
  })

  it('公開済みの場合は投稿へのリンクを表示する', () => {
    const publishedPost = {
      ...mockPendingPost,
      status: 'published' as const,
      publishedPostId: 'post-123',
    }
    render(<ScheduledPostCard post={publishedPost} />)
    expect(screen.getByRole('link', { name: /公開された投稿を見る/i })).toHaveAttribute(
      'href',
      '/posts/post-123'
    )
  })

  it('編集リンクのhrefが正しい', () => {
    render(<ScheduledPostCard post={mockPendingPost} />)
    expect(screen.getByRole('link', { name: /編集/i })).toHaveAttribute(
      'href',
      '/posts/scheduled/scheduled-1/edit'
    )
  })

  it('ジャンルを表示する', () => {
    const postWithGenres = {
      ...mockPendingPost,
      genres: [
        { genre: { id: 'g1', name: '松柏類' } },
        { genre: { id: 'g2', name: '雑木類' } },
      ],
    }
    render(<ScheduledPostCard post={postWithGenres} />)
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()
  })

  it('メディアのサムネイルを表示する', () => {
    const postWithMedia = {
      ...mockPendingPost,
      media: [
        { url: '/image1.jpg', type: 'image' },
        { url: '/image2.jpg', type: 'image' },
      ],
    }
    const { container } = render(<ScheduledPostCard post={postWithMedia} />)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)
  })

  it('動画メディアの場合はvideoタグを使用する', () => {
    const postWithVideo = {
      ...mockPendingPost,
      media: [{ url: '/video.mp4', type: 'video' }],
    }
    const { container } = render(<ScheduledPostCard post={postWithVideo} />)
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', '/video.mp4')
  })

  it('削除ボタンをクリックすると確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<ScheduledPostCard post={mockPendingPost} />)

    await user.click(screen.getByRole('button', { name: /削除/i }))

    expect(screen.getByText('予約投稿を削除')).toBeInTheDocument()
    expect(screen.getByText(/この予約投稿を削除しますか/)).toBeInTheDocument()
  })

  it('削除確認でキャンセルをクリックすると削除されない', async () => {
    const user = userEvent.setup()
    render(<ScheduledPostCard post={mockPendingPost} />)

    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockDeleteScheduledPost).not.toHaveBeenCalled()
  })

  it('削除確認で削除ボタンをクリックすると削除が実行される', async () => {
    mockDeleteScheduledPost.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ScheduledPostCard post={mockPendingPost} />)

    await user.click(screen.getByRole('button', { name: /削除/i }))
    await user.click(screen.getByRole('button', { name: '削除する' }))

    expect(mockDeleteScheduledPost).toHaveBeenCalledWith('scheduled-1')
  })
})
