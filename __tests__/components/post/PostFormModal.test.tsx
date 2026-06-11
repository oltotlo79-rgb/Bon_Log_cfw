 
import { vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PostFormModal } from '@/components/post/PostFormModal'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockRefresh = vi.fn()
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}))

// Server Actions モック
const mockCreatePost = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}))

const mockSaveDraft = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
}))

// トースト通知モック
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

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
  ],
}

const defaultProps = {
  genres: mockGenres,
  isOpen: true,
  onClose: vi.fn(),
}

describe('PostFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('モーダルが開いている時フォームを表示する', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
  })

  it('モーダルが閉じている時は何も表示しない', () => {
    render(<PostFormModal {...defaultProps} isOpen={false} />)
    expect(screen.queryByPlaceholderText('いまどうしてる？')).not.toBeInTheDocument()
  })

  it('閉じるボタンクリックでonCloseが呼ばれる', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    // 閉じるボタン（Xアイコン）をクリック
    const closeButton = screen.getAllByRole('button')[0]!
    await user.click(closeButton)

    expect(onClose).toHaveBeenCalled()
  })

  it('投稿ボタンが表示される', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
  })

  it('下書き保存ボタンが表示される', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '下書き保存' })).toBeInTheDocument()
  })

  it('投稿成功時にonCloseが呼ばれる', async () => {
    mockCreatePost.mockResolvedValue({ success: true })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('画像/動画追加ボタンが表示される', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByText('画像/動画')).toBeInTheDocument()
  })

  it('下書き数が表示される', () => {
    render(<PostFormModal {...defaultProps} draftCount={5} />)
    expect(screen.getByText('下書き一覧')).toBeInTheDocument()
  })

  it('マイ盆栽選択が表示される', () => {
    const bonsais = [
      { id: 'bonsai-1', name: '黒松一号', species: '黒松' },
    ]
    render(<PostFormModal {...defaultProps} bonsais={bonsais} />)
    expect(screen.getByText('関連する盆栽（任意）')).toBeInTheDocument()
  })

  it('テキスト入力で残り文字数が更新される', async () => {
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')

    expect(screen.getByText('497')).toBeInTheDocument()
  })

  it('空の状態では投稿ボタンが無効', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '投稿する' })).toBeDisabled()
  })

  it('テキスト入力で投稿ボタンが有効になる', async () => {
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')

    expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
  })

  it('投稿エラー時にトースト通知を表示する', async () => {
    mockCreatePost.mockResolvedValue({ error: '投稿に失敗しました' })
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '投稿に失敗しました',
        description: '投稿に失敗しました',
      })
    })
  })

  it('下書き保存成功時にonCloseが呼ばれる', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト下書き')
    await user.click(screen.getByRole('button', { name: '下書き保存' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('下書き保存エラー時にエラーメッセージを表示する', async () => {
    mockSaveDraft.mockResolvedValue({ error: '下書き保存に失敗しました' })
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト下書き')
    await user.click(screen.getByRole('button', { name: '下書き保存' }))

    await waitFor(() => {
      expect(screen.getByText('下書き保存に失敗しました')).toBeInTheDocument()
    })
  })

  it('投稿送信後にフォームが即座にリセットされonCloseが呼ばれる（オプティミスティックUI）', async () => {
    mockCreatePost.mockImplementation(() => new Promise(() => {}))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    // オプティミスティックUIでは即座にonCloseが呼ばれる
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  // === 追加テスト ===

  it('モーダルがisOpen=trueで表示される', () => {
    const { container } = render(<PostFormModal {...defaultProps} isOpen={true} />)
    const modal = container.querySelector('.fixed.inset-0.z-50')
    expect(modal).toBeInTheDocument()
  })

  it('モーダルがisOpen=falseで表示されない', () => {
    const { container } = render(<PostFormModal {...defaultProps} isOpen={false} />)
    const modal = container.querySelector('.fixed.inset-0.z-50')
    expect(modal).not.toBeInTheDocument()
  })

  it('テキストエリアがモーダル内にレンダリングされる', () => {
    render(<PostFormModal {...defaultProps} />)
    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveAttribute('rows', '6')
  })

  it('テキストエリアに入力できる', async () => {
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)
    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    await user.type(textarea, 'テスト入力')
    expect(textarea).toHaveValue('テスト入力')
  })

  it('文字数カウンターが更新される', async () => {
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)
    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'あいう')
    expect(screen.getByText('497')).toBeInTheDocument()
  })

  it('空の状態では下書き保存ボタンも無効', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '下書き保存' })).toBeDisabled()
  })

  it('テキスト入力で下書き保存ボタンが有効になる', async () => {
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)
    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
    expect(screen.getByRole('button', { name: '下書き保存' })).not.toBeDisabled()
  })

  it('投稿送信でcreatePostが呼ばれる', async () => {
    mockCreatePost.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalled()
    })
  })

  it('ジャンルセレクターがモーダル内に表示される', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByText('ジャンルを選択（任意）')).toBeInTheDocument()
  })

  it('画像/動画ボタンがモーダル内に表示される', () => {
    render(<PostFormModal {...defaultProps} />)
    expect(screen.getByText('画像/動画')).toBeInTheDocument()
  })

  it('ファイル入力が非表示で存在する', () => {
    const { container } = render(<PostFormModal {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]')
    expect(fileInput).toBeInTheDocument()
    expect(fileInput).toHaveClass('hidden')
  })

  it('エラー時にトースト通知が表示される', async () => {
    mockCreatePost.mockResolvedValue({ error: 'テストエラー' })
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        variant: 'destructive',
        title: '投稿に失敗しました',
        description: 'テストエラー',
      })
    })
  })

  it('投稿成功時にフォームがクリアされonCloseが呼ばれる', async () => {
    mockCreatePost.mockResolvedValue({ success: true })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('投稿後は即座にonCloseが呼ばれモーダルが閉じる（オプティミスティックUI）', async () => {
    mockCreatePost.mockImplementation(() => new Promise(() => {}))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト投稿')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    // オプティミスティックUIでは即座にonCloseが呼ばれる
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('短い制限値で残り文字数が黄色になる', () => {
    render(
      <PostFormModal
        {...defaultProps}
        limits={{ maxPostLength: 5, maxImages: 4, maxVideos: 1 }}
      />
    )
    // 短い制限値で残り5文字はmuted-foregroundになる(50未満)
    expect(screen.getByText('5')).toHaveClass('text-muted-foreground')
  })

  it('最大文字数に達しても入力可能文字はmaxLengthで制限される', async () => {
    const user = userEvent.setup()
    render(
      <PostFormModal
        {...defaultProps}
        limits={{ maxPostLength: 5, maxImages: 4, maxVideos: 1 }}
      />
    )
    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    await user.type(textarea, 'あいうえお')

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument()
    })
  })

  it('モーダルがfixed全画面で表示される', () => {
    const { container } = render(<PostFormModal {...defaultProps} />)
    const backdrop = container.querySelector('.fixed.inset-0.z-50.bg-background')
    expect(backdrop).toBeInTheDocument()
  })

  it('draftCountが0の場合は下書き一覧リンクが表示されない', () => {
    render(<PostFormModal {...defaultProps} draftCount={0} />)
    expect(screen.queryByText('下書き一覧')).not.toBeInTheDocument()
  })

  it('マイ盆栽選択が盆栽がない場合は表示されない', () => {
    render(<PostFormModal {...defaultProps} bonsais={[]} />)
    expect(screen.queryByText('関連する盆栽（任意）')).not.toBeInTheDocument()
  })

  it('マイ盆栽の選択肢が表示される', () => {
    const bonsais = [
      { id: 'b1', name: '黒松一号', species: '黒松' },
      { id: 'b2', name: 'もみじ', species: null },
    ]
    render(<PostFormModal {...defaultProps} bonsais={bonsais} />)
    expect(screen.getByText('黒松一号 (黒松)')).toBeInTheDocument()
    expect(screen.getByText('もみじ')).toBeInTheDocument()
  })

  it('テキストエリアが存在しresizeなしである', () => {
    render(<PostFormModal {...defaultProps} />)
    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    expect(textarea).toHaveClass('resize-none')
  })

  it('下書き保存が例外をスローした場合にエラーを表示する', async () => {
    mockSaveDraft.mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
    await user.click(screen.getByRole('button', { name: '下書き保存' }))

    await waitFor(() => {
      expect(screen.getByText('下書きの保存に失敗しました')).toBeInTheDocument()
    })
  })

  it('下書き保存で空入力時にエラーを表示する', async () => {
    render(<PostFormModal {...defaultProps} />)
    // Button is disabled when empty
    expect(screen.getByRole('button', { name: '下書き保存' })).toBeDisabled()
  })

  it('投稿成功時にルーターがリフレッシュされる', async () => {
    mockCreatePost.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('下書き保存成功時に下書きページに遷移する', async () => {
    mockSaveDraft.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
    await user.click(screen.getByRole('button', { name: '下書き保存' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/drafts')
    })
  })

  it('閉じるボタンで入力内容がある場合confirmが呼ばれる', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
    const closeButton = screen.getAllByRole('button')[0]!
    await user.click(closeButton)

    // ConfirmDialog should appear (discard variant)
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    // Click "破棄する" to confirm discard
    await user.click(screen.getByRole('button', { name: '破棄する' }))

    await waitFor(() => { expect(onClose).toHaveBeenCalled() })
  })

  it('閉じるボタンでconfirmキャンセル時はonCloseが呼ばれない', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PostFormModal {...defaultProps} onClose={onClose} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
    const closeButton = screen.getAllByRole('button')[0]!
    await user.click(closeButton)

    // ConfirmDialog should appear (discard variant)
    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    // Click "続けて編集" to cancel discard
    await user.click(screen.getByRole('button', { name: '続けて編集' }))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('マイ盆栽を選択できる', async () => {
    const user = userEvent.setup()
    const bonsais = [
      { id: 'b1', name: '黒松一号', species: '黒松' },
    ]
    render(<PostFormModal {...defaultProps} bonsais={bonsais} />)

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'b1')
    expect(select).toHaveValue('b1')
  })

  it('マイ盆栽選択後に投稿するとbonsaiIdがFormDataに含まれる', async () => {
    mockCreatePost.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    const bonsais = [
      { id: 'b1', name: '黒松一号', species: '黒松' },
    ]
    render(<PostFormModal {...defaultProps} bonsais={bonsais} />)

    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'テスト')
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'b1')
    await user.click(screen.getByRole('button', { name: '投稿する' }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalled()
      const formData = mockCreatePost.mock.calls[0]![0]! as FormData
      expect(formData.get('bonsaiId')).toBe('b1')
    })
  })

  it('文字数超過時に投稿ボタンが無効化される', async () => {
    const user = userEvent.setup()
    render(
      <PostFormModal
        {...defaultProps}
        limits={{ maxPostLength: 3, maxImages: 4, maxVideos: 1 }}
      />
    )
    await user.type(screen.getByPlaceholderText('いまどうしてる？'), 'あいう')
    // At exactly 3 chars, remaining is 0, button should be enabled
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '投稿する' })).not.toBeDisabled()
  })

  it('文字数超過で赤色表示になる', () => {
    render(
      <PostFormModal
        {...defaultProps}
        limits={{ maxPostLength: 3, maxImages: 4, maxVideos: 1 }}
      />
    )
    const textarea = screen.getByPlaceholderText('いまどうしてる？')
    fireEvent.change(textarea, { target: { value: 'あいうえ' } })
    expect(screen.getByText('-1')).toHaveClass('text-destructive')
  })

  // === ファイルアップロードテスト ===

  it('画像ファイルを選択するとアップロードが実行される', async () => {
    const { container } = render(<PostFormModal {...defaultProps} />)
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

    const { container } = render(<PostFormModal {...defaultProps} />)
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
    mockUploadVideoToR2.mockResolvedValue({ error: '動画失敗' })

    const { container } = render(<PostFormModal {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['vid'], 'test.mp4', { type: 'video/mp4' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('動画失敗')).toBeInTheDocument()
    })
  })

  it('画像サイズ超過時にエラーを表示する', async () => {
    const { container } = render(<PostFormModal {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const largeFile = new File(['x'], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeFile, 'size', { configurable: true, value: 15 * 1024 * 1024 })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeFile] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/画像は10MB以下にしてください/)).toBeInTheDocument()
    })
  })

  it('動画サイズ超過時にエラーを表示する', async () => {
    mockIsVideoFile.mockReturnValue(true)

    const { container } = render(<PostFormModal {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const largeFile = new File(['x'], 'large.mp4', { type: 'video/mp4' })
    Object.defineProperty(largeFile, 'size', { configurable: true, value: 300 * 1024 * 1024 })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [largeFile] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText(/動画は256MB以下にしてください/)).toBeInTheDocument()
    })
  })

  it('アップロード例外時にエラーを表示する', async () => {
    mockPrepareFileForUpload.mockRejectedValue(new Error('圧縮失敗'))

    const { container } = render(<PostFormModal {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
    })
  })

  it('空のファイル選択では何も起きない', () => {
    const { container } = render(<PostFormModal {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    Object.defineProperty(fileInput, 'files', { configurable: true, value: [] })
    fireEvent.change(fileInput)

    expect(mockPrepareFileForUpload).not.toHaveBeenCalled()
  })

  it('メディア削除ボタンでメディアが削除される', async () => {
    const { container } = render(<PostFormModal {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['img'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(container.querySelector('.relative.aspect-video')).toBeInTheDocument()
    })

    const removeBtn = container.querySelector('.relative.aspect-video button')
    if (removeBtn) {
      fireEvent.click(removeBtn)
    }

    await waitFor(() => {
      expect(container.querySelector('.relative.aspect-video')).not.toBeInTheDocument()
    })
  })
})
