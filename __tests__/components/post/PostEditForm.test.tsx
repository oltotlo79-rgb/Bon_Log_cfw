import { vi } from 'vitest'

import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { PostEditForm } from '@/components/post/PostEditForm'
import {
  MSG_POST_CONTENT_REQUIRED,
  MSG_POST_UPDATED,
} from '@/lib/constants/messages'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const mockUpdatePost = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  updatePost: (...args: unknown[]) => mockUpdatePost(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}))

// MentionTextarea は mention 検索 API に依存するため、素の textarea に置き換える
vi.mock('@/components/common/MentionTextarea', () => ({
  MentionTextarea: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
  }) => (
    <textarea
      aria-label="content"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({
    selectedIds,
    onChange,
  }: {
    selectedIds: string[]
    onChange: (ids: string[]) => void
  }) => (
    <div data-testid="genre-selector">
      <span data-testid="selected-genres">{selectedIds.join(',')}</span>
      <button type="button" onClick={() => onChange(['genre-1'])}>
        Select Genre
      </button>
    </div>
  ),
}))

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn((file: File) => Promise.resolve(file)),
  isVideoFile: vi.fn((file: File) => file.type.startsWith('video/')),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: vi.fn(),
}))

const baseGenres = {
  樹種: [{ id: 'genre-1', name: '松柏類', category: '樹種' }],
}

const baseLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  maxScheduledPosts: 10,
  maxDailyPosts: 20,
  canSchedulePost: true,
  canViewAnalytics: false,
}

function renderForm(overrides: Partial<Parameters<typeof PostEditForm>[0]['editData']> = {}) {
  const editData = {
    id: 'post-1',
    content: '元の本文',
    genreIds: ['genre-1'],
    media: [] as { url: string; type: string }[],
    ...overrides,
  }
  return render(<PostEditForm genres={baseGenres} limits={baseLimits} editData={editData} />)
}

describe('PostEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdatePost.mockResolvedValue({ success: true })
  })

  it('editData の本文を初期表示し、更新ボタンを描画する', () => {
    renderForm()
    expect(screen.getByLabelText('content')).toHaveValue('元の本文')
    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()
    expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
  })

  it('本文もメディアも空で送信するとバリデーションエラーを出し updatePost を呼ばない', async () => {
    renderForm({ content: '' })
    fireEvent.submit(screen.getByRole('button', { name: '更新する' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(MSG_POST_CONTENT_REQUIRED)).toBeInTheDocument()
    })
    expect(mockUpdatePost).not.toHaveBeenCalled()
  })

  it('更新成功で updatePost を呼び、トーストと投稿詳細への遷移を行う', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('content'), { target: { value: '更新後の本文' } })
    fireEvent.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(mockUpdatePost).toHaveBeenCalledTimes(1)
    })
    const [postId, formData] = mockUpdatePost.mock.calls[0]!
    expect(postId).toBe('post-1')
    expect(formData).toBeInstanceOf(FormData)
    expect(formData.get('content')).toBe('更新後の本文')

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ description: MSG_POST_UPDATED })
      expect(mockPush).toHaveBeenCalledWith('/posts/post-1')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('updatePost が失敗するとエラーメッセージを表示し遷移しない', async () => {
    mockUpdatePost.mockResolvedValue({ success: false, error: '更新に失敗しました' })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('キャンセルで投稿詳細ページへ戻る', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(mockPush).toHaveBeenCalledWith('/posts/post-1')
    expect(mockUpdatePost).not.toHaveBeenCalled()
  })

  it('既存メディアがある場合は画像枚数カウントに反映される', () => {
    renderForm({ media: [{ url: 'https://example.com/a.webp', type: 'image' }] })
    expect(screen.getByText(/画像: 1\/4枚/)).toBeInTheDocument()
  })
})
