import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { DraftEditForm } from '@/components/draft/DraftEditForm'

// next/navigation モック
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// next/image モック
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, fill, className }: { src: string; alt: string; fill?: boolean; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} data-fill={fill} className={className} />
  ),
}))

// Server Actions モック
const mockSaveDraft = vi.fn()
const mockPublishDraft = vi.fn()
const mockDeleteDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
  publishDraft: (...args: unknown[]) => mockPublishDraft(...args),
  deleteDraft: (...args: unknown[]) => mockDeleteDraft(...args),
}))

// GenreSelector モック
vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) => (
    <div data-testid="genre-selector">
      <span data-testid="selected-genres">{selectedIds.join(',')}</span>
      <button onClick={() => onChange(['genre-1', 'genre-2'])}>ジャンル選択</button>
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

class MockXHR {
  status = 200
  responseText = '{}'
  upload = { addEventListener: vi.fn() }
  addEventListener = vi.fn()
  open = vi.fn()
  send = vi.fn()
  abort = vi.fn()
}

const mockXHRInstances: MockXHR[] = []
const OriginalXHR = global.XMLHttpRequest

// window.confirm モック
const mockConfirm = vi.fn()
window.confirm = mockConfirm

describe('DraftEditForm', () => {
  const mockDraft = {
    id: 'draft-1',
    content: 'テスト下書き',
    media: [],
    genres: [
      { genreId: 'genre-1', genre: { id: 'genre-1', name: '松柏類' } },
    ],
  }

  const mockGenres = {
    '樹種': [
      { id: 'genre-1', name: '松柏類', category: '樹種' },
      { id: 'genre-2', name: '雑木類', category: '樹種' },
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
    mockXHRInstances.length = 0
    global.XMLHttpRequest = vi.fn(function() {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        const loadCb = instance.addEventListener.mock.calls.find((c: unknown[]) => c[0] === 'load')
        if (loadCb) {
          instance.status = 200
          instance.responseText = JSON.stringify({ url: '/uploaded.jpg', type: 'image' })
          loadCb[1]()
        }
      })
      mockXHRInstances.push(instance)
      return instance
    }) as unknown as typeof XMLHttpRequest
  })

  afterAll(() => {
    global.XMLHttpRequest = OriginalXHR
  })

  it('下書き内容を表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByDisplayValue('テスト下書き')).toBeInTheDocument()
  })

  it('テキストエリアで編集できる', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    fireEvent.change(textarea, { target: { value: '新しい内容' } })

    expect(screen.getByDisplayValue('新しい内容')).toBeInTheDocument()
  })

  it('残り文字数を表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    // 「テスト下書き」は6文字
    expect(screen.getByText('494')).toBeInTheDocument()
  })

  it('文字数が50未満になると残り文字数を表示する', () => {
    const longContent = 'あ'.repeat(460)
    const draft = { ...mockDraft, content: longContent }
    const { container } = render(<DraftEditForm draft={draft} genres={mockGenres} />)

    // 500 - 460 = 40 残り文字数
    const charCount = container.querySelector('.text-muted-foreground')
    expect(charCount).toBeInTheDocument()
    expect(charCount).toHaveTextContent('40')
  })

  it('文字数超過時に赤色を表示する', () => {
    const longContent = 'あ'.repeat(510)
    const draft = { ...mockDraft, content: longContent }
    const { container } = render(<DraftEditForm draft={draft} genres={mockGenres} />)

    const charCount = container.querySelector('.text-destructive')
    expect(charCount).toBeInTheDocument()
  })

  it('ジャンルセレクターを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByTestId('genre-selector')).toBeInTheDocument()
    expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
  })

  it('下書き保存ボタンを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByRole('button', { name: /下書き保存/ })).toBeInTheDocument()
  })

  it('投稿するボタンを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByRole('button', { name: /投稿する/ })).toBeInTheDocument()
  })

  it('削除ボタンを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByRole('button', { name: /削除/ })).toBeInTheDocument()
  })

  it('画像を追加ボタンを表示する', () => {
    render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

    expect(screen.getByRole('button', { name: /画像を追加/ })).toBeInTheDocument()
  })

  describe('保存機能', () => {
    it('保存ボタンをクリックするとsaveDraftを呼び出す', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith({
          id: 'draft-1',
          content: 'テスト下書き',
          mediaUrls: [],
          genreIds: ['genre-1'],
        })
      })
    })

    it('保存成功時に下書き一覧に遷移する', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/drafts')
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('保存中は「保存中...」を表示する', async () => {
      mockSaveDraft.mockImplementation(() => new Promise(() => {}))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(screen.getByText('保存中...')).toBeInTheDocument()
      })
    })

    it('保存エラー時にエラーメッセージを表示する', async () => {
      mockSaveDraft.mockResolvedValue({ error: '保存に失敗しました' })
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('投稿機能', () => {
    it('投稿ボタンをクリックすると確認ダイアログを表示する', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      expect(mockConfirm).toHaveBeenCalledWith('この下書きを投稿しますか？')
    })

    it('確認ダイアログでOKを押すとpublishDraftを呼び出す', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalled()
        expect(mockPublishDraft).toHaveBeenCalledWith('draft-1')
      })
    })

    it('確認ダイアログでキャンセルを押すと何もしない', () => {
      mockConfirm.mockReturnValue(false)
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      expect(mockPublishDraft).not.toHaveBeenCalled()
    })

    it('投稿成功時にフィードに遷移する', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/feed')
      })
    })

    it('投稿中は「投稿中...」を表示する', async () => {
      mockSaveDraft.mockResolvedValue({ success: true })
      mockPublishDraft.mockImplementation(() => new Promise(() => {}))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(screen.getByText('投稿中...')).toBeInTheDocument()
      })
    })

    it('コンテンツがなく画像もない場合は投稿ボタンを無効化する', () => {
      const emptyDraft = { ...mockDraft, content: '', media: [] }
      render(<DraftEditForm draft={emptyDraft} genres={mockGenres} />)

      expect(screen.getByRole('button', { name: /投稿する/ })).toBeDisabled()
    })

    it('画像がある場合はコンテンツがなくても投稿できる', () => {
      const draftWithMedia = {
        ...mockDraft,
        content: '',
        media: [{ id: 'media-1', url: '/image.jpg', type: 'image' }]
      }
      render(<DraftEditForm draft={draftWithMedia} genres={mockGenres} />)

      expect(screen.getByRole('button', { name: /投稿する/ })).not.toBeDisabled()
    })
  })

  describe('削除機能', () => {
    it('削除ボタンをクリックすると確認ダイアログを表示する', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      expect(mockConfirm).toHaveBeenCalledWith('この下書きを削除しますか？')
    })

    it('確認ダイアログでOKを押すとdeleteDraftを呼び出す', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(mockDeleteDraft).toHaveBeenCalledWith('draft-1')
      })
    })

    it('確認ダイアログでキャンセルを押すと何もしない', () => {
      mockConfirm.mockReturnValue(false)
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      expect(mockDeleteDraft).not.toHaveBeenCalled()
    })

    it('削除成功時に下書き一覧に遷移する', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/drafts')
      })
    })

    it('削除中は「削除中...」を表示する', async () => {
      mockDeleteDraft.mockImplementation(() => new Promise(() => {}))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(screen.getByText('削除中...')).toBeInTheDocument()
      })
    })

    it('削除エラー時にエラーメッセージを表示する', async () => {
      mockDeleteDraft.mockResolvedValue({ error: '削除に失敗しました' })
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(screen.getByText('削除に失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('メディア表示', () => {
    it('画像メディアを表示する', () => {
      const draftWithImage = {
        ...mockDraft,
        media: [{ id: 'media-1', url: '/image.jpg', type: 'image' }],
      }
      const { container } = render(<DraftEditForm draft={draftWithImage} genres={mockGenres} />)

      const img = container.querySelector('img[src="/image.jpg"]')
      expect(img).toBeInTheDocument()
    })

    it('動画メディアを表示する', () => {
      const draftWithVideo = {
        ...mockDraft,
        media: [{ id: 'media-1', url: '/video.mp4', type: 'video' }],
      }
      const { container } = render(<DraftEditForm draft={draftWithVideo} genres={mockGenres} />)

      const video = container.querySelector('video[src="/video.mp4"]')
      expect(video).toBeInTheDocument()
    })

    it('メディア削除ボタンをクリックするとメディアを削除する', () => {
      const draftWithMedia = {
        ...mockDraft,
        media: [{ id: 'media-1', url: '/image.jpg', type: 'image' }],
      }
      const { container } = render(<DraftEditForm draft={draftWithMedia} genres={mockGenres} />)

      expect(container.querySelector('img[src="/image.jpg"]')).toBeInTheDocument()

      // 削除ボタンをクリック（X アイコン）
      const deleteButtons = screen.getAllByRole('button')
      const deleteButton = deleteButtons.find(btn => btn.querySelector('svg'))
      if (deleteButton) {
        fireEvent.click(deleteButton)
      }

      expect(container.querySelector('img[src="/image.jpg"]')).not.toBeInTheDocument()
    })

    it('複数メディアを表示する', () => {
      const draftWithMultipleMedia = {
        ...mockDraft,
        media: [
          { id: 'media-1', url: '/image1.jpg', type: 'image' },
          { id: 'media-2', url: '/image2.jpg', type: 'image' },
        ],
      }
      const { container } = render(<DraftEditForm draft={draftWithMultipleMedia} genres={mockGenres} />)

      expect(container.querySelector('img[src="/image1.jpg"]')).toBeInTheDocument()
      expect(container.querySelector('img[src="/image2.jpg"]')).toBeInTheDocument()
    })
  })

  describe('初期値', () => {
    it('contentがnullの場合は空文字を表示する', () => {
      const draftWithNullContent = { ...mockDraft, content: null }
      render(<DraftEditForm draft={draftWithNullContent} genres={mockGenres} />)

      const textarea = screen.getByPlaceholderText('いまどうしてる？')
      expect(textarea).toHaveValue('')
    })

    it('genresがある場合は選択済みにする', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
    })
  })

  describe('エラーハンドリング', () => {
    it('保存時に例外が発生した場合はエラーメッセージを表示する', async () => {
      mockSaveDraft.mockRejectedValue(new Error('Network error'))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(screen.getByText('下書きの保存に失敗しました')).toBeInTheDocument()
      })
    })

    it('投稿時に例外が発生した場合はエラーメッセージを表示する', async () => {
      mockSaveDraft.mockResolvedValue({ success: true })
      mockPublishDraft.mockRejectedValue(new Error('Network error'))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(screen.getByText('投稿に失敗しました')).toBeInTheDocument()
      })
    })

    it('削除時に例外が発生した場合はエラーメッセージを表示する', async () => {
      mockDeleteDraft.mockRejectedValue(new Error('Network error'))
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(screen.getByText('削除に失敗しました')).toBeInTheDocument()
      })
    })

    it('投稿エラー時にエラーメッセージを表示する', async () => {
      mockSaveDraft.mockResolvedValue({ success: true })
      mockPublishDraft.mockResolvedValue({ error: '投稿に失敗しました' })
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(screen.getByText('投稿に失敗しました')).toBeInTheDocument()
      })
    })

    it('保存に失敗した場合は投稿を中止する', async () => {
      mockSaveDraft.mockResolvedValue({ error: '保存に失敗しました' })
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
        expect(mockPublishDraft).not.toHaveBeenCalled()
      })
    })
  })

  describe('ジャンル選択', () => {
    it('ジャンル選択を変更できる', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: 'ジャンル選択' }))

      expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1,genre-2')
    })

    it('下書きのジャンルが初期選択される', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
    })
  })

  describe('文字数制限', () => {
    it('文字数オーバー時に投稿ボタンを無効化する', () => {
      const longContent = 'あ'.repeat(501)
      const draft = { ...mockDraft, content: longContent }
      render(<DraftEditForm draft={draft} genres={mockGenres} />)

      expect(screen.getByRole('button', { name: /投稿する/ })).toBeDisabled()
    })

    it('ちょうど500文字の場合は投稿可能', () => {
      const exactContent = 'あ'.repeat(500)
      const draft = { ...mockDraft, content: exactContent }
      render(<DraftEditForm draft={draft} genres={mockGenres} />)

      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /投稿する/ })).not.toBeDisabled()
    })

    it('499文字の場合は残り1文字を表示する', () => {
      const content = 'あ'.repeat(499)
      const draft = { ...mockDraft, content }
      render(<DraftEditForm draft={draft} genres={mockGenres} />)

      expect(screen.getByText('1')).toBeInTheDocument()
    })
  })

  describe('追加テスト', () => {
    it('保存時に編集後のcontentが送信される', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      const textarea = screen.getByPlaceholderText('いまどうしてる？')
      fireEvent.change(textarea, { target: { value: '更新されたテキスト' } })
      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith(
          expect.objectContaining({ content: '更新されたテキスト' })
        )
      })
    })

    it('ジャンル変更後に保存すると新しいジャンルが送信される', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: 'ジャンル選択' }))
      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith(
          expect.objectContaining({ genreIds: ['genre-1', 'genre-2'] })
        )
      })
    })

    it('エラー後に再度保存するとエラーがクリアされる', async () => {
      mockSaveDraft.mockResolvedValueOnce({ error: '保存に失敗しました' })
      mockSaveDraft.mockResolvedValueOnce({ success: true })
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))
      await waitFor(() => {
        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))
      await waitFor(() => {
        expect(screen.queryByText('保存に失敗しました')).not.toBeInTheDocument()
      })
    })

    it('画像を追加ボタンは4枚以上で無効化される', () => {
      const draftWith4Media = {
        ...mockDraft,
        media: [
          { id: '1', url: '/img1.jpg', type: 'image' },
          { id: '2', url: '/img2.jpg', type: 'image' },
          { id: '3', url: '/img3.jpg', type: 'image' },
          { id: '4', url: '/img4.jpg', type: 'image' },
        ],
      }
      render(<DraftEditForm draft={draftWith4Media} genres={mockGenres} />)

      expect(screen.getByRole('button', { name: /画像を追加/ })).toBeDisabled()
    })

    it('プレースホルダが「いまどうしてる？」になっている', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
    })

    it('ジャンルラベルが表示される', () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      expect(screen.getByText('ジャンル')).toBeInTheDocument()
    })

    it('contentが空文字の場合、saveDraftにundefinedが渡される', async () => {
      const emptyDraft = { ...mockDraft, content: '' }
      render(<DraftEditForm draft={emptyDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith(
          expect.objectContaining({ content: undefined })
        )
      })
    })

    it('メディアURLが保存時に送信される', async () => {
      const draftWithMedia = {
        ...mockDraft,
        media: [
          { id: 'media-1', url: '/image1.jpg', type: 'image' },
          { id: 'media-2', url: '/image2.jpg', type: 'image' },
        ],
      }
      render(<DraftEditForm draft={draftWithMedia} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /下書き保存/ }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith(
          expect.objectContaining({ mediaUrls: ['/image1.jpg', '/image2.jpg'] })
        )
      })
    })

    it('投稿時にまず保存してから投稿に変換する', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalled()
        expect(mockPublishDraft).toHaveBeenCalledWith('draft-1')
        // saveDraft should be called before publishDraft
        const saveCallOrder = mockSaveDraft.mock.invocationCallOrder[0]
        const publishCallOrder = mockPublishDraft.mock.invocationCallOrder[0]
        expect(saveCallOrder).toBeLessThan(publishCallOrder)
      })
    })

    it('投稿成功時にリフレッシュされる', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /投稿する/ }))

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('削除成功時にリフレッシュされる', async () => {
      render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)

      fireEvent.click(screen.getByRole('button', { name: /削除/ }))

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('ファイル入力がhiddenで存在する', () => {
      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).toBeInTheDocument()
      expect(fileInput).toHaveClass('hidden')
    })

    it('ファイル入力がimage/video形式を受け付ける', () => {
      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).toHaveAttribute('accept', expect.stringContaining('image/jpeg'))
    })

    it('genresが空配列の場合は空の選択状態', () => {
      const draftNoGenres = { ...mockDraft, genres: [] }
      render(<DraftEditForm draft={draftNoGenres} genres={mockGenres} />)
      expect(screen.getByTestId('selected-genres')).toHaveTextContent('')
    })

    it('メディアが1つの場合はgrid-cols-2が適用されない', () => {
      const draftWithOneMedia = {
        ...mockDraft,
        media: [{ id: 'media-1', url: '/image.jpg', type: 'image' }],
      }
      const { container } = render(<DraftEditForm draft={draftWithOneMedia} genres={mockGenres} />)
      const grid = container.querySelector('.grid.gap-2')
      expect(grid).not.toHaveClass('grid-cols-2')
    })

    it('メディアが2つの場合はgrid-cols-2が適用される', () => {
      const draftWithTwoMedia = {
        ...mockDraft,
        media: [
          { id: 'media-1', url: '/image1.jpg', type: 'image' },
          { id: 'media-2', url: '/image2.jpg', type: 'image' },
        ],
      }
      const { container } = render(<DraftEditForm draft={draftWithTwoMedia} genres={mockGenres} />)
      const grid = container.querySelector('.grid.gap-2.grid-cols-2')
      expect(grid).toBeInTheDocument()
    })
  })

  describe('ファイルアップロード', () => {
    it('画像ファイルを選択するとアップロードが実行される', async () => {
      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['image data'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(mockPrepareFileForUpload).toHaveBeenCalled()
      })
    })

    it('動画ファイルを選択するとR2アップロードが実行される', async () => {
      mockIsVideoFile.mockReturnValue(true)
      mockUploadVideoToR2.mockResolvedValue({ url: '/video.mp4' })

      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['video'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(mockUploadVideoToR2).toHaveBeenCalled()
      })
    })

    it('動画アップロードエラー時にエラー表示する', async () => {
      mockIsVideoFile.mockReturnValue(true)
      mockUploadVideoToR2.mockResolvedValue({ error: '動画アップロード失敗' })

      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('動画アップロード失敗')).toBeInTheDocument()
      })
    })

    it('動画サイズ超過時にエラーを表示する', async () => {
      mockIsVideoFile.mockReturnValue(true)

      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const largeFile = new File(['x'], 'large.mp4', { type: 'video/mp4' })
      Object.defineProperty(largeFile, 'size', { configurable: true, value: 300 * 1024 * 1024 })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeFile] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/動画は256MB以下にしてください/)).toBeInTheDocument()
      })
    })

    it('画像サイズ超過時にエラーを表示する', async () => {
      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const largeFile = new File(['x'], 'large.jpg', { type: 'image/jpeg' })
      Object.defineProperty(largeFile, 'size', { configurable: true, value: 15 * 1024 * 1024 })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeFile] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/画像は10MB以下にしてください/)).toBeInTheDocument()
      })
    })

    it('4枚以上のメディアがある場合にエラーを表示する', async () => {
      const draftWith4 = {
        ...mockDraft,
        media: [
          { id: '1', url: '/1.jpg', type: 'image' },
          { id: '2', url: '/2.jpg', type: 'image' },
          { id: '3', url: '/3.jpg', type: 'image' },
          { id: '4', url: '/4.jpg', type: 'image' },
        ],
      }
      const { container } = render(<DraftEditForm draft={draftWith4} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('画像は4枚まで添付できます')).toBeInTheDocument()
      })
    })

    it('アップロード例外時にエラーを表示する', async () => {
      mockPrepareFileForUpload.mockRejectedValue(new Error('圧縮失敗'))

      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })
    })

    it('空のファイル選択では何も起きない', () => {
      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      Object.defineProperty(fileInput, 'files', { configurable: true, value: [] })
      fireEvent.change(fileInput)

      expect(mockPrepareFileForUpload).not.toHaveBeenCalled()
    })

    it('画像アップロード成功後にメディアプレビューが表示される', async () => {
      const { container } = render(<DraftEditForm draft={mockDraft} genres={mockGenres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
      })
    })
  })
})
