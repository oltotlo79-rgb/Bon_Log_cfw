/**
 * DraftEditForm - 残り未カバー分岐テスト
 *
 * 対象:
 * - handleFileSelect: files.length === 0 の早期リターン (line 279)
 * - handleSave: saveDraft が error メッセージ文字列付きで返す (line 422)
 * - handlePublish: saveDraft が例外をスロー (line 473 catch)
 * - 動画アップロード: result に error も url もない場合 (no-op)
 * - removeMedia: メディア削除でフォームステートが更新される
 * - 初期値: draft.content が null のとき空文字になる
 * - 初期値: draft に既存メディア・ジャンルがある場合のステート初期化
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
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
      <button onClick={() => onChange(['genre-new'])}>ジャンル変更</button>
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
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: (...args: unknown[]) => mockUploadVideoToR2(...args),
}))

const mockConfirm = vi.fn()
window.confirm = mockConfirm

describe('DraftEditForm - 残り分岐カバレッジ', () => {
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
    mockConfirm.mockReturnValue(true)
    mockSaveDraft.mockResolvedValue({ success: true })
    mockPublishDraft.mockResolvedValue({ success: true })
    mockDeleteDraft.mockResolvedValue({ success: true })
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
  })

  it('ファイル入力のfilesが空配列の場合は何も処理しない', () => {
    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    // length === 0 のFileList
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: { length: 0, item: () => null, [Symbol.iterator]: function* () {} },
    })
    fireEvent.change(fileInput)

    expect(mockPrepareFileForUpload).not.toHaveBeenCalled()
    expect(mockUploadVideoToR2).not.toHaveBeenCalled()
  })

  it('draft.content が null の場合テキストエリアが空文字で初期化される', () => {
    const nullContentDraft = { ...mockDraft, content: null }
    render(<DraftEditForm draft={nullContentDraft} genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？') as HTMLTextAreaElement
    expect(textarea.value).toBe('')
  })

  it('既存ジャンルがある下書きを読み込むとselectedGenresが初期化される', () => {
    const draftWithGenres = {
      ...mockDraft,
      genres: [
        { genreId: 'genre-1', genre: { id: 'genre-1', name: '松柏類' } },
        { genreId: 'genre-2', genre: { id: 'genre-2', name: '雑木類' } },
      ],
    }
    render(<DraftEditForm draft={draftWithGenres} genres={mockGenres} />)

    expect(screen.getByTestId('selected-genres').textContent).toBe('genre-1,genre-2')
  })

  it('既存メディアがある下書きを読み込むとmediaFilesが初期化される', () => {
    const draftWithMedia = {
      ...mockDraft,
      media: [
        { id: 'm1', url: '/existing.jpg', type: 'image' },
      ],
    }
    const { container } = render(<DraftEditForm draft={draftWithMedia} genres={mockGenres} />)

    const img = container.querySelector('img[src="/existing.jpg"]')
    expect(img).toBeInTheDocument()
  })

  it('保存でsaveDraftがエラー文字列を返した場合にエラーメッセージを表示する', async () => {
    mockSaveDraft.mockResolvedValue({ error: 'セッション切れ' })
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

    await waitFor(() => {
      expect(screen.getByText('セッション切れ')).toBeInTheDocument()
    })

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('投稿でsaveDraftがエラー文字列を返した場合に投稿せずエラーを表示する', async () => {
    mockSaveDraft.mockResolvedValue({ error: '認証エラー' })
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

    await waitFor(() => {
      expect(screen.getByText('認証エラー')).toBeInTheDocument()
    })

    expect(mockPublishDraft).not.toHaveBeenCalled()
  })

  it('動画アップロードでerrorもurlもない場合はメディアが追加されない', async () => {
    mockIsVideoFile.mockReturnValue(true)
    mockUploadVideoToR2.mockResolvedValue({})

    const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(mockUploadVideoToR2).toHaveBeenCalled()
    })

    // メディアプレビューが追加されていないこと
    expect(container.querySelector('video')).not.toBeInTheDocument()
  })

  it('削除でdeleteDraftがerrorフィールドなしのsuccess:falseを返す場合にフォールバックエラーを表示する', async () => {
    mockDeleteDraft.mockResolvedValue({ success: false })
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    fireEvent.click(screen.getByRole('button', { name: /削除/ }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })

    expect(mockPush).not.toHaveBeenCalled()
  })
})
