/**
 * DraftEditForm - remaining uncovered branch tests
 *
 * Targets:
 * - Video file size too large (line 291-296)
 * - Image file size too large (line 300-306)
 * - Media limit reached (line 285-288)
 * - Delete exception catch block (line 499-500)
 * - Publish exception catch block (line 473-474)
 * - Publish confirm cancelled (line 443)
 * - Delete confirm cancelled (line 488)
 * - Save success path (line 424-427)
 * - Delete success path (line 495-497)
 * - Publish success path (line 468-472)
 * - Video upload with error field (line 320-321)
 * - Upload general exception (catch line 381-382)
 */

import React from 'react'
import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { DraftEditForm } from '@/components/draft/DraftEditForm'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

const mockSaveDraft = vi.fn()
const mockPublishDraft = vi.fn()
const mockDeleteDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  publishDraft: (...args: unknown[]) => mockPublishDraft(...args),
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
}))

vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) => (
    <div data-testid="genre-selector">
      <span data-testid="selected-genres">{selectedIds.join(',')}</span>
      <button onClick={() => onChange(['genre-1'])}>ジャンル選択</button>
    </div>
  ),
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

vi.mock('@/components/premium/PremiumContext', () => ({
  usePremium: () => true,
  PremiumContextProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe('DraftEditForm - remaining uncovered branches', () => {
  const mockDraft = {
    id: 'draft-1',
    content: 'テスト下書き',
    media: [],
    genres: [],
  }

  const mockGenres = {
    '樹種': [
      { id: 'genre-1', name: '松柏類', category: '樹種' },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ success: true })
    mockDeleteDraft.mockResolvedValue({ success: true })
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
  })

  // ----------------------------------------------------------------
  // Video file size too large
  // ----------------------------------------------------------------
  it('動画ファイルサイズ超過時にエラーを表示する', async () => {
    mockIsVideoFile.mockReturnValue(true)
    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const largeVideo = new File(['x'], 'big.mp4', { type: 'video/mp4' })
    Object.defineProperty(largeVideo, 'size', { value: 300 * 1024 * 1024 })

    Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeVideo] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/MB以下にしてください/)).toBeInTheDocument()
    })
    expect(mockUploadVideoToR2).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Image file size too large
  // ----------------------------------------------------------------
  it('画像ファイルサイズ超過時にエラーを表示する', async () => {
    mockIsVideoFile.mockReturnValue(false)
    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const largeImage = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeImage, 'size', { value: 15 * 1024 * 1024 })

    Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeImage] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/MB以下にしてください/)).toBeInTheDocument()
    })
    expect(mockPrepareFileForUpload).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Media limit reached (4 images already)
  // ----------------------------------------------------------------
  it('メディア上限到達時にエラーを表示する', async () => {
    const draftWithMedia = {
      ...mockDraft,
      media: [
        { id: 'm1', url: '/img1.jpg', type: 'image' },
        { id: 'm2', url: '/img2.jpg', type: 'image' },
        { id: 'm3', url: '/img3.jpg', type: 'image' },
        { id: 'm4', url: '/img4.jpg', type: 'image' },
      ],
    }
    const { container } = render(<DraftEditForm draft={draftWithMedia} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'extra.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('画像は4枚まで添付できます')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Delete exception catch block
  // ----------------------------------------------------------------
  it('削除で例外が発生した場合にエラーメッセージを表示する', async () => {
    mockDeleteDraft.mockRejectedValue(new Error('Network failure'))
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Publish exception catch block
  // ----------------------------------------------------------------
  it('投稿で例外が発生した場合にエラーメッセージを表示する', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockRejectedValue(new Error('Network failure'))
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Publish confirm cancelled
  // ----------------------------------------------------------------
  it('投稿確認キャンセル時は投稿しない', async () => {
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockSaveDraft).not.toHaveBeenCalled()
    expect(mockPublishDraft).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Delete confirm cancelled
  // ----------------------------------------------------------------
  it('削除確認キャンセル時は削除しない', async () => {
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockDeleteDraft).not.toHaveBeenCalled()
  })

  // ----------------------------------------------------------------
  // Save success path
  // ----------------------------------------------------------------
  it('保存成功時に下書き一覧に遷移する', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/drafts')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  // Save exception catch block
  // ----------------------------------------------------------------
  it('保存で例外が発生した場合にエラーメッセージを表示する', async () => {
    mockSaveDraft.mockRejectedValue(new Error('Network failure'))
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

    await waitFor(() => {
      expect(screen.getByText('下書きの保存に失敗しました')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Delete success path
  // ----------------------------------------------------------------
  it('削除成功時に下書き一覧に遷移する', async () => {
    mockDeleteDraft.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /削除/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/drafts')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  // Publish success path
  // ----------------------------------------------------------------
  it('投稿成功時にフィードページに遷移する', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------------
  // Video upload error with truthy error field
  // ----------------------------------------------------------------
  it('動画アップロードでerrorが返された場合にエラーを表示する', async () => {
    mockIsVideoFile.mockReturnValue(true)
    mockUploadVideoToR2.mockResolvedValue({ error: '動画アップロードエラー' })

    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('動画アップロードエラー')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // General upload exception (catch block line 381-382)
  // ----------------------------------------------------------------
  it('アップロード中の予期しない例外でエラーを表示する', async () => {
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockRejectedValue(new Error('Compression failed'))

    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Publish with publishDraft returning error with string value
  // ----------------------------------------------------------------
  it('投稿変換でerrorメッセージ付きの場合にエラーを表示する', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ error: '投稿制限に達しています' })
    const user = userEvent.setup()
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    await user.click(screen.getByRole('button', { name: /投稿する/ }))
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(screen.getByText('投稿制限に達しています')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Content empty and media empty: publish button disabled
  // ----------------------------------------------------------------
  it('コンテンツもメディアもない場合は投稿ボタンが無効', () => {
    const emptyDraft = {
      ...mockDraft,
      content: '',
    }
    render(<DraftEditForm draft={emptyDraft} genres={mockGenres} />)

    const publishBtn = screen.getByRole('button', { name: /投稿する/ })
    expect(publishBtn).toBeDisabled()
  })

  // ----------------------------------------------------------------
  // Character count over limit: publish button disabled
  // ----------------------------------------------------------------
  it('文字数超過時は投稿ボタンが無効でテキストが赤色になる', () => {
    const longContent = 'a'.repeat(501)
    const longDraft = {
      ...mockDraft,
      content: longContent,
    }
    render(<DraftEditForm draft={longDraft} genres={mockGenres} />)

    const publishBtn = screen.getByRole('button', { name: /投稿する/ })
    expect(publishBtn).toBeDisabled()

    // Remaining chars should be negative and shown in destructive color
    expect(screen.getByText('-1')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // removeMedia removes the correct item
  // ----------------------------------------------------------------
  it('メディア削除でアイテムが正しく削除される', () => {
    const draftWithMedia = {
      ...mockDraft,
      media: [
        { id: 'm1', url: '/img1.jpg', type: 'image' },
        { id: 'm2', url: '/img2.jpg', type: 'image' },
      ],
    }
    const { container } = render(<DraftEditForm draft={draftWithMedia} genres={mockGenres} />)

    // Initially two images
    expect(container.querySelectorAll('img[src="/img1.jpg"]').length).toBe(1)
    expect(container.querySelectorAll('img[src="/img2.jpg"]').length).toBe(1)

    // Find and click the first delete button (X icon)
    const deleteButtons = container.querySelectorAll('button[type="button"]')
    const xButtons = Array.from(deleteButtons).filter(btn => btn.querySelector('svg.lucide-x'))
    if (xButtons[0]) {
      fireEvent.click(xButtons[0])
    }

    // One image should remain
    const remainingImages = container.querySelectorAll('img[src="/img1.jpg"], img[src="/img2.jpg"]')
    expect(remainingImages.length).toBe(1)
  })
})
