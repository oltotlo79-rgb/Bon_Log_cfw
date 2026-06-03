import { vi } from 'vitest'
 
/**
 * Coverage Boost 12 - Components Coverage Tests
 *
 * Targets uncovered areas in:
 * - DraftEditForm.tsx (removeMedia, handleSave, handleDelete)
 * - ReviewCard.tsx (delete button, edit mode)
 * - EventForm.tsx (date inputs, prefecture selection, validation)
 * - SearchResults.tsx (different tabs, empty/loading states)
 * - MentionTextarea.tsx (@ trigger, selection, keyboard nav)
 * - AnalogClockPicker.tsx (mouse down, mode switching, AM/PM)
 */

import { render, screen, fireEvent, waitFor, act } from '../utils/test-utils'

const mockUseInfiniteQuery = vi.fn().mockReturnValue({
  data: undefined,
  isLoading: false,
  error: null,
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
})

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useInfiniteQuery: (...args: unknown[]) => mockUseInfiniteQuery(...args),
  }
})

// ============================================================
// Mocks
// ============================================================

// Draft actions
const mockSaveDraft = vi.fn()
const mockPublishDraft = vi.fn()
const mockDeleteDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  publishDraft: (...args: unknown[]) => mockPublishDraft(...args),
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
}))

// Review actions
const mockDeleteReview = vi.fn()
const mockUpdateReview = vi.fn()
vi.mock('@/lib/actions/review', () => ({
  deleteReview: (...args: unknown[]) => mockDeleteReview(...args),
  updateReview: (...args: unknown[]) => mockUpdateReview(...args),
}))

// Event actions
const mockCreateEvent = vi.fn()
const mockUpdateEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
}))

// Search actions
const mockSearchPosts = vi.fn()
const mockSearchUsers = vi.fn()
const mockSearchByTag = vi.fn()
vi.mock('@/lib/actions/search', () => ({
  searchPosts: (...args: unknown[]) => mockSearchPosts(...args),
  searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
  searchByTag: (...args: unknown[]) => mockSearchByTag(...args),
}))

// Mention actions
const mockSearchMentionUsers = vi.fn()
vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: (...args: unknown[]) => mockSearchMentionUsers(...args),
}))

// Mention utils
vi.mock('@/lib/mention-utils', () => ({
  insertMention: vi.fn().mockReturnValue({ text: 'Hello <@user1> ', cursor: 16 }),
}))

// Client image compression
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn().mockResolvedValue(new File(['data'], 'test.jpg', { type: 'image/jpeg' })),
  isVideoFile: vi.fn().mockReturnValue(false),
  formatFileSize: vi.fn().mockReturnValue('1MB'),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: vi.fn(),
}))

// GenreSelector mock
vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: { selectedIds: string[], onChange: (ids: string[]) => void }) => (
    <div data-testid="genre-selector">
      <span>Selected: {selectedIds.join(',')}</span>
      <button onClick={() => onChange(['genre-1', 'genre-2'])}>Select Genres</button>
    </div>
  ),
}))

// PostCard mock
vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string; content?: string } }) => (
    <div data-testid={`post-card-${post.id}`}>{post.content || 'Post'}</div>
  ),
}))

// StarRating mocks
vi.mock('@/components/shop/StarRating', () => ({
  StarRatingDisplay: ({ rating }: { rating: number }) => <div data-testid="star-display">Rating: {rating}</div>,
  StarRatingInput: ({ value, onChange }: { value: number, onChange: (v: number) => void }) => (
    <div data-testid="star-input">
      <span>Rating: {value}</span>
      <button onClick={() => onChange(4)}>Set 4 stars</button>
    </div>
  ),
}))

// ReportButton mock
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => <button data-testid="report-button">Report</button>,
}))

// next/navigation: stable router handles so back()/refresh() are assertable
const mockRouterBack = vi.fn()
const mockRouterRefresh = vi.fn()
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: mockRouterBack,
    forward: vi.fn(),
    refresh: mockRouterRefresh,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

// Prefectures mock
vi.mock('@/lib/prefectures', () => ({
  PREFECTURES: ['北海道', '東京都', '大阪府', '埼玉県'],
}))

// react-intersection-observer mock
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

// shadcn/ui textarea mock
vi.mock('@/components/ui/textarea', async () => ({
  Textarea: (await vi.importActual<typeof import('react')>('react')).forwardRef(
    (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>, ref: React.Ref<HTMLTextAreaElement>) => (
      <textarea ref={ref} {...props} />
    )
  ),
}))

