import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { PostForm } from '@/components/post/PostForm'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockRefresh = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}))

// Server Actions モック
const mockCreatePost = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}))

const mockSaveDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
}))

// client-image-compression モック
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  isVideoFile: vi.fn(() => false),
  uploadVideoToR2: vi.fn(),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 100 * 1024 * 1024,
}))

// MentionTextarea モック
vi.mock('@/components/common/MentionTextarea', () => ({
  MentionTextarea: ({ value, onChange, placeholder, maxLength }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    maxLength?: number
  }) => (
    <textarea
      data-testid="mention-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
    />
  ),
}))

// GenreSelector モック
vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: {
    selectedIds: string[]
    onChange: (ids: string[]) => void
  }) => (
    <div data-testid="genre-selector">
      <button onClick={() => onChange([...selectedIds, 'genre-1'])}>ジャンル選択</button>
      <span>{selectedIds.length}ジャンル選択中</span>
    </div>
  ),
}))

// PollForm モック
vi.mock('@/components/post/PollForm', () => ({
  PollForm: ({ isActive, onToggle }: { isActive: boolean; onToggle: () => void }) => (
    isActive ? (
      <div data-testid="poll-form">
        <button onClick={onToggle}>アンケートを閉じる</button>
      </div>
    ) : (
      <button data-testid="poll-toggle" onClick={onToggle}>アンケート</button>
    )
  ),
}))

// SharedMediaUploadSection モック
vi.mock('@/components/common/SharedMediaUploadSection', () => ({
  SharedMediaUploadSection: () => <div data-testid="media-upload" />,
}))

// toast モック
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}))

const mockGenres: Record<string, { id: string; name: string; category: string }[]> = {
  '盆栽': [
    { id: 'genre-1', name: '松柏類', category: '盆栽' },
    { id: 'genre-2', name: '雑木類', category: '盆栽' },
  ],
}

describe('PostForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreatePost.mockResolvedValue({ success: true })
  })

  it('テキストエリアと投稿ボタンを表示する', () => {
    render(<PostForm genres={mockGenres} />)

    expect(screen.getByTestId('mention-textarea')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
  })

  it('下書き保存ボタンを表示する', () => {
    render(<PostForm genres={mockGenres} />)

    expect(screen.getByRole('button', { name: '下書き保存' })).toBeInTheDocument()
  })

  it('テキスト入力ができる', () => {
    render(<PostForm genres={mockGenres} />)

    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    expect(textarea).toHaveValue('テスト投稿')
  })

  it('ジャンル未選択の場合は投稿ボタンが無効になる', () => {
    render(<PostForm genres={mockGenres} />)

    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    const submitButton = screen.getByRole('button', { name: '投稿する' })
    expect(submitButton).toBeDisabled()
  })

  it('テキスト入力のみでジャンル未選択の場合は投稿ボタンにtitle属性が設定される', () => {
    render(<PostForm genres={mockGenres} />)

    const textarea = screen.getByTestId('mention-textarea')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    const submitButton = screen.getByRole('button', { name: '投稿する' })
    expect(submitButton).toHaveAttribute('title', 'ジャンルを選択してください')
  })

  it('draftCountが0より大きい場合は下書き一覧リンクを表示する', () => {
    render(<PostForm genres={mockGenres} draftCount={3} />)

    const draftLink = screen.getByTitle('下書き一覧')
    expect(draftLink).toHaveAttribute('href', '/drafts')
  })
})
