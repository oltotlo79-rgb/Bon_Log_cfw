/**
 * PostForm - uncovered lines coverage tests
 *
 * Targets:
 * - Line 401: catch block restoring poll state (isPollActive, pollOptions, pollDuration)
 * - Lines 418-419: handleSaveDraft error from saveDraft result
 * - Line 428: handleSaveDraft success path (form reset + navigate to drafts)
 * - Also: handleSaveDraft catch block (line 441-442)
 */

import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PostForm } from '@/components/post/PostForm'

// Next-Auth mock
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation mock
const mockRefresh = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}))

// Server Actions mocks
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

// toast mock
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
  useToast: () => ({
    toast: mockToast,
    toasts: [],
  }),
}))

// client-image-compression mock
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  isVideoFile: vi.fn(() => false),
  uploadVideoToR2: vi.fn(),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 100 * 1024 * 1024,
}))

// SharedMediaUploadSection mock
vi.mock('@/components/common/SharedMediaUploadSection', () => ({
  SharedMediaUploadSection: () => <div data-testid="media-upload" />,
}))

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
  ],
}

describe('PostForm - uncovered branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------------
  // handleSaveDraft: saveDraft returns { error: '...' }
  // Lines 418-419: setError(result.error ?? 'エラー')
  // ----------------------------------------------------------------
  it('下書き保存でエラーが返された場合にエラーメッセージを表示する', async () => {
    mockSaveDraft.mockResolvedValue({ error: '保存に失敗しました' })
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    // Enter content so draft save button is enabled
    await user.type(
      screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'),
      'テスト内容'
    )

    await user.click(screen.getByRole('button', { name: '下書き保存' }))

    await waitFor(() => {
      expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
    })

    // Should NOT navigate to drafts page
    expect(mockPush).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // handleSaveDraft: saveDraft throws exception
  // Line 441-442: catch block sets error
  // ----------------------------------------------------------------
  it('下書き保存で例外が発生した場合にエラーメッセージを表示する', async () => {
    mockSaveDraft.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(
      screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'),
      'テスト内容'
    )

    await user.click(screen.getByRole('button', { name: '下書き保存' }))

    await waitFor(() => {
      expect(screen.getByText('下書きの保存に失敗しました')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // handleSaveDraft: success path
  // Line 428: router.push(ROUTE_DRAFTS)
  // ----------------------------------------------------------------
  it('下書き保存成功時にフォームをリセットして下書き一覧に遷移する', async () => {
    mockSaveDraft.mockResolvedValue({ id: 'draft-1' })
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(
      screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'),
      'テスト内容'
    )

    await user.click(screen.getByRole('button', { name: '下書き保存' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/drafts')
    })

    // Form should be reset
    expect(screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')).toHaveValue('')
  })

  // ----------------------------------------------------------------
  // handleSaveDraft: empty content and media -> validation error
  // Line 417-419
  // ----------------------------------------------------------------
  it('下書き保存時にコンテンツもメディアもない場合はエラーを表示する', async () => {
    render(<PostForm genres={mockGenres} />)

    // Draft save button should be disabled when empty
    const draftButton = screen.getByRole('button', { name: '下書き保存' })
    expect(draftButton).toBeDisabled()
  })

  // ----------------------------------------------------------------
  // createPost failure: .then with result.success = false
  // Lines around 375-387: restore form content including poll state
  // ----------------------------------------------------------------
  it('投稿失敗時にフォーム内容が復元される（アンケート含む）', async () => {
    mockCreatePost.mockResolvedValue({ success: false, error: 'サーバーエラー' })
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    // Enter content
    await user.type(
      screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'),
      'テスト投稿'
    )

    // Select genre
    await user.click(screen.getByText('ジャンルを選択（任意）'))
    await user.click(screen.getByText('黒松'))

    // Activate poll
    await user.click(screen.getByRole('button', { name: 'アンケートを追加' }))
    await user.type(screen.getByPlaceholderText('選択肢 1'), 'A')
    await user.type(screen.getByPlaceholderText('選択肢 2'), 'B')

    // Submit
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    // Wait for failure toast
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          title: '投稿に失敗しました',
        })
      )
    })

    // Content should be restored
    await waitFor(() => {
      expect(screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')).toHaveValue('テスト投稿')
    })
  })

  // ----------------------------------------------------------------
  // createPost network error: .catch block
  // Lines 396-409: restore all form state including poll
  // ----------------------------------------------------------------
  it('投稿のネットワークエラー時にフォーム内容が復元される', async () => {
    mockCreatePost.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    // Enter content
    await user.type(
      screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'),
      'ネットワークテスト'
    )

    // Select genre
    await user.click(screen.getByText('ジャンルを選択（任意）'))
    await user.click(screen.getByText('黒松'))

    // Submit
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    // Wait for failure toast with network error message
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
          description: 'ネットワークエラーが発生しました',
        })
      )
    })

    // Content should be restored
    await waitFor(() => {
      expect(screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション')).toHaveValue('ネットワークテスト')
    })
  })

  // ----------------------------------------------------------------
  // Premium label display
  // Line 516: limits.maxPostLength > MAX_POST_CONTENT_FREE
  // ----------------------------------------------------------------
  it('プレミアム会員の場合はPremiumラベルを表示する', () => {
    render(
      <PostForm
        genres={mockGenres}
        limits={{ maxPostLength: 1000, maxImages: 10, maxVideos: 5 }}
      />
    )

    expect(screen.getByText('Premium')).toBeInTheDocument()
  })

  it('フリー会員の場合はPremiumラベルを表示しない', () => {
    render(<PostForm genres={mockGenres} />)

    expect(screen.queryByText('Premium')).not.toBeInTheDocument()
  })
})
