/**
 * PostForm - branch coverage boost tests
 *
 * Targets remaining uncovered branches:
 * - CharacterCountRing: isWarning true + isOver false (remaining <= 50 but >= 0)
 * - CharacterCountRing: isOver true (remaining < 0)
 * - CharacterCountRing: normal state (remaining > 50, current > 0)
 * - CharacterCountRing: current === 0 returns null
 * - canSubmit: uploading=true disables submit
 * - title attribute on submit button when genres selected (undefined)
 * - auto-save: savedDisplayTimerRef.current truthy (clearing previous timer)
 * - video upload: result.url present but no error
 * - handleSubmit: poll active but no trimmed options (pollOptions not appended)
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { PostForm } from '@/components/post/PostForm'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockRefresh = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}))

const mockCreatePost = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}))

const mockSaveDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
}))

vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: vi.fn().mockResolvedValue([]),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
  useToast: () => ({
    toast: mockToast,
    toasts: [],
  }),
}))

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  isVideoFile: vi.fn(() => false),
  uploadVideoToR2: vi.fn(),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
}))

// Use real components so CharacterCountRing renders
// (no mock for MentionTextarea, GenreSelector, PollForm, SharedMediaUploadSection)

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
  ],
}

describe('PostForm - branch boost (CharacterCountRing)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreatePost.mockResolvedValue({ success: true })
  })

  it('CharacterCountRing renders warning state when remaining <= 50 and >= 0', () => {
    // maxPostLength=500, type 455 chars => remaining=45 <= 50
    render(
      <PostForm
        genres={mockGenres}
        limits={{ maxPostLength: 500, maxImages: 4, maxVideos: 1 }}
      />
    )

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    // Type exactly 455 characters
    const longText = 'あ'.repeat(455)
    fireEvent.change(textarea, { target: { value: longText } })

    // The ring should show remaining count (45)
    expect(screen.getByText('45')).toBeInTheDocument()
    // Should have amber color class in the DOM
    const amberElement = screen.getByText('45')
    expect(amberElement.className).toContain('text-amber-500')
  })

  it('CharacterCountRing renders over state when remaining < 0', () => {
    render(
      <PostForm
        genres={mockGenres}
        limits={{ maxPostLength: 10, maxImages: 4, maxVideos: 1 }}
      />
    )

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'あいうえおかきくけこさ' } }) // 11 chars, max 10

    // remaining = -1, isOver = true, isWarning = true
    expect(screen.getByText('-1')).toBeInTheDocument()
    const overElement = screen.getByText('-1')
    expect(overElement.className).toContain('text-destructive')
  })

  it('CharacterCountRing renders normal ring when current > 0 but remaining > 50', () => {
    render(
      <PostForm
        genres={mockGenres}
        limits={{ maxPostLength: 500, maxImages: 4, maxVideos: 1 }}
      />
    )

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'テスト' } }) // 3 chars, remaining=497

    // Ring should render (current > 0) but no text overlay (isWarning = false)
    // There should be an SVG but no numeric text
    const svgs = document.querySelectorAll('svg[aria-hidden="true"]')
    expect(svgs.length).toBeGreaterThan(0)
    // No remaining text displayed when not in warning state
    expect(screen.queryByText('497')).not.toBeInTheDocument()
  })

  it('CharacterCountRing returns null when current === 0', () => {
    render(<PostForm genres={mockGenres} />)
    // No text typed, current=0, ring should not render at all
    // Check no SVG with aria-hidden for the ring
    const ringContainer = document.querySelector('.relative.inline-flex.items-center.justify-center')
    expect(ringContainer).toBeNull()
  })
})

describe('PostForm - branch boost (submit/genre title)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreatePost.mockResolvedValue({ success: true })
  })

  it('submit button has no title attribute when genres are selected', async () => {
    render(<PostForm genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'テスト' } })

    // Select a genre
    const genreButton = screen.getByText('ジャンルを選択（任意）')
    fireEvent.click(genreButton)
    fireEvent.click(screen.getByText('黒松'))

    const submitButton = screen.getByRole('button', { name: '投稿する' })
    // When genres are selected, title should be undefined (not set)
    expect(submitButton).not.toHaveAttribute('title')
  })
})

describe('PostForm - branch boost (auto-save savedDisplayTimer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('auto-save clears previous savedDisplayTimer on rapid successive saves', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    render(<PostForm genres={mockGenres} draftId="draft-123" />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')

    // First change
    fireEvent.change(textarea, { target: { value: 'テスト1' } })
    await vi.advanceTimersByTimeAsync(3000)
    await waitFor(() => {
      expect(screen.getByText(/自動保存しました/)).toBeInTheDocument()
    })

    // Second change before savedDisplayTimer fires - this tests the
    // savedDisplayTimerRef.current truthy branch at line 197
    fireEvent.change(textarea, { target: { value: 'テスト12' } })
    await vi.advanceTimersByTimeAsync(3000)
    await waitFor(() => {
      expect(mockSaveDraft).toHaveBeenCalledTimes(2)
    })
  })
})

describe('PostForm - branch boost (poll without trimmed options)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreatePost.mockResolvedValue({ success: true })
  })

  it('does not include pollOptions when poll is active but options are all empty', async () => {
    render(<PostForm genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')
    fireEvent.change(textarea, { target: { value: 'テスト' } })

    // Select genre
    fireEvent.click(screen.getByText('ジャンルを選択（任意）'))
    fireEvent.click(screen.getByText('黒松'))

    // Activate poll
    fireEvent.click(screen.getByRole('button', { name: 'アンケートを追加' }))

    // Don't type anything in poll options (they remain empty strings)
    // Submit the form
    const submitButton = screen.getByRole('button', { name: '投稿する' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalled()
      const formData = mockCreatePost.mock.calls[0][0] as FormData
      // pollOptions should not be included since all options are empty/whitespace
      expect(formData.get('pollOptions')).toBeNull()
    })
  })
})