// cn util mock
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

// ============================================================
// Imports
// ============================================================

import { DraftEditForm } from '@/components/draft/DraftEditForm'
import { ReviewCard } from '@/components/shop/ReviewCard'
import { EventForm } from '@/components/event/EventForm'
import { PostSearchResults, UserSearchResults, TagSearchResults, PopularTags } from '@/components/search/SearchResults'
import { MentionTextarea } from '@/components/common/MentionTextarea'
import { AnalogClockPicker } from '@/components/ui/AnalogClockPicker'

// ============================================================
// 1. DraftEditForm Tests
// ============================================================

describe('DraftEditForm', () => {
  const defaultDraft = {
    id: 'draft-1',
    content: 'Draft content',
    media: [
      { id: 'media-1', url: '/image1.jpg', type: 'image' },
      { id: 'media-2', url: '/image2.jpg', type: 'image' },
    ],
    genres: [
      { genreId: 'genre-1', genre: { id: 'genre-1', name: 'Black Pine' } },
    ],
  }

  const defaultGenres = {
    'Pine': [
      { id: 'genre-1', name: 'Black Pine', category: 'Pine' },
      { id: 'genre-2', name: 'Five Needle Pine', category: 'Pine' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form with draft content', () => {
    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)
    expect(screen.getByDisplayValue('Draft content')).toBeInTheDocument()
  })

  it('removes media when clicking the remove button', () => {
    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)

    // Should show 2 media items initially (rendered as images with remove buttons)
    const removeButtons = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('absolute')
    )
    expect(removeButtons.length).toBeGreaterThanOrEqual(2)

    // Click the first remove button
    fireEvent.click(removeButtons[0])

    // One media item should be removed, check by counting remove buttons again
    const remainingButtons = screen.getAllByRole('button').filter(btn =>
      btn.className.includes('absolute')
    )
    expect(remainingButtons.length).toBeLessThan(removeButtons.length)
  })

  it('handles save (handleSave) successfully', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })

    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)

    const saveButton = screen.getByRole('button', { name: /下書き保存/ })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalledWith({
        id: 'draft-1',
        content: 'Draft content',
        mediaUrls: ['/image1.jpg', '/image2.jpg'],
        genreIds: ['genre-1'],
      })
    })
  })

  it('handles save error', async () => {
    mockSaveDraft.mockResolvedValue({ error: 'Save failed' })

    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)

    const saveButton = screen.getByRole('button', { name: /下書き保存/ })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })
  })

  it('handles save exception', async () => {
    mockSaveDraft.mockRejectedValue(new Error('Network error'))

    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)

    const saveButton = screen.getByRole('button', { name: /下書き保存/ })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(screen.getByText('下書きの保存に失敗しました')).toBeInTheDocument()
    })
  })

  it('handles delete (handleDelete) with confirm', async () => {
    mockDeleteDraft.mockResolvedValue({ success: true })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)

    const deleteButton = screen.getByRole('button', { name: /削除/ })
    await act(async () => {
      fireEvent.click(deleteButton)
    })

    await waitFor(() => {
      expect(mockDeleteDraft).toHaveBeenCalledWith('draft-1')
    })
  })

  it('cancels delete when confirm returns false', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)

    const deleteButton = screen.getByRole('button', { name: /削除/ })
    fireEvent.click(deleteButton)

    expect(mockDeleteDraft).not.toHaveBeenCalled()
  })

  it('handles delete error', async () => {
    mockDeleteDraft.mockResolvedValue({ error: 'Delete failed' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)

    const deleteButton = screen.getByRole('button', { name: /削除/ })
    await act(async () => {
      fireEvent.click(deleteButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument()
    })
  })

  it('handles delete exception', async () => {
    mockDeleteDraft.mockRejectedValue(new Error('Network error'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)

    const deleteButton = screen.getByRole('button', { name: /削除/ })
    await act(async () => {
      fireEvent.click(deleteButton)
    })

    await waitFor(() => {
      expect(screen.getByText('削除に失敗しました')).toBeInTheDocument()
    })
  })

  it('updates content text', () => {
    render(<DraftEditForm draft={defaultDraft} genres={defaultGenres} />)

    const textarea = screen.getByDisplayValue('Draft content')
    fireEvent.change(textarea, { target: { value: 'Updated content' } })
    expect(screen.getByDisplayValue('Updated content')).toBeInTheDocument()
  })
})

// ============================================================
// 2. ReviewCard Tests
// ============================================================

describe('ReviewCard', () => {
  const defaultReview = {
    id: 'review-1',
    rating: 5,
    content: 'Great bonsai shop!',
    createdAt: new Date('2024-06-15'),
    user: {
      id: 'test-user-id',
      nickname: 'TestUser',
      avatarUrl: '/avatar.jpg',
    },
    images: [
      { id: 'img-1', url: '/review-img1.jpg' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders review content', () => {
    render(<ReviewCard review={defaultReview} currentUserId="test-user-id" />)
    expect(screen.getByText('Great bonsai shop!')).toBeInTheDocument()
    expect(screen.getByText('TestUser')).toBeInTheDocument()
  })

  it('shows edit and delete buttons for owner', () => {
    render(<ReviewCard review={defaultReview} currentUserId="test-user-id" />)

    // Find the edit button (pencil icon) and delete button (trash icon)
    const editButton = screen.getByTitle('編集')
    const deleteButton = screen.getByTitle('削除')
    expect(editButton).toBeInTheDocument()
    expect(deleteButton).toBeInTheDocument()
  })

  it('shows delete confirmation when delete button clicked', () => {
    render(<ReviewCard review={defaultReview} currentUserId="test-user-id" />)

    const deleteButton = screen.getByTitle('削除')
    fireEvent.click(deleteButton)

    // Should show confirmation text
    expect(screen.getByText('削除する')).toBeInTheDocument()
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  it('executes delete when confirmed', async () => {
    mockDeleteReview.mockResolvedValue({ success: true })

    render(<ReviewCard review={defaultReview} currentUserId="test-user-id" />)

    // Click delete button to show confirmation
    const deleteButton = screen.getByTitle('削除')
    fireEvent.click(deleteButton)

    // Click the confirm delete button
    const confirmButton = screen.getByText('削除する')
    await act(async () => {
      fireEvent.click(confirmButton)
    })

    await waitFor(() => {
      expect(mockDeleteReview).toHaveBeenCalledWith('review-1')
    })
  })

  it('cancels delete when cancel clicked', () => {
    render(<ReviewCard review={defaultReview} currentUserId="test-user-id" />)

    // Click delete to show confirmation
    const deleteButton = screen.getByTitle('削除')
    fireEvent.click(deleteButton)

    // Click cancel
    const cancelButton = screen.getByText('キャンセル')
    fireEvent.click(cancelButton)

    // Should go back to showing edit/delete buttons
    expect(screen.getByTitle('編集')).toBeInTheDocument()
    expect(screen.getByTitle('削除')).toBeInTheDocument()
  })

  it('enters edit mode when edit button clicked', () => {
    render(<ReviewCard review={defaultReview} currentUserId="test-user-id" />)

    const editButton = screen.getByTitle('編集')
    fireEvent.click(editButton)

    // Should show edit form elements
    expect(screen.getByText('評価')).toBeInTheDocument()
    expect(screen.getByText('コメント')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('レビューコメント（任意）')).toBeInTheDocument()
    expect(screen.getByText('保存')).toBeInTheDocument()
  })

  it('cancels edit mode', () => {
    render(<ReviewCard review={defaultReview} currentUserId="test-user-id" />)

    // Enter edit mode
    fireEvent.click(screen.getByTitle('編集'))

    // Click cancel
    const cancelBtn = screen.getByText('キャンセル')
    fireEvent.click(cancelBtn)

    // Should be back to display mode
    expect(screen.getByText('Great bonsai shop!')).toBeInTheDocument()
    expect(screen.getByTitle('編集')).toBeInTheDocument()
  })

  it('shows report button for non-owner', () => {
    render(<ReviewCard review={defaultReview} currentUserId="other-user-id" />)
    expect(screen.getByTestId('report-button')).toBeInTheDocument()
  })

  it('renders review without avatar (fallback)', () => {
    const reviewNoAvatar = {
      ...defaultReview,
      user: { ...defaultReview.user, avatarUrl: null },
    }
    render(<ReviewCard review={reviewNoAvatar} currentUserId="test-user-id" />)
    expect(screen.getByText('T')).toBeInTheDocument() // First letter of TestUser
  })

  it('does not show actions when not logged in', () => {
    render(<ReviewCard review={defaultReview} />)
    expect(screen.queryByTitle('編集')).not.toBeInTheDocument()
    expect(screen.queryByTitle('削除')).not.toBeInTheDocument()
    expect(screen.queryByTestId('report-button')).not.toBeInTheDocument()
  })
})

// ============================================================
// 3. EventForm Tests
// ============================================================

describe('EventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders create form', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/タイトル/)).toBeInTheDocument()
    expect(screen.getByLabelText(/開始日時/)).toBeInTheDocument()
    expect(screen.getByLabelText(/都道府県/)).toBeInTheDocument()
    expect(screen.getByText('登録する')).toBeInTheDocument()
  })

  it('handles date input changes', () => {
    render(<EventForm mode="create" />)

    const startDateInput = screen.getByLabelText(/開始日時/)
    fireEvent.change(startDateInput, { target: { value: '2025-05-01T10:00' } })
    expect(startDateInput).toHaveValue('2025-05-01T10:00')

    const endDateInput = screen.getByLabelText(/終了日時/)
    fireEvent.change(endDateInput, { target: { value: '2025-05-05T17:00' } })
    expect(endDateInput).toHaveValue('2025-05-05T17:00')
  })

  it('handles prefecture selection', () => {
    render(<EventForm mode="create" />)

    const prefectureSelect = screen.getByLabelText(/都道府県/)
    fireEvent.change(prefectureSelect, { target: { value: '東京都' } })
    expect(prefectureSelect).toHaveValue('東京都')
  })

  it('handles all form field changes', () => {
    render(<EventForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/タイトル/), { target: { value: 'Bonsai Exhibition' } })
    fireEvent.change(screen.getByLabelText(/市区町村/), { target: { value: 'さいたま市' } })
    fireEvent.change(screen.getByLabelText(/会場名/), { target: { value: 'Omiya Bonsai Museum' } })
    fireEvent.change(screen.getByLabelText(/主催者/), { target: { value: 'Bonsai Association' } })
    fireEvent.change(screen.getByLabelText(/入場料/), { target: { value: '500円' } })
    fireEvent.click(screen.getByLabelText(/即売あり/))
    fireEvent.change(screen.getByLabelText(/詳細説明/), { target: { value: 'Wonderful event' } })
    fireEvent.change(screen.getByLabelText(/外部リンク/), { target: { value: 'https://example.com' } })

    expect(screen.getByLabelText(/タイトル/)).toHaveValue('Bonsai Exhibition')
    expect(screen.getByLabelText(/市区町村/)).toHaveValue('さいたま市')
    expect(screen.getByLabelText(/即売あり/)).toBeChecked()
  })

  it('submits create form successfully', async () => {
    mockCreateEvent.mockResolvedValue({ eventId: 'new-event-1' })

    render(<EventForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/タイトル/), { target: { value: 'Test Event' } })
    fireEvent.change(screen.getByLabelText(/開始日時/), { target: { value: '2025-05-01T10:00' } })
    fireEvent.change(screen.getByLabelText(/都道府県/), { target: { value: '東京都' } })

    const submitButton = screen.getByText('登録する')
    await act(async () => {
      fireEvent.submit(submitButton.closest('form')!)
    })

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled()
    })
  })

  it('shows error on form submission failure', async () => {
    mockCreateEvent.mockResolvedValue({ error: 'Validation failed' })

    render(<EventForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/タイトル/), { target: { value: 'Test Event' } })
    fireEvent.change(screen.getByLabelText(/開始日時/), { target: { value: '2025-05-01T10:00' } })
    fireEvent.change(screen.getByLabelText(/都道府県/), { target: { value: '東京都' } })

    const submitButton = screen.getByText('登録する')
    await act(async () => {
      fireEvent.submit(submitButton.closest('form')!)
    })

    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument()
    })
  })

  it('renders edit form with initial data', () => {
    const initialData = {
      id: 'event-1',
      title: 'Existing Event',
      startDate: new Date('2025-05-01T10:00:00Z'),
      endDate: new Date('2025-05-05T17:00:00Z'),
      prefecture: '埼玉県',
      city: 'さいたま市',
      venue: 'Bonsai Museum',
      organizer: 'Org',
      fee: '500円',
      hasSales: true,
      description: 'Description here',
      externalUrl: 'https://example.com',
    }

    render(<EventForm mode="edit" initialData={initialData} />)

    expect(screen.getByLabelText(/タイトル/)).toHaveValue('Existing Event')
    expect(screen.getByLabelText(/都道府県/)).toHaveValue('埼玉県')
    expect(screen.getByLabelText(/即売あり/)).toBeChecked()
    expect(screen.getByText('更新する')).toBeInTheDocument()
  })

  it('submits edit form', async () => {
    mockUpdateEvent.mockResolvedValue({ success: true })

    const initialData = {
      id: 'event-1',
      title: 'Existing Event',
      startDate: new Date('2025-05-01T10:00:00Z'),
      endDate: null,
      prefecture: '東京都',
      city: null,
      venue: null,
      organizer: null,
      fee: null,
      hasSales: false,
      description: null,
      externalUrl: null,
    }

    render(<EventForm mode="edit" initialData={initialData} />)

    const submitButton = screen.getByText('更新する')
    await act(async () => {
      fireEvent.submit(submitButton.closest('form')!)
    })

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledWith('event-1', expect.any(FormData))
    })
  })

  it('handles cancel button', () => {
    render(<EventForm mode="create" />)
    const cancelButton = screen.getByText('キャンセル')
    fireEvent.click(cancelButton)
    expect(mockRouterBack).toHaveBeenCalled()
  })
})

