import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { DraftCard } from '@/components/draft/DraftCard'

// next/navigation モック
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, className }: { src: string; alt: string; fill?: boolean; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill} className={className} />
  ),
}))

// useQueryClient のみモック（QueryClient/QueryClientProvider は test-utils が提供するので除外）
const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/react-query', async (importActual) => {
  const actual = await importActual<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  }
})

// Server Actions モック
const mockDeleteDraft = vi.fn()
const mockPublishDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
  publishDraft: (...args: unknown[]) => mockPublishDraft(...args),
}))

// useToast モック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

describe('DraftCard', () => {
  const mockDraft = {
    id: 'draft-1',
    content: 'これはテスト下書きです。盆栽についての投稿です。',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15T10:30:00'),
    media: [],
    genres: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ success: true })
  })

  it('下書き内容を表示する', () => {
    render(<DraftCard draft={mockDraft} />)
    expect(screen.getByText('これはテスト下書きです。盆栽についての投稿です。')).toBeInTheDocument()
  })

  it('更新日時を表示する', () => {
    render(<DraftCard draft={mockDraft} />)
    expect(screen.getByText(/最終更新:/)).toBeInTheDocument()
    expect(screen.getByText(/2024年1月15日/)).toBeInTheDocument()
  })

  it('コンテンツがnullの場合はプレースホルダーを表示する', () => {
    const draftWithoutContent = { ...mockDraft, content: null }
    render(<DraftCard draft={draftWithoutContent} />)
    expect(screen.getByText('テキストなし')).toBeInTheDocument()
  })

  it('編集リンクを表示する', () => {
    render(<DraftCard draft={mockDraft} />)
    const editLink = screen.getByRole('link', { name: /編集/ })
    expect(editLink).toHaveAttribute('href', '/drafts/draft-1/edit')
  })

  it('削除ボタンを表示する', () => {
    render(<DraftCard draft={mockDraft} />)
    expect(screen.getByRole('button', { name: /削除/ })).toBeInTheDocument()
  })

  it('投稿するボタンを表示する', () => {
    render(<DraftCard draft={mockDraft} />)
    expect(screen.getByRole('button', { name: /投稿する/ })).toBeInTheDocument()
  })

  it('削除ボタンをクリックすると確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })
  })

  it('削除確認でOKを押すと削除APIを呼び出す', async () => {
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockDeleteDraft).toHaveBeenCalledWith('draft-1')
    })
  })

  it('削除確認でキャンセルを押すと削除APIを呼び出さない', async () => {
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockDeleteDraft).not.toHaveBeenCalled()
  })

  it('削除成功時にページをリフレッシュする', async () => {
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('削除エラー時にトーストを表示する', async () => {
    mockDeleteDraft.mockResolvedValue({ success: false, error: '削除に失敗しました' })
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除に失敗しました', variant: 'destructive' }))
    })
  })

  it('投稿ボタンをクリックすると確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })
  })

  it('投稿確認でOKを押すと投稿APIを呼び出す', async () => {
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockPublishDraft).toHaveBeenCalledWith('draft-1')
    })
  })

  it('投稿成功時にフィードページに遷移する', async () => {
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })
  })

  it('投稿エラー時にトーストを表示する', async () => {
    mockPublishDraft.mockResolvedValue({ error: '投稿に失敗しました' })
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '投稿に失敗しました', variant: 'destructive' }))
    })
  })

  it('メディアがある場合はサムネイルを表示する', () => {
    const draftWithMedia = {
      ...mockDraft,
      media: [
        { id: 'media-1', url: '/image1.jpg', type: 'image' },
        { id: 'media-2', url: '/image2.jpg', type: 'image' },
      ],
    }
    const { container } = render(<DraftCard draft={draftWithMedia} />)
    const images = container.querySelectorAll('img')
    expect(images).toHaveLength(2)
  })

  it('動画の場合はアイコンを表示する', () => {
    const draftWithVideo = {
      ...mockDraft,
      media: [{ id: 'media-1', url: '/video.mp4', type: 'video' }],
    }
    const { container } = render(<DraftCard draft={draftWithVideo} />)
    const videoContainer = container.querySelector('.w-16.h-16 svg')
    expect(videoContainer).toBeInTheDocument()
  })

  it('5つ以上のメディアがある場合は残数を表示する', () => {
    const draftWithManyMedia = {
      ...mockDraft,
      media: [
        { id: 'media-1', url: '/image1.jpg', type: 'image' },
        { id: 'media-2', url: '/image2.jpg', type: 'image' },
        { id: 'media-3', url: '/image3.jpg', type: 'image' },
        { id: 'media-4', url: '/image4.jpg', type: 'image' },
        { id: 'media-5', url: '/image5.jpg', type: 'image' },
        { id: 'media-6', url: '/image6.jpg', type: 'image' },
      ],
    }
    render(<DraftCard draft={draftWithManyMedia} />)
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  it('ジャンルがある場合はタグを表示する', () => {
    const draftWithGenres = {
      ...mockDraft,
      genres: [
        { genreId: 'genre-1', genre: { id: 'genre-1', name: '松柏類' } },
        { genreId: 'genre-2', genre: { id: 'genre-2', name: '雑木類' } },
      ],
    }
    render(<DraftCard draft={draftWithGenres} />)
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()
  })

  it('削除中はボタンテキストが変わる（処理中...）', async () => {
    mockDeleteDraft.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(screen.getByText('処理中...')).toBeInTheDocument()
    })
  })

  it('投稿中はボタンテキストが変わる（処理中...）', async () => {
    mockPublishDraft.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<DraftCard draft={mockDraft} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('処理中...')).toBeInTheDocument()
    })
  })
})
