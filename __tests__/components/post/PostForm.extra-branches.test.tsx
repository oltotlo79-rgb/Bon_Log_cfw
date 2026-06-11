/**
 * PostForm - additional uncovered branch tests
 *
 * Targets:
 * - Video file size too large (handleFileSelect line 239-241)
 * - Image file size too large (handleFileSelect line 244-246)
 * - Video upload error from uploadVideoToR2 (handleFileSelect line 259)
 * - Video upload success (handleFileSelect line 261-262)
 * - createPost success path (handleSubmit line 388-394)
 * - Empty file list (handleFileSelect line 220-221)
 * - handleSaveDraft with no content but has media (button should be enabled)
 * - CharacterCountRing warning state (remaining <= threshold)
 * - CharacterCountRing over state (remaining < 0)
 * - draftId absent: no auto-save indicator displayed
 */

import React from 'react'
import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
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

const mockPrepareFileForUpload = vi.fn()
const mockIsVideoFile = vi.fn()
const mockUploadVideoToR2 = vi.fn()

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: unknown[]) => mockPrepareFileForUpload(...args),
  isVideoFile: (...args: unknown[]) => mockIsVideoFile(...args),
  formatFileSize: vi.fn().mockReturnValue('1 MB'),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 80 * 1024 * 1024,
  uploadVideoToR2: (...args: unknown[]) => mockUploadVideoToR2(...args),
}))

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
  ],
}

// 動画テストにはプレミアム制限値を渡す（maxVideos=1 で動画アップロードが許可される）
const premiumLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  maxDailyPosts: 20,
  canSchedulePost: false,
  canViewAnalytics: false,
}

describe('PostForm - extra uncovered branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
  })

  // ----------------------------------------------------------------
  // Video file too large
  // ----------------------------------------------------------------
  it('動画ファイルサイズ超過時にエラーを表示しアップロードしない', async () => {
    mockIsVideoFile.mockReturnValue(true)
    const { container } = render(<PostForm genres={mockGenres} limits={premiumLimits} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const largeVideo = new File(['x'], 'big.mp4', { type: 'video/mp4' })
    Object.defineProperty(largeVideo, 'size', { value: 100 * 1024 * 1024 }) // 100MB > 80MB

    Object.defineProperty(fileInput, 'files', { value: [largeVideo], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/MB以下にしてください/)).toBeInTheDocument()
    })
    expect(mockUploadVideoToR2).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Image file too large
  // ----------------------------------------------------------------
  it('画像ファイルサイズ超過時にエラーを表示しアップロードしない', async () => {
    mockIsVideoFile.mockReturnValue(false)
    const { container } = render(<PostForm genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const largeImage = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeImage, 'size', { value: 15 * 1024 * 1024 }) // 15MB > 10MB

    Object.defineProperty(fileInput, 'files', { value: [largeImage], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/MB以下にしてください/)).toBeInTheDocument()
    })
    expect(mockPrepareFileForUpload).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Video upload error from uploadVideoToR2
  // ----------------------------------------------------------------
  it('動画アップロードエラー時にエラーを表示する', async () => {
    mockIsVideoFile.mockReturnValue(true)
    mockUploadVideoToR2.mockResolvedValue({ error: '動画アップロード失敗' })

    const { container } = render(<PostForm genres={mockGenres} limits={premiumLimits} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const video = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { value: [video], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('動画アップロード失敗')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // createPost success path
  // ----------------------------------------------------------------
  it('投稿成功時にトースト表示とタイムライン更新を実行する', async () => {
    mockCreatePost.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'), 'テスト投稿')
    await user.click(screen.getByText('ジャンルを選択（任意）'))
    await user.click(screen.getByText('黒松'))
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '投稿しました',
        })
      )
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  // Empty file list
  // ----------------------------------------------------------------
  it('ファイルリストが空の場合は何も起きない', () => {
    const { container } = render(<PostForm genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    Object.defineProperty(fileInput, 'files', { value: [], configurable: true })
    fireEvent.change(fileInput)

    expect(mockPrepareFileForUpload).not.toHaveBeenCalled()
    expect(mockUploadVideoToR2).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Upload catch block (general exception)
  // ----------------------------------------------------------------
  it('アップロード中の予期しない例外でエラーを表示する', async () => {
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockRejectedValue(new Error('Compression failed'))

    const { container } = render(<PostForm genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // draftId absent: auto-save indicator should not show
  // ----------------------------------------------------------------
  it('draftIdがない場合は自動保存インジケーターが表示されない', () => {
    render(<PostForm genres={mockGenres} />)

    expect(screen.queryByText(/自動保存しました/)).not.toBeInTheDocument()
    expect(screen.queryByText(/保存中\.\.\./)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // handleSaveDraft with error as null (fallback to 'エラー')
  // ----------------------------------------------------------------
  it('下書き保存でerrorがnullの場合にデフォルトエラーを表示する', async () => {
    mockSaveDraft.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<PostForm genres={mockGenres} />)

    await user.type(
      screen.getByPlaceholderText('いまどうしてる？ @でユーザーをメンション'),
      'テスト内容'
    )

    await user.click(screen.getByRole('button', { name: '下書き保存' }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })
})