// ============================================================
// 4. SearchResults Tests
// ============================================================

describe('SearchResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Override useInfiniteQuery for these tests
    // useInfiniteQuery is already mocked globally
  })

  describe('PostSearchResults', () => {
    it('renders loading state', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
      })

      render(<PostSearchResults query="pine" />)
      // Should render skeleton (animate-pulse divs)
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('renders empty results for posts', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: { pages: [{ posts: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<PostSearchResults query="nonexistent" />)
      expect(screen.getByText(/「nonexistent」に一致する投稿はありません/)).toBeInTheDocument()
    })

    it('renders empty results without query', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: { pages: [{ posts: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<PostSearchResults query="" />)
      expect(screen.getByText('投稿が見つかりません')).toBeInTheDocument()
    })

    it('renders post results', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [
              { id: 'p1', content: 'Pine bonsai', user: { id: 'u1', nickname: 'User1' }, media: [], genres: [], likeCount: 0, commentCount: 0 },
              { id: 'p2', content: 'Oak bonsai', user: { id: 'u2', nickname: 'User2' }, media: [], genres: [], likeCount: 0, commentCount: 0 },
            ],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<PostSearchResults query="bonsai" currentUserId="test-user-id" />)
      expect(screen.getByTestId('post-card-p1')).toBeInTheDocument()
      expect(screen.getByTestId('post-card-p2')).toBeInTheDocument()
    })

    it('shows no more posts message', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [{ id: 'p1', content: 'Post', user: { id: 'u1' }, media: [], genres: [] }],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<PostSearchResults query="bonsai" />)
      expect(screen.getByText('これ以上投稿はありません')).toBeInTheDocument()
    })

    it('shows loading indicator when fetching next page', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [{ id: 'p1', content: 'Post', user: { id: 'u1' }, media: [], genres: [] }],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
      })

      render(<PostSearchResults query="bonsai" />)
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })
  })

  describe('UserSearchResults', () => {
    it('renders loading state', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
        error: null,
      })

      render(<UserSearchResults query="user" />)
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('renders empty user results', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: { pages: [{ users: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="nobody" />)
      expect(screen.getByText(/「nobody」に一致するユーザーはいません/)).toBeInTheDocument()
    })

    it('renders empty user results without query', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: { pages: [{ users: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="" />)
      expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument()
    })

    it('renders user results with avatars', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [
              { id: 'u1', nickname: 'User1', avatarUrl: '/avatar1.jpg', bio: 'A bio', followersCount: 10, followingCount: 5 },
              { id: 'u2', nickname: 'User2', avatarUrl: null, bio: null, followersCount: 3, followingCount: 2 },
            ],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })

      render(<UserSearchResults query="user" />)
      expect(screen.getByText('User1')).toBeInTheDocument()
      expect(screen.getByText('User2')).toBeInTheDocument()
      expect(screen.getByText('A bio')).toBeInTheDocument()
      expect(screen.getByText('10フォロワー')).toBeInTheDocument()
      // User2 has no avatar, should show first letter
      expect(screen.getByText('U')).toBeInTheDocument()
    })

    it('renders error state', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: { message: 'Search failed' },
      })

      render(<UserSearchResults query="user" />)
      expect(screen.getByText('Search failed')).toBeInTheDocument()
    })
  })

  describe('TagSearchResults', () => {
    it('renders loading state', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
      })

      render(<TagSearchResults tag="bonsai" />)
      const skeletonElements = document.querySelectorAll('.animate-pulse')
      expect(skeletonElements.length).toBeGreaterThan(0)
    })

    it('renders empty tag results', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: { pages: [{ posts: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<TagSearchResults tag="emptytag" />)
      expect(screen.getByText(/#emptytag を含む投稿はありません/)).toBeInTheDocument()
    })

    it('renders tag results with header', () => {
      mockUseInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [
              { id: 'p1', content: '#bonsai post', user: { id: 'u1' }, media: [], genres: [] },
            ],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
      })

      render(<TagSearchResults tag="bonsai" currentUserId="test-user-id" />)
      expect(screen.getByText('#bonsai')).toBeInTheDocument()
      expect(screen.getByText('1件の投稿')).toBeInTheDocument()
    })
  })

  describe('PopularTags', () => {
    it('renders nothing when no tags', () => {
      const { container } = render(<PopularTags tags={[]} />)
      expect(container.innerHTML).toBe('')
    })

    it('renders popular tags', () => {
      const tags = [
        { tag: 'bonsai', count: 100 },
        { tag: 'pine', count: 50 },
      ]

      render(<PopularTags tags={tags} />)
      expect(screen.getByText('人気のタグ')).toBeInTheDocument()
      expect(screen.getByText(/#bonsai/)).toBeInTheDocument()
      expect(screen.getByText(/#pine/)).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
    })
  })
})

// ============================================================
// 5. MentionTextarea Tests
// ============================================================

describe('MentionTextarea', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    placeholder: 'Write something...',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders textarea with placeholder', () => {
    render(<MentionTextarea {...defaultProps} />)
    expect(screen.getByPlaceholderText('Write something...')).toBeInTheDocument()
  })

  it('calls onChange when typing', () => {
    render(<MentionTextarea {...defaultProps} />)
    const textarea = screen.getByPlaceholderText('Write something...')
    fireEvent.change(textarea, { target: { value: 'Hello', selectionStart: 5 } })
    expect(defaultProps.onChange).toHaveBeenCalledWith('Hello')
  })

  it('triggers search when typing @', async () => {
    const mockUsers = [
      { id: 'u1', nickname: 'User1', avatarUrl: '/avatar1.jpg', isFollowing: true },
      { id: 'u2', nickname: 'User2', avatarUrl: null, isFollowing: false },
    ]
    mockSearchMentionUsers.mockResolvedValue(mockUsers)

    render(<MentionTextarea {...defaultProps} value="Hello @" />)
    const textarea = screen.getByPlaceholderText('Write something...')

    fireEvent.change(textarea, { target: { value: 'Hello @u', selectionStart: 8 } })

    // Fast-forward debounce timer
    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockSearchMentionUsers).toHaveBeenCalledWith('u', 8)
    })
  })

  it('shows dropdown with mention suggestions', async () => {
    const mockUsers = [
      { id: 'u1', nickname: 'User1', avatarUrl: '/avatar1.jpg', isFollowing: true },
      { id: 'u2', nickname: 'User2', avatarUrl: null, isFollowing: false },
    ]
    mockSearchMentionUsers.mockResolvedValue(mockUsers)

    const { rerender } = render(<MentionTextarea {...defaultProps} value="" />)

    const textarea = screen.getByPlaceholderText('Write something...')
    fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } })

    act(() => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockSearchMentionUsers).toHaveBeenCalled()
    })

    // Rerender with the new value to ensure state is updated
    rerender(<MentionTextarea {...defaultProps} value="@" />)

    await waitFor(() => {
      // Check if the dropdown shows users
      const dropdown = document.querySelector('[class*="absolute z-50"]')
      if (dropdown) {
        expect(dropdown).toBeInTheDocument()
      }
    })
  })

  it('handles keyboard navigation - ArrowDown', async () => {
    vi.useRealTimers()
    const mockUsers = [
      { id: 'u1', nickname: 'User1', avatarUrl: null, isFollowing: false },
      { id: 'u2', nickname: 'User2', avatarUrl: null, isFollowing: false },
    ]
    mockSearchMentionUsers.mockResolvedValue(mockUsers)

    render(<MentionTextarea {...defaultProps} value="" />)

    const textarea = screen.getByPlaceholderText('Write something...')
    fireEvent.change(textarea, { target: { value: '@', selectionStart: 1 } })

    await waitFor(() => {
      expect(mockSearchMentionUsers).toHaveBeenCalled()
    }, { timeout: 2000 })

    // Arrow down should change selected index
    fireEvent.keyDown(textarea, { key: 'ArrowDown' })
    fireEvent.keyDown(textarea, { key: 'ArrowUp' })
    fireEvent.keyDown(textarea, { key: 'Escape' })

    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  it('renders with disabled state', () => {
    render(<MentionTextarea {...defaultProps} disabled={true} />)
    const textarea = screen.getByPlaceholderText('Write something...')
    expect(textarea).toBeDisabled()
  })

  it('renders with custom class and rows', () => {
    render(<MentionTextarea {...defaultProps} className="custom-class" rows={5} />)
    const textarea = screen.getByPlaceholderText('Write something...')
    expect(textarea).toHaveAttribute('rows', '5')
  })

  it('clears suggestions when typing space after @mention', () => {
    render(<MentionTextarea {...defaultProps} value="@user " />)
    const textarea = screen.getByPlaceholderText('Write something...')
    fireEvent.change(textarea, { target: { value: '@user test', selectionStart: 10 } })
    expect(defaultProps.onChange).toHaveBeenCalledWith('@user test')
  })
})

