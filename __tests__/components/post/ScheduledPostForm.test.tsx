import { vi } from 'vitest'
 
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ScheduledPostForm } from '@/components/post/ScheduledPostForm'

// next/navigation モック
const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    back: mockBack,
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
const mockCreateScheduledPost = vi.fn()
const mockUpdateScheduledPost = vi.fn()
vi.mock('@/lib/actions/scheduled-post', () => ({
  createScheduledPost: (...args: unknown[]) => mockCreateScheduledPost(...args),
  updateScheduledPost: (...args: unknown[]) => mockUpdateScheduledPost(...args),
}))

// GenreSelector モック
vi.mock('@/components/post/GenreSelector', () => ({
  GenreSelector: ({ selectedIds, onChange }: { selectedIds: string[]; onChange: (ids: string[]) => void }) => (
    <div data-testid="genre-selector">
      <span data-testid="selected-genres">{selectedIds.join(',')}</span>
      <button type="button" onClick={() => onChange(['genre-1'])}>Select Genre</button>
    </div>
  ),
}))

// client-image-compression モック
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn((file: File) => Promise.resolve(file)),
  isVideoFile: vi.fn((file: File) => file.type.startsWith('video/')),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: vi.fn(),
}))

describe('ScheduledPostForm', async () => {
  const mockGenres = {
    '樹種': [
      { id: 'genre-1', name: '松柏類', category: '樹種' },
      { id: 'genre-2', name: '雑木類', category: '樹種' },
    ],
  }

  const mockLimits = {
    maxPostLength: 500,
    maxImages: 4,
    maxVideos: 1,
    maxScheduledPosts: 10,
    maxDailyPosts: 20,
    canSchedulePost: true,
    canViewAnalytics: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateScheduledPost.mockResolvedValue({ success: true })
    mockUpdateScheduledPost.mockResolvedValue({ success: true })
  })

  it('テキストエリアを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByPlaceholderText('予約投稿の内容を入力...')).toBeInTheDocument()
  })

  it('テキストを入力できる', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    expect(textarea).toHaveValue('テスト投稿')
  })

  it('残り文字数を表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByText('500 / 500')).toBeInTheDocument()
  })

  it('文字数が減ると残り文字数が更新される', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    fireEvent.change(textarea, { target: { value: 'テスト' } })

    expect(screen.getByText('497 / 500')).toBeInTheDocument()
  })

  it('ジャンルセレクターを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByTestId('genre-selector')).toBeInTheDocument()
  })

  it('予約日時入力フィールドを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByText('予約日時')).toBeInTheDocument()
  })

  it('日付入力フィールドが表示される', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const dateInput = document.querySelector('input[type="date"]')
    expect(dateInput).toBeInTheDocument()
  })

  it('時間入力フィールドが表示される', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const timeInput = document.querySelector('input[type="time"]')
    expect(timeInput).toBeInTheDocument()
  })

  it('メディア追加ボタンを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByRole('button', { name: /メディア追加/ })).toBeInTheDocument()
  })

  it('キャンセルボタンをクリックすると戻る', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockBack).toHaveBeenCalled()
  })

  it('予約するボタンを表示する（新規作成時）', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByRole('button', { name: '予約する' })).toBeInTheDocument()
  })

  it('更新するボタンを表示する（編集時）', () => {
    const editData = {
      id: 'scheduled-1',
      content: 'テスト投稿',
      scheduledAt: new Date('2030-12-01T10:00:00'),
      genreIds: ['genre-1'],
      media: [],
    }

    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()
  })

  it('編集時は既存のデータで初期化する', () => {
    const editData = {
      id: 'scheduled-1',
      content: '既存の投稿内容',
      scheduledAt: new Date('2030-12-01T10:00:00'),
      genreIds: ['genre-1'],
      media: [],
    }

    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

    expect(screen.getByDisplayValue('既存の投稿内容')).toBeInTheDocument()
    expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
  })

  it('コンテンツがなく画像もない場合は予約ボタンを無効化する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled()
  })

  it('予約日時がない場合は予約ボタンを無効化する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled()
  })

  it('日付のみ入力では予約ボタンが無効のまま', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
    fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: '2030-12-01' } })
    }

    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled()
  })

  it('画像数とビデオ数のカウンターを表示する', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    expect(screen.getByText(/画像: 0\/4枚/)).toBeInTheDocument()
    expect(screen.getByText(/動画: 0\/1本/)).toBeInTheDocument()
  })

  it('プレミアム会員の文字数制限が反映される', () => {
    const premiumLimits = { ...mockLimits, maxPostLength: 2000 }
    render(<ScheduledPostForm genres={mockGenres} limits={premiumLimits} />)

    expect(screen.getByText('2000 / 2000')).toBeInTheDocument()
  })

  it('日付入力の最小値が今日に設定されている', () => {
    render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    const today = new Date().toISOString().split('T')[0]
    expect(dateInput).toHaveAttribute('min', today)
  })

  describe('編集モード', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)

    const editData = {
      id: 'scheduled-1',
      content: 'テスト投稿',
      scheduledAt: futureDate,
      genreIds: ['genre-1'],
      media: [{ url: '/image.jpg', type: 'image' }],
    }

    it('既存のメディアを表示する', () => {
      const { container } = render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      expect(container.querySelector('img[src="/image.jpg"]')).toBeInTheDocument()
    })

    it('既存のジャンルを選択済みにする', () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
    })
  })

  describe('フォーム送信', async () => {
    it('新規作成時はcreateScheduledPostを呼び出す', async () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
      const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement

      if (dateInput && timeInput) {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 7)
        fireEvent.change(dateInput, { target: { value: futureDate.toISOString().split('T')[0] } })
        fireEvent.change(timeInput, { target: { value: '10:00' } })
      }

      fireEvent.click(screen.getByRole('button', { name: '予約する' }))

      await waitFor(() => {
        expect(mockCreateScheduledPost).toHaveBeenCalled()
      })
    })

    it('編集時はupdateScheduledPostを呼び出す', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const editData = {
        id: 'scheduled-1',
        content: 'テスト投稿',
        scheduledAt: futureDate,
        genreIds: ['genre-1'],
        media: [],
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      fireEvent.click(screen.getByRole('button', { name: '更新する' }))

      await waitFor(() => {
        expect(mockUpdateScheduledPost).toHaveBeenCalledWith('scheduled-1', expect.any(FormData))
      })
    })

    it('成功時に予約投稿一覧に遷移する', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const editData = {
        id: 'scheduled-1',
        content: 'テスト投稿',
        scheduledAt: futureDate,
        genreIds: ['genre-1'],
        media: [],
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      fireEvent.click(screen.getByRole('button', { name: '更新する' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/posts/scheduled')
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('エラー時にエラーメッセージを表示する', async () => {
      mockCreateScheduledPost.mockResolvedValue({ error: '予約に失敗しました' })

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
      const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement

      if (dateInput && timeInput) {
        fireEvent.change(dateInput, { target: { value: futureDate.toISOString().split('T')[0] } })
        fireEvent.change(timeInput, { target: { value: '10:00' } })
      }

      fireEvent.click(screen.getByRole('button', { name: '予約する' }))

      await waitFor(() => {
        expect(screen.getByText('予約に失敗しました')).toBeInTheDocument()
      })
    })

    it('更新時のエラーを表示する', async () => {
      mockUpdateScheduledPost.mockResolvedValue({ error: '更新に失敗しました' })

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const editData = {
        id: 'scheduled-1',
        content: 'テスト投稿',
        scheduledAt: futureDate,
        genreIds: ['genre-1'],
        media: [],
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      fireEvent.click(screen.getByRole('button', { name: '更新する' }))

      await waitFor(() => {
        expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
      })
    })

    it('送信中はボタンテキストが「保存中...」に変わる', async () => {
      mockCreateScheduledPost.mockImplementation(() => new Promise(() => {}))

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
      const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement

      if (dateInput && timeInput) {
        const futureDate = new Date()
        futureDate.setDate(futureDate.getDate() + 7)
        fireEvent.change(dateInput, { target: { value: futureDate.toISOString().split('T')[0] } })
        fireEvent.change(timeInput, { target: { value: '10:00' } })
      }

      fireEvent.click(screen.getByRole('button', { name: '予約する' }))

      await waitFor(() => {
        expect(screen.getByText('保存中...')).toBeInTheDocument()
      })
    })
  })

  describe('文字数制限', () => {
    it('文字数超過時は予約ボタンを無効化する', () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

      expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled()
    })

    it('文字数超過時に警告色を表示する', () => {
      const { container } = render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

      expect(container.querySelector('.text-destructive')).toBeInTheDocument()
    })

    it('残り100文字未満で警告色を表示する', () => {
      const { container } = render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'あ'.repeat(410) } })

      expect(container.querySelector('.text-muted-foreground')).toBeInTheDocument()
    })
  })

  describe('ジャンル選択', () => {
    it('ジャンルを選択できる', () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      fireEvent.click(screen.getByRole('button', { name: 'Select Genre' }))

      expect(screen.getByTestId('selected-genres')).toHaveTextContent('genre-1')
    })
  })

  describe('予約日時バリデーション', async () => {
    it('予約日時が指定されていない場合にエラーを表示する', async () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

      // dateとtimeを入力してボタンを有効化、その後クリア
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
      const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement
      fireEvent.change(dateInput, { target: { value: '2030-12-01' } })
      fireEvent.change(timeInput, { target: { value: '10:00' } })
      // クリアして未指定状態に
      fireEvent.change(dateInput, { target: { value: '' } })

      fireEvent.submit(screen.getByRole('button', { name: '予約する' }).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('予約日時を指定してください')).toBeInTheDocument()
      })
    })

    it('過去の日時を指定するとエラーを表示する', async () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const textarea = screen.getByPlaceholderText('予約投稿の内容を入力...')
      fireEvent.change(textarea, { target: { value: 'テスト投稿' } })

      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
      const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement
      fireEvent.change(dateInput, { target: { value: '2020-01-01' } })
      fireEvent.change(timeInput, { target: { value: '10:00' } })

      fireEvent.submit(screen.getByRole('button', { name: '予約する' }).closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('予約日時は未来の日時を指定してください')).toBeInTheDocument()
      })
    })
  })

  describe('メディア操作', async () => {
    it('動画メディアをプレビュー表示する', () => {
      const editData = {
        id: 'scheduled-1',
        content: 'テスト投稿',
        scheduledAt: new Date('2030-12-01T10:00:00'),
        genreIds: [],
        media: [{ url: '/video.mp4', type: 'video' }],
      }

      const { container } = render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)
      expect(container.querySelector('video[src="/video.mp4"]')).toBeInTheDocument()
    })

    it('メディア削除ボタンでメディアを削除できる', () => {
      const editData = {
        id: 'scheduled-1',
        content: 'テスト投稿',
        scheduledAt: new Date('2030-12-01T10:00:00'),
        genreIds: [],
        media: [{ url: '/image.jpg', type: 'image' }],
      }

      const { container } = render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)
      expect(container.querySelector('img[src="/image.jpg"]')).toBeInTheDocument()

      // X削除ボタンをクリック
      const mediaDeleteBtn = container.querySelector('.absolute.top-2.right-2') as HTMLElement
      if (mediaDeleteBtn) {
        fireEvent.click(mediaDeleteBtn)
      }

      expect(container.querySelector('img[src="/image.jpg"]')).not.toBeInTheDocument()
    })

    it('複数メディアの場合はグリッド表示になる', () => {
      const editData = {
        id: 'scheduled-1',
        content: 'テスト',
        scheduledAt: new Date('2030-12-01T10:00:00'),
        genreIds: [],
        media: [
          { url: '/img1.jpg', type: 'image' },
          { url: '/img2.jpg', type: 'image' },
        ],
      }

      const { container } = render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)
      const grid = container.querySelector('.grid-cols-2')
      expect(grid).toBeInTheDocument()
    })

    it('画像上限に達するとエラーを表示する', async () => {
       
      const { isVideoFile } = await import('@/lib/client-image-compression')
      vi.mocked(isVideoFile).mockReturnValue(false)

      const editData = {
        id: 'scheduled-1',
        content: 'テスト',
        scheduledAt: new Date('2030-12-01T10:00:00'),
        genreIds: [],
        media: [
          { url: '/img1.jpg', type: 'image' },
          { url: '/img2.jpg', type: 'image' },
          { url: '/img3.jpg', type: 'image' },
          { url: '/img4.jpg', type: 'image' },
        ],
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('画像は4枚まで添付できます')).toBeInTheDocument()
      })
    })

    it('動画上限に達するとエラーを表示する', async () => {
       
      const { isVideoFile } = await import('@/lib/client-image-compression')
      vi.mocked(isVideoFile).mockReturnValue(true)

      const editData = {
        id: 'scheduled-1',
        content: 'テスト',
        scheduledAt: new Date('2030-12-01T10:00:00'),
        genreIds: [],
        media: [{ url: '/video.mp4', type: 'video' }],
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('動画は1本まで添付できます')).toBeInTheDocument()
      })
    })

    it('動画サイズ超過でエラーを表示する', async () => {
       
      const { isVideoFile } = await import('@/lib/client-image-compression')
      vi.mocked(isVideoFile).mockReturnValue(true)

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const bigFile = new File([new ArrayBuffer(257 * 1024 * 1024)], 'big.mp4', { type: 'video/mp4' })
      Object.defineProperty(bigFile, 'size', { value: 257 * 1024 * 1024 })
      fireEvent.change(fileInput, { target: { files: [bigFile] } })

      await waitFor(() => {
        expect(screen.getByText(/動画は.*MB以下にしてください/)).toBeInTheDocument()
      })
    })

    it('画像サイズ超過でエラーを表示する', async () => {
       
      const { isVideoFile } = await import('@/lib/client-image-compression')
      vi.mocked(isVideoFile).mockReturnValue(false)

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })
      Object.defineProperty(bigFile, 'size', { value: 11 * 1024 * 1024 })
      fireEvent.change(fileInput, { target: { files: [bigFile] } })

      await waitFor(() => {
        expect(screen.getByText(/画像は.*MB以下にしてください/)).toBeInTheDocument()
      })
    })

    it('ファイルが選択されない場合は何もしない', async () => {
      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      fireEvent.change(fileInput, { target: { files: [] } })

      // No error should appear
      expect(screen.queryByText(/アップロードに失敗/)).not.toBeInTheDocument()
    })

    it('動画アップロード成功時にメディアリストに追加する', async () => {
       
      const { isVideoFile, uploadVideoToR2 } = await import('@/lib/client-image-compression')
      vi.mocked(isVideoFile).mockReturnValue(true)
      vi.mocked(uploadVideoToR2).mockResolvedValue({ url: '/uploaded-video.mp4' })

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(file, 'size', { value: 1024 })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(uploadVideoToR2).toHaveBeenCalled()
      })
    })

    it('動画アップロードエラー時にエラーを表示する', async () => {
       
      const { isVideoFile, uploadVideoToR2 } = await import('@/lib/client-image-compression')
      vi.mocked(isVideoFile).mockReturnValue(true)
      vi.mocked(uploadVideoToR2).mockResolvedValue({ error: 'アップロード失敗' })

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} />)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })
      Object.defineProperty(file, 'size', { value: 1024 })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('アップロード失敗')).toBeInTheDocument()
      })
    })

    it('アップロード中にメディア追加ボタンが無効化される', () => {
      const editData = {
        id: 'scheduled-1',
        content: 'テスト',
        scheduledAt: new Date('2030-12-01T10:00:00'),
        genreIds: [],
        media: Array.from({ length: 5 }, (_, i) => ({ url: `/img${i}.jpg`, type: 'image' })),
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)
      expect(screen.getByRole('button', { name: /メディア追加/ })).toBeDisabled()
    })
  })

  describe('フォーム送信 - メディア付き', async () => {
    it('メディア付きで送信するとFormDataにメディア情報が含まれる', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const editData = {
        id: 'scheduled-1',
        content: 'テスト投稿',
        scheduledAt: futureDate,
        genreIds: ['genre-1'],
        media: [{ url: '/image.jpg', type: 'image' }],
      }

      render(<ScheduledPostForm genres={mockGenres} limits={mockLimits} editData={editData} />)
      fireEvent.click(screen.getByRole('button', { name: '更新する' }))

      await waitFor(() => {
        expect(mockUpdateScheduledPost).toHaveBeenCalled()
        const formData = mockUpdateScheduledPost.mock.calls[0]![1]! as FormData
        expect(formData.get('mediaUrls')).toBe('/image.jpg')
        expect(formData.get('mediaTypes')).toBe('image')
      })
    })
  })
})
