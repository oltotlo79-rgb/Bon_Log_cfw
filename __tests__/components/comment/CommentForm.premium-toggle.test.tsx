/**
 * CommentForm — usePremium toggle: free vs premium video upload behavior.
 *
 * Verifies:
 * - Free user (usePremium=false): file input accept has no video MIME; upload rejected with ERR_VIDEO_PREMIUM_ONLY
 * - Premium user (usePremium=true): file input accept includes video MIME
 */

import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

vi.mock('@/lib/actions/comment', () => ({
  createComment: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: vi.fn().mockResolvedValue([]),
}))

let mockIsPremium = false
vi.mock('@/components/premium/PremiumContext', () => ({
  usePremium: () => mockIsPremium,
  PremiumContextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const mockIsVideoFile = vi.fn()
const mockPrepareFileForUpload = vi.fn()
const mockUploadVideoToR2 = vi.fn()

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: unknown[]) => mockPrepareFileForUpload(...args),
  isVideoFile: (...args: unknown[]) => mockIsVideoFile(...args),
  formatFileSize: vi.fn().mockReturnValue('1 MB'),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 80 * 1024 * 1024,
  uploadVideoToR2: (...args: unknown[]) => mockUploadVideoToR2(...args),
}))

describe('CommentForm — free vs premium video behavior', async () => {
  const { CommentForm } = await import('@/components/comment/CommentForm')

  const defaultProps = {
    postId: 'post-1',
    postUserId: 'author-1',
    onCommentCreated: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(
      new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    )
  })

  it('無料会員のとき file input の accept に video MIME が含まれない', () => {
    mockIsPremium = false
    const { container } = render(<CommentForm {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    expect(fileInput).not.toBeNull()
    const accept = fileInput.getAttribute('accept') ?? ''
    expect(accept).not.toContain('video/')
    expect(accept).toContain('image/jpeg')
  })

  it('プレミアム会員のとき file input の accept に video MIME が含まれる', () => {
    mockIsPremium = true
    const { container } = render(<CommentForm {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    expect(fileInput).not.toBeNull()
    const accept = fileInput.getAttribute('accept') ?? ''
    expect(accept).toContain('video/')
  })

  it('無料会員が動画ファイルを選択すると ERR_VIDEO_PREMIUM_ONLY エラーが表示される', async () => {
    mockIsPremium = false
    mockIsVideoFile.mockReturnValue(true)

    const { container } = render(<CommentForm {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const videoFile = new File(['v'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { value: [videoFile], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('動画の投稿はプレミアム会員限定です')).toBeInTheDocument()
    })
    expect(mockUploadVideoToR2).not.toHaveBeenCalled()
  })

  it('プレミアム会員が動画ファイルを選択するとアップロードが試みられる', async () => {
    mockIsPremium = true
    mockIsVideoFile.mockReturnValue(true)
    mockUploadVideoToR2.mockResolvedValue({ url: '/video.mp4', type: 'video' })

    const { container } = render(<CommentForm {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const videoFile = new File(['v'], 'clip.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { value: [videoFile], configurable: true })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(mockUploadVideoToR2).toHaveBeenCalled()
    })
  })
})
