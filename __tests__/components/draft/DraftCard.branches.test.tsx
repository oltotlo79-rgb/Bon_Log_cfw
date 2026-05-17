/**
 * DraftCard - 未カバー分岐テスト
 *
 * 対象分岐:
 * - handlePublish: confirm が false を返す場合
 * - handleDelete: deleteDraft が例外を投げる場合（catchブロック）
 * - handlePublish: publishDraft が例外を投げる場合（catchブロック）
 * - handlePublish: publishDraft が success: false を返す場合（'error' in result が false）
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { DraftCard } from '@/components/draft/DraftCard'

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

const mockDeleteDraft = vi.fn()
const mockPublishDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
  publishDraft: (...args: unknown[]) => mockPublishDraft(...args),
}))

const mockConfirm = vi.fn()
window.confirm = mockConfirm

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

describe('DraftCard - 未カバー分岐', () => {
  const mockDraft = {
    id: 'draft-1',
    content: 'テスト下書き',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15T10:30:00'),
    media: [],
    genres: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfirm.mockReturnValue(true)
    mockDeleteDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ success: true })
  })

  it('投稿確認でキャンセルを押すと投稿APIを呼び出さない', () => {
    mockConfirm.mockReturnValue(false)
    render(<DraftCard draft={mockDraft} />)

    fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

    expect(mockPublishDraft).not.toHaveBeenCalled()
  })

  it('削除で例外が発生した場合にトーストを表示する', async () => {
    mockDeleteDraft.mockRejectedValue(new Error('Network failure'))
    render(<DraftCard draft={mockDraft} />)

    fireEvent.click(screen.getByRole('button', { name: /削除/ }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '削除に失敗しました', variant: 'destructive' })
      )
    })
  })

  it('投稿で例外が発生した場合にトーストを表示する', async () => {
    mockPublishDraft.mockRejectedValue(new Error('Network failure'))
    render(<DraftCard draft={mockDraft} />)

    fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: '投稿に失敗しました', variant: 'destructive' })
      )
    })
  })

  it('deleteDraft が success: false でエラーメッセージ付きの場合にトーストを表示する', async () => {
    mockDeleteDraft.mockResolvedValue({ success: false, error: 'カスタムエラー' })
    render(<DraftCard draft={mockDraft} />)

    fireEvent.click(screen.getByRole('button', { name: /削除/ }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'カスタムエラー', variant: 'destructive' })
      )
    })
    // refresh は呼ばれない（エラーなので）
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('メディアが1〜4件の場合は残数表示がない', () => {
    const draftWith3Media = {
      ...mockDraft,
      media: [
        { id: 'm1', url: '/img1.jpg', type: 'image' },
        { id: 'm2', url: '/img2.jpg', type: 'image' },
        { id: 'm3', url: '/img3.jpg', type: 'image' },
      ],
    }
    render(<DraftCard draft={draftWith3Media} />)

    expect(screen.queryByText(/\+\d/)).not.toBeInTheDocument()
  })

  it('ジャンルが空の場合はタグセクションが表示されない', () => {
    render(<DraftCard draft={mockDraft} />)

    // ジャンルタグのコンテナが存在しない
    expect(screen.queryByText('松柏類')).not.toBeInTheDocument()
  })

  it('メディアが空の場合はプレビューセクションが表示されない', () => {
    const { container } = render(<DraftCard draft={mockDraft} />)

    // メディアプレビューの親コンテナが存在しない
    expect(container.querySelector('.mt-3.flex.gap-2')).not.toBeInTheDocument()
  })
})
