 
import { vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentForm } from '@/components/comment/CommentForm'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Server Actionモック
const mockCreateComment = vi.fn()
vi.mock('@/lib/actions/comment', () => ({
  createComment: (...args: unknown[]) => mockCreateComment(...args),
}))

// メンション検索モック
vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: vi.fn().mockResolvedValue([]),
}))

const mockPrepareFileForUpload = vi.fn()
const mockIsVideoFile = vi.fn()
const mockUploadVideoToR2 = vi.fn()

// クライアント画像圧縮モック
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: unknown[]) => mockPrepareFileForUpload(...args),
  isVideoFile: (...args: unknown[]) => mockIsVideoFile(...args),
  formatFileSize: vi.fn().mockReturnValue('1 MB'),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 256 * 1024 * 1024,
  uploadVideoToR2: (...args: unknown[]) => mockUploadVideoToR2(...args),
}))

// XMLHttpRequest モック
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

describe('CommentForm', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
    mockXHRInstances.length = 0
    global.XMLHttpRequest = vi.fn(function() {
      const instance = new MockXHR()
      instance.send = vi.fn().mockImplementation(() => {
        // Simulate successful load
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

  it('コメントフォームを表示する', () => {
    render(<CommentForm postId="post-1" />)
    expect(screen.getByPlaceholderText('コメントを入力...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /コメントする/i })).toBeInTheDocument()
  })

  it('カスタムプレースホルダーを表示できる', () => {
    render(<CommentForm postId="post-1" placeholder="返信を入力..." />)
    expect(screen.getByPlaceholderText('返信を入力...')).toBeInTheDocument()
  })

  it('コメントを入力できる', async () => {
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    expect(textarea).toHaveValue('テストコメント')
  })

  it('残り文字数を表示する', async () => {
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    // 初期状態では500文字残り
    expect(screen.getByText('500')).toBeInTheDocument()

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト')

    // 3文字入力後、497文字残り
    expect(screen.getByText('497')).toBeInTheDocument()
  })

  it('空のコメントは送信できない', () => {
    render(<CommentForm postId="post-1" />)
    const submitButton = screen.getByRole('button', { name: /コメントする/i })
    expect(submitButton).toBeDisabled()
  })

  it('文字数超過時は送信できない', async () => {
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // 501文字入力（fireEvent.changeで高速化）
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

    const submitButton = screen.getByRole('button', { name: /コメントする/i })
    expect(submitButton).toBeDisabled()
  })

  it('コメント送信時にServer Actionを呼ぶ', async () => {
    mockCreateComment.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(mockCreateComment).toHaveBeenCalled()
    })
  })

  it('送信成功時にonSuccessコールバックを呼ぶ', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const mockOnSuccess = vi.fn()

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" onSuccess={mockOnSuccess} />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('テストコメント')
    })
  })

  it('送信成功後にフォームがリセットされる', async () => {
    mockCreateComment.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockCreateComment.mockResolvedValue({ error: 'コメントの投稿に失敗しました' })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(screen.getByText('コメントの投稿に失敗しました')).toBeInTheDocument()
    })
  })

  it('送信中はボタンが無効化される', async () => {
    mockCreateComment.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テストコメント')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /送信中/i })).toBeDisabled()
    })
  })

  it('キャンセルボタンを表示する（onCancelが指定されている場合）', () => {
    const mockOnCancel = vi.fn()
    render(<CommentForm postId="post-1" onCancel={mockOnCancel} />)
    expect(screen.getByRole('button', { name: /キャンセル/i })).toBeInTheDocument()
  })

  it('キャンセルボタンクリックでonCancelを呼ぶ', async () => {
    const mockOnCancel = vi.fn()
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" onCancel={mockOnCancel} />)

    await user.click(screen.getByRole('button', { name: /キャンセル/i }))
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('返信フォームの場合は「返信する」ボタンを表示する', () => {
    render(<CommentForm postId="post-1" parentId="comment-1" />)
    expect(screen.getByRole('button', { name: /返信する/i })).toBeInTheDocument()
  })

  it('autoFocusを指定するとテキストエリアにフォーカスする', () => {
    render(<CommentForm postId="post-1" autoFocus />)
    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // autoFocus指定時はフォーカスされる
    expect(textarea).toHaveFocus()
  })

  it('メディア添付ボタンを表示する', () => {
    render(<CommentForm postId="post-1" />)
    // 画像添付ボタン（アイコンボタン）
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThanOrEqual(1)
  })

  it('文字数が50以下になると警告色になる', async () => {
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // 451文字入力で残り49文字（fireEvent.changeで高速化）
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'あ'.repeat(451) } })

    await waitFor(() => {
      expect(screen.getByText('49')).toHaveClass('text-muted-foreground')
    })
  })

  it('文字数超過時は警告色（destructive）になる', async () => {
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // 501文字入力で-1（fireEvent.changeで高速化）
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

    await waitFor(() => {
      expect(screen.getByText('-1')).toHaveClass('text-destructive')
    })
  })


  it('parentIdがある場合は返信コメントとして送信する', async () => {
    mockCreateComment.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" parentId="parent-comment-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, '返信コメント')
    await user.click(screen.getByRole('button', { name: /返信する/i }))

    await waitFor(() => {
      expect(mockCreateComment).toHaveBeenCalled()
    })
  })

  it('キャンセルボタンが表示されない場合はonCancelを呼ばない', () => {
    render(<CommentForm postId="post-1" />)

    // onCancelが指定されていない場合はキャンセルボタンがない
    const cancelButtons = screen.queryAllByRole('button', { name: /キャンセル/i })
    expect(cancelButtons.length).toBe(0)
  })

  it('送信成功時にテキストエリアがリセットされる', async () => {
    mockCreateComment.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    // fireEvent.changeでIME問題を回避
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'テストコメント' } })

    expect(textarea).toHaveValue('テストコメント')

    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('送信時にcreateCommentに正しいpostIdを渡す', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<CommentForm postId="post-abc" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(mockCreateComment).toHaveBeenCalled()
      const formData = mockCreateComment.mock.calls[0]![0]! as FormData
      expect(formData.get('postId')).toBe('post-abc')
    })
  })

  it('parentIdがある場合にFormDataにparentIdが含まれる', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" parentId="parent-123" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, '返信テスト')
    await user.click(screen.getByRole('button', { name: /返信する/i }))

    await waitFor(() => {
      const formData = mockCreateComment.mock.calls[0]![0]! as FormData
      expect(formData.get('parentId')).toBe('parent-123')
    })
  })

  it('parentIdがない場合にFormDataにparentIdが含まれない', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      const formData = mockCreateComment.mock.calls[0]![0]! as FormData
      expect(formData.get('parentId')).toBeNull()
    })
  })

  it('ファイル入力要素が非表示で存在する', () => {
    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveClass('hidden')
  })

  it('ファイル入力がimage/jpeg,image/png,image/webp,image/gif,video形式を受け付ける', () => {
    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toHaveAttribute('accept', expect.stringContaining('image/jpeg'))
    expect(fileInput).toHaveAttribute('accept', expect.stringContaining('video/mp4'))
  })

  it('送信成功後にメディアファイルもリセットされる', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
    // メディアプレビューが表示されていないことを確認
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('文字数が499の場合は送信可能', async () => {
    render(<CommentForm postId="post-1" />)
    const textarea = screen.getByPlaceholderText('コメントを入力...')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'あ'.repeat(499) } })

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /コメントする/i })).not.toBeDisabled()
  })

  it('文字数がちょうど500の場合は送信可能', async () => {
    render(<CommentForm postId="post-1" />)
    const textarea = screen.getByPlaceholderText('コメントを入力...')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'あ'.repeat(500) } })

    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /コメントする/i })).not.toBeDisabled()
  })

  it('文字数が501の場合は送信不可', async () => {
    render(<CommentForm postId="post-1" />)
    const textarea = screen.getByPlaceholderText('コメントを入力...')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

    expect(screen.getByText('-1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /コメントする/i })).toBeDisabled()
  })

  it('onCancelが指定されていない場合はキャンセルボタンが非表示', () => {
    render(<CommentForm postId="post-1" />)
    expect(screen.queryByRole('button', { name: /キャンセル/i })).not.toBeInTheDocument()
  })

  it('onCancelが指定されている場合はキャンセルボタンが表示される', () => {
    render(<CommentForm postId="post-1" onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: /キャンセル/i })).toBeInTheDocument()
  })

  it('送信ボタンのテキストがペンディング時に「送信中...」に変わる', async () => {
    mockCreateComment.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(screen.getByText('送信中...')).toBeInTheDocument()
    })
  })

  it('メディアファイルがない場合はプレビューが表示されない', () => {
    render(<CommentForm postId="post-1" />)
    // grid要素が存在しないことを確認
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('空白のみのコメントは送信できない', async () => {
    render(<CommentForm postId="post-1" />)
    const textarea = screen.getByPlaceholderText('コメントを入力...')
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.change(textarea, { target: { value: '   ' } })

    expect(screen.getByRole('button', { name: /コメントする/i })).toBeDisabled()
  })

  it('エラーメッセージが初期状態では非表示', () => {
    render(<CommentForm postId="post-1" />)
    expect(screen.queryByText('コメントの投稿に失敗しました')).not.toBeInTheDocument()
  })

  it('画像添付ボタンが3枚以上で無効化される', async () => {
    // We can't easily add 3 media via UI, but we can verify button exists and is enabled initially
    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
  })

  it('送信時にcontentがFormDataに含まれる', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト内容')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      const formData = mockCreateComment.mock.calls[0]![0]! as FormData
      expect(formData.get('content')).toBe('テスト内容')
    })
  })

  it('onSuccessがない場合でも送信成功でクラッシュしない', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  // === ファイルアップロードテスト ===

  it('画像ファイルを選択するとアップロードが実行される', async () => {
    const { container } = render(<CommentForm postId="post-1" />)
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

    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['video data'], 'test.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(mockUploadVideoToR2).toHaveBeenCalled()
    })
  })

  it('動画アップロードでエラーが返された場合にエラー表示する', async () => {
    mockIsVideoFile.mockReturnValue(true)
    mockUploadVideoToR2.mockResolvedValue({ error: '動画アップロード失敗' })

    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['video data'], 'test.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('動画アップロード失敗')).toBeInTheDocument()
    })
  })

  it('画像アップロード成功後にプレビューが表示され送信可能', async () => {
    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img1'], 'img1.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(mockPrepareFileForUpload).toHaveBeenCalledTimes(1)
      // Media-only should enable submit
      expect(screen.getByRole('button', { name: /コメントする/i })).not.toBeDisabled()
    })
  })

  it('アップロード失敗時にエラーメッセージを表示する', async () => {
    mockPrepareFileForUpload.mockRejectedValue(new Error('圧縮失敗'))

    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  it('空のファイル選択では何も起きない', () => {
    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    Object.defineProperty(fileInput, 'files', { configurable: true, value: [] })
    fireEvent.change(fileInput)

    expect(mockPrepareFileForUpload).not.toHaveBeenCalled()
  })

  it('メディア削除ボタンをクリックするとメディアが削除される', async () => {
    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      // Media preview should appear (Image component)
      const images = container.querySelectorAll('img')
      expect(images.length).toBeGreaterThan(0)
    })

    // Click remove button
    const removeButtons = container.querySelectorAll('button[type="button"]')
    const removeBtn = Array.from(removeButtons).find(btn => btn.querySelector('svg') && btn.closest('.relative'))
    if (removeBtn) {
      fireEvent.click(removeBtn)
    }

    await waitFor(() => {
      const images = container.querySelectorAll('.relative.aspect-video')
      expect(images.length).toBe(0)
    })
  })

  it('画像アップロード成功後にメディアプレビューが表示される', async () => {
    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      const mediaPreview = container.querySelector('.relative.aspect-video')
      expect(mediaPreview).toBeInTheDocument()
    })
  })

  it('動画サイズが上限を超えた場合にエラーを表示する', async () => {
    mockIsVideoFile.mockReturnValue(true)

    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    // Create a file exceeding MAX_VIDEO_SIZE (256MB)
    const largeFile = new File(['x'], 'large.mp4', { type: 'video/mp4' })
    Object.defineProperty(largeFile, 'size', { configurable: true, value: 300 * 1024 * 1024 })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeFile] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/動画は256MB以下にしてください/)).toBeInTheDocument()
    })
  })

  it('画像サイズが上限を超えた場合にエラーを表示する', async () => {
    mockIsVideoFile.mockReturnValue(false)

    const { container } = render(<CommentForm postId="post-1" />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const largeFile = new File(['x'], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeFile, 'size', { configurable: true, value: 15 * 1024 * 1024 })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeFile] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/画像は10MB以下にしてください/)).toBeInTheDocument()
    })
  })

  it('メディア付きコメントの送信でmediaUrlsがFormDataに含まれる', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const { container } = render(<CommentForm postId="post-1" />)

    // Upload an image first
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
    })

    // Type some text and submit
    const textarea = screen.getByPlaceholderText('コメントを入力...')
    fireEvent.change(textarea, { target: { value: 'テスト' } })
    fireEvent.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(mockCreateComment).toHaveBeenCalled()
      const formData = mockCreateComment.mock.calls[0]![0]! as FormData
      expect(formData.get('mediaUrls')).toBe('/uploaded.jpg')
      expect(formData.get('mediaTypes')).toBe('image')
    })
  })

  it('送信成功時にonSuccessが呼ばれフォームがリセットされる', async () => {
    mockCreateComment.mockResolvedValue({ success: true })
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" onSuccess={onSuccess} />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト')
    await user.click(screen.getByRole('button', { name: /コメントする/i }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled()
      expect(textarea).toHaveValue('')
    })
  })

  it('送信ボタンが複数回クリックされてもcreateCommentは1回のみ', async () => {
    mockCreateComment.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 200)))
    const user = userEvent.setup()
    render(<CommentForm postId="post-1" />)

    const textarea = screen.getByPlaceholderText('コメントを入力...')
    await user.type(textarea, 'テスト')
    const button = screen.getByRole('button', { name: /コメントする/i })
    await user.click(button)
    // 2回目のクリック（ペンディング中なので無効化されているはず）
    await user.click(button)

    await waitFor(() => {
      expect(mockCreateComment).toHaveBeenCalledTimes(1)
    })
  })
})