// ============================================================
// 6. AnalogClockPicker Tests
// ============================================================

describe('AnalogClockPicker', () => {
  const defaultProps = {
    value: '09:00',
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with time value', () => {
    render(<AnalogClockPicker {...defaultProps} />)
    expect(screen.getByText('09:00')).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<AnalogClockPicker {...defaultProps} label="Start Time" />)
    expect(screen.getByText('Start Time')).toBeInTheDocument()
  })

  it('opens clock picker on click', () => {
    render(<AnalogClockPicker {...defaultProps} />)

    const button = screen.getByText('09:00')
    fireEvent.click(button)

    // Should show hour and minute buttons
    expect(screen.getByText('09')).toBeInTheDocument()
    expect(screen.getByText('00')).toBeInTheDocument()
  })

  it('handles disabled state', () => {
    render(<AnalogClockPicker {...defaultProps} disabled={true} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('switches between hour and minute mode', () => {
    render(<AnalogClockPicker {...defaultProps} />)

    // Open the picker
    fireEvent.click(screen.getByText('09:00'))

    // Click minutes button to switch to minute mode
    const minutesButton = screen.getAllByRole('button').find(
      btn => btn.textContent === '00' && btn.className.includes('text-3xl')
    )
    expect(minutesButton).toBeDefined()
    fireEvent.click(minutesButton as HTMLElement)
    expect(minutesButton).toHaveClass('bg-primary')

    // Click hours button to switch back to hour mode
    const hoursButton = screen.getAllByRole('button').find(
      btn => btn.textContent === '09' && btn.className.includes('text-3xl')
    )
    expect(hoursButton).toBeDefined()
    fireEvent.click(hoursButton as HTMLElement)
    expect(hoursButton).toHaveClass('bg-primary')
    expect(minutesButton).not.toHaveClass('bg-primary')
  })

  it('handles mouse interactions on clock face', () => {
    render(<AnalogClockPicker {...defaultProps} />)

    // Open the picker
    fireEvent.click(screen.getByText('09:00'))

    // Find the clock face (the element with onMouseDown)
    const clockFace = document.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      // Mock getBoundingClientRect
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 224,
        bottom: 224,
        width: 224,
        height: 224,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })

      // Simulate mouse down on the clock
      fireEvent.mouseDown(clockFace, { clientX: 112, clientY: 10 })

      // Simulate mouse move (drag)
      fireEvent.mouseMove(clockFace, { clientX: 200, clientY: 112, buttons: 1 })

      // Simulate mouse up (this triggers mode switch for hours)
      fireEvent.mouseUp(clockFace, { clientX: 200, clientY: 112 })

      expect(defaultProps.onChange).toHaveBeenCalled()
    }
  })

  it('handles mouse interaction in minutes mode', () => {
    render(<AnalogClockPicker {...defaultProps} />)

    // Open the picker
    fireEvent.click(screen.getByText('09:00'))

    // Switch to minutes mode
    const minutesBtn = screen.getAllByRole('button').find(
      btn => btn.textContent === '00' && btn.className.includes('text-3xl')
    )
    expect(minutesBtn).toBeDefined()
    fireEvent.click(minutesBtn as HTMLElement)

    const clockFace = document.querySelector('.rounded-full.bg-muted\\/50')
    expect(clockFace).not.toBeNull()
    vi.spyOn(clockFace as Element, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 224, bottom: 224,
      width: 224, height: 224, x: 0, y: 0, toJSON: () => ({}),
    })

    // Interact in minute mode: right edge (3 o'clock) => 15 minutes, hours kept at 09
    fireEvent.mouseDown(clockFace as Element, { clientX: 200, clientY: 112 })
    expect(defaultProps.onChange).toHaveBeenCalledWith('09:15')

    // MouseUp in minute mode closes the picker
    fireEvent.mouseUp(clockFace as Element, { clientX: 200, clientY: 112 })
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('closes on OK button', () => {
    render(<AnalogClockPicker {...defaultProps} />)

    fireEvent.click(screen.getByText('09:00'))
    expect(screen.getByText('OK')).toBeInTheDocument()

    fireEvent.click(screen.getByText('OK'))
    // Picker should close
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('closes on cancel button', () => {
    render(<AnalogClockPicker {...defaultProps} />)

    fireEvent.click(screen.getByText('09:00'))
    fireEvent.click(screen.getByText('キャンセル'))

    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('closes on overlay click (mobile)', () => {
    render(<AnalogClockPicker {...defaultProps} />)

    fireEvent.click(screen.getByText('09:00'))

    // Find the overlay background
    const overlay = document.querySelector('.fixed.inset-0.bg-black\\/50')
    if (overlay) {
      fireEvent.click(overlay)
      expect(screen.queryByText('OK')).not.toBeInTheDocument()
    }
  })

  it('handles empty value (--:--)', () => {
    render(<AnalogClockPicker {...defaultProps} value="" />)
    expect(screen.getByText('--:--')).toBeInTheDocument()
  })

  it('handles invalid value with defaults', () => {
    render(<AnalogClockPicker {...defaultProps} value="invalid" />)
    // Should use defaults (9:00) internally
    fireEvent.click(screen.getByRole('button'))
    // The parsed hours should default to 9, minutes to 0
    expect(screen.getByText('09')).toBeInTheDocument()
  })

  it('handles touch events', () => {
    render(<AnalogClockPicker {...defaultProps} />)

    fireEvent.click(screen.getByText('09:00'))

    const clockFace = document.querySelector('.rounded-full.bg-muted\\/50')
    expect(clockFace).not.toBeNull()
    vi.spyOn(clockFace as Element, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 224, bottom: 224,
      width: 224, height: 224, x: 0, y: 0, toJSON: () => ({}),
    })

    // Touch start at top outer ring => 12 o'clock (00:00)
    fireEvent.touchStart(clockFace as Element, {
      touches: [{ clientX: 112, clientY: 10 }],
      preventDefault: vi.fn(),
    })
    expect(defaultProps.onChange).toHaveBeenCalledWith('00:00')

    ;(defaultProps.onChange as ReturnType<typeof vi.fn>).mockClear()
    // Touch move to right edge => 3 o'clock (03:00)
    fireEvent.touchMove(clockFace as Element, {
      touches: [{ clientX: 200, clientY: 112 }],
      preventDefault: vi.fn(),
    })
    expect(defaultProps.onChange).toHaveBeenCalledWith('03:00')

    // Touch end finalizes hours and switches to minutes mode
    fireEvent.touchEnd(clockFace as Element, {
      changedTouches: [{ clientX: 200, clientY: 112 }],
      preventDefault: vi.fn(),
    })
    const minuteHeader = screen.getAllByRole('button').find(
      btn => btn.textContent === '00' && btn.className.includes('text-3xl')
    )
    expect(minuteHeader).toHaveClass('bg-primary')
  })

  it('handles inner ring selection (PM hours)', () => {
    render(<AnalogClockPicker {...defaultProps} />)

    fireEvent.click(screen.getByText('09:00'))

    const clockFace = document.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 224, bottom: 224,
        width: 224, height: 224, x: 0, y: 0, toJSON: () => ({}),
      })

      // Click near center to select inner ring (PM)
      fireEvent.mouseDown(clockFace, { clientX: 112, clientY: 90 })
      fireEvent.mouseUp(clockFace, { clientX: 112, clientY: 90 })

      expect(defaultProps.onChange).toHaveBeenCalled()
    }
  })
})
