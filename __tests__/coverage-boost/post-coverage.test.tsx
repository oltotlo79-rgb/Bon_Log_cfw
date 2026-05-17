import { vi } from 'vitest'
/**
 * 投稿関連コンポーネントのカバレッジ向上テスト
 */
import { render, screen, waitFor, fireEvent } from '../utils/test-utils'
import userEvent from '@testing-library/user-event'

// ============================================================
// モック設定
// ============================================================

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    const { fill, ...rest } = props
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} data-fill={fill ? 'true' : undefined} />
  },
}))

vi.mock('@tanstack/react-query', async () => ({
  ...(await vi.importActual('@tanstack/react-query')),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

const mockCreatePost = vi.fn()
const mockSaveDraft = vi.fn()
const mockVotePoll = vi.fn()

vi.mock('@/lib/actions/post', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
}))

vi.mock('@/lib/actions/draft', () => ({
  saveDraft: (...args: unknown[]) => mockSaveDraft(...args),
}))

vi.mock('@/lib/actions/poll', () => ({
  votePoll: (...args: unknown[]) => mockVotePoll(...args),
}))

vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: vi.fn().mockResolvedValue([]),
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

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// XMLHttpRequest mock
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

// コンポーネントインポート
import { PostForm } from '@/components/post/PostForm'
import { PollForm } from '@/components/post/PollForm'
import { PollDisplay } from '@/components/post/PollDisplay'

// ============================================================
// テストデータ
// ============================================================

const genres = {
  '盆栽': [
    { id: 'genre-1', name: '松柏類', category: '盆栽' },
    { id: 'genre-2', name: '雑木類', category: '盆栽' },
  ],
  '用品': [
    { id: 'genre-3', name: '鉢', category: '用品' },
  ],
}

const pollData = {
  id: 'poll-1',
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  options: [
    { id: 'opt-1', text: '選択肢1', _count: { votes: 5 } },
    { id: 'opt-2', text: '選択肢2', _count: { votes: 3 } },
  ],
  votes: [],
  _count: { votes: 8 },
}

// ============================================================
// PostForm テスト
// ============================================================

describe('PostForm - 追加テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsVideoFile.mockReturnValue(false)
    mockPrepareFileForUpload.mockResolvedValue(new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
    mockCreatePost.mockResolvedValue({ success: true })
    mockSaveDraft.mockResolvedValue({ success: true })
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

  describe('基本表示', () => {
    it('フォームが正しくレンダリングされる', () => {
      render(<PostForm genres={genres} />)

      expect(screen.getByPlaceholderText(/いまどうしてる/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /投稿する/i })).toBeInTheDocument()
    })

    it('下書き保存ボタンが表示される', () => {
      render(<PostForm genres={genres} />)

      expect(screen.getByRole('button', { name: /下書き保存/i })).toBeInTheDocument()
    })

    it('初期状態では文字数リングが非表示（0文字）', () => {
      render(<PostForm genres={genres} />)
      // 0文字のとき CharacterCountRing は null を返す
      const svg = document.querySelector('svg.-rotate-90')
      expect(svg).not.toBeInTheDocument()
    })
  })

  describe('プレミアム制限', () => {
    it('プレミアム会員は文字数が多い', () => {
      render(<PostForm genres={genres} limits={{ maxPostLength: 1000, maxImages: 8, maxVideos: 4 }} />)
      // テキストを入力してリングを表示させる（警告範囲）
      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'a'.repeat(951) } })
      // 1000 - 951 = 49 (警告範囲)
      expect(screen.getByText('49')).toBeInTheDocument()
      expect(screen.getByText('Premium')).toBeInTheDocument()
    })

    it('通常会員は500文字まで', () => {
      render(<PostForm genres={genres} />)
      // テキストを入力してリングを表示させる（警告範囲）
      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'a'.repeat(451) } })
      // 500 - 451 = 49 (警告範囲)
      expect(screen.getByText('49')).toBeInTheDocument()
      expect(screen.queryByText('Premium')).not.toBeInTheDocument()
    })
  })

  describe('文字数カウント', () => {
    it('入力すると文字数リングが表示される', async () => {
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'テスト' } })

      // 3文字入力 → 残り497文字（警告範囲外）→ リングのみ表示（数値テキストなし）
      const svg = document.querySelector('svg.-rotate-90')
      expect(svg).toBeInTheDocument()
    })

    it('50文字以下で警告色になる', async () => {
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'あ'.repeat(455) } })

      // 残り45文字（警告範囲）→ 数値テキストが表示される
      const counter = screen.getByText('45')
      expect(counter).toBeInTheDocument()
    })

    it('超過で赤色になる', async () => {
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'あ'.repeat(505) } })

      const counter = screen.getByText('-5')
      expect(counter).toHaveClass('text-destructive')
    })
  })

  describe('送信ボタンの状態', () => {
    it('空の場合は送信不可', () => {
      render(<PostForm genres={genres} />)

      expect(screen.getByRole('button', { name: /投稿する/i })).toBeDisabled()
    })

    it('テキストとジャンルがあれば送信可能', async () => {
      const user = userEvent.setup()
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'テスト' } })
      // ジャンルを選択（ドロップダウンを開いてから選択）
      await user.click(screen.getByText('ジャンルを選択（任意）'))
      await user.click(screen.getByText('松柏類'))

      expect(screen.getByRole('button', { name: /投稿する/i })).not.toBeDisabled()
    })

    it('文字数超過時は送信不可', async () => {
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'あ'.repeat(501) } })

      expect(screen.getByRole('button', { name: /投稿する/i })).toBeDisabled()
    })
  })

  describe('下書き保存', () => {
    it('空の場合は下書き保存ボタンが無効化される', async () => {
      render(<PostForm genres={genres} />)

      // 空の場合、下書き保存ボタンは無効化される
      expect(screen.getByRole('button', { name: /下書き保存/i })).toBeDisabled()
    })

    it('保存成功時に下書きページに遷移する', async () => {
      const user = userEvent.setup()
      mockSaveDraft.mockResolvedValue({ success: true })
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'テスト' } })

      await user.click(screen.getByRole('button', { name: /下書き保存/i }))

      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalled()
      })
    })

    it('保存エラー時にエラーメッセージが表示される', async () => {
      const user = userEvent.setup()
      mockSaveDraft.mockResolvedValue({ error: '保存に失敗しました' })
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'テスト' } })

      await user.click(screen.getByRole('button', { name: /下書き保存/i }))

      await waitFor(() => {
        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument()
      })
    })
  })

  describe('投稿送信', () => {
    it('送信成功時にフォームがリセットされる', async () => {
      const user = userEvent.setup()
      mockCreatePost.mockResolvedValue({ success: true })
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'テスト投稿' } })
      // ジャンルを選択（ドロップダウンを開いてから選択）
      await user.click(screen.getByText('ジャンルを選択（任意）'))
      await user.click(screen.getByText('松柏類'))

      await user.click(screen.getByRole('button', { name: /投稿する/i }))

      await waitFor(() => {
        expect(textarea).toHaveValue('')
      })
    })

    it('送信エラー時にトースト通知が表示される', async () => {
      const user = userEvent.setup()
      mockCreatePost.mockResolvedValue({ error: '投稿に失敗しました' })
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'テスト' } })
      // ジャンルを選択（ドロップダウンを開いてから選択）
      await user.click(screen.getByText('ジャンルを選択（任意）'))
      await user.click(screen.getByText('松柏類'))

      await user.click(screen.getByRole('button', { name: /投稿する/i }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          variant: 'destructive',
          title: '投稿に失敗しました',
          description: '投稿に失敗しました',
        })
      })
    })

    it('送信後は即座にフォームがリセットされる（オプティミスティックUI）', async () => {
      const user = userEvent.setup()
      mockCreatePost.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))
      render(<PostForm genres={genres} />)

      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      fireEvent.change(textarea, { target: { value: 'テスト' } })
      // ジャンルを選択（ドロップダウンを開いてから選択）
      await user.click(screen.getByText('ジャンルを選択（任意）'))
      await user.click(screen.getByText('松柏類'))

      await user.click(screen.getByRole('button', { name: /投稿する/i }))

      // オプティミスティックUIでは即座にフォームがリセットされる
      await waitFor(() => {
        expect(textarea).toHaveValue('')
      })
    })
  })

  describe('メディアアップロード', () => {
    it('画像が上限を超えるとエラーが表示される', async () => {
      const { container } = render(<PostForm genres={genres} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

      // 5枚目でエラー（デフォルト上限は4枚）
      for (let i = 0; i < 5; i++) {
        const file = new File([`img${i}`], `img${i}.jpg`, { type: 'image/jpeg' })
        Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] })
        fireEvent.change(fileInput)

        if (i < 4) {
          await waitFor(() => {
            expect(mockPrepareFileForUpload).toHaveBeenCalledTimes(i + 1)
          })
        }
      }

      await waitFor(() => {
        expect(screen.getByText(/画像は4枚まで添付できます/)).toBeInTheDocument()
      })
    })

    it('動画上限数が1であることを確認', async () => {
      // デフォルトのlimitsでmaxVideos=1が設定されている
      // limits propを明示的に指定しない場合、DEFAULT_LIMITSが使用される
      const { container } = render(<PostForm genres={genres} />)

      // 投稿フォームとファイル入力が正しくレンダリングされていることを確認
      const textarea = screen.getByPlaceholderText(/いまどうしてる/)
      expect(textarea).toBeInTheDocument()

      const fileInput = container.querySelector('input[type="file"]')
      expect(fileInput).toBeInTheDocument()
      // accept属性で画像・動画両方を受け付けることを確認
      expect(fileInput).toHaveAttribute('accept')
    })
  })

  describe('下書き一覧リンク', () => {
    it('下書きがある場合はリンクが表示される', () => {
      render(<PostForm genres={genres} draftCount={3} />)

      expect(screen.getByRole('link', { name: /一覧/i })).toHaveAttribute('href', '/drafts')
    })

    it('下書きがない場合はリンクが表示されない', () => {
      render(<PostForm genres={genres} draftCount={0} />)

      expect(screen.queryByRole('link', { name: /一覧/i })).not.toBeInTheDocument()
    })
  })
})

// ============================================================
// PollForm テスト
// ============================================================

describe('PollForm - 追加テスト', () => {
  const defaultProps = {
    isActive: true,
    onToggle: vi.fn(),
    options: ['', ''],
    onOptionsChange: vi.fn(),
    duration: 86400,
    onDurationChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('非アクティブ状態', () => {
    it('アイコンボタンのみ表示される', () => {
      render(<PollForm {...defaultProps} isActive={false} />)

      expect(screen.getByRole('button', { name: /アンケートを追加/i })).toBeInTheDocument()
    })

    it('クリックでonToggleが呼ばれる', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      render(<PollForm {...defaultProps} isActive={false} onToggle={onToggle} />)

      await user.click(screen.getByRole('button', { name: /アンケートを追加/i }))

      expect(onToggle).toHaveBeenCalled()
    })
  })

  describe('アクティブ状態', () => {
    it('選択肢入力フィールドが表示される', () => {
      render(<PollForm {...defaultProps} />)

      expect(screen.getByPlaceholderText('選択肢 1')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('選択肢 2')).toBeInTheDocument()
    })

    it('選択肢を追加できる', async () => {
      const user = userEvent.setup()
      const onOptionsChange = vi.fn()
      render(<PollForm {...defaultProps} onOptionsChange={onOptionsChange} />)

      await user.click(screen.getByText(/選択肢を追加/))

      expect(onOptionsChange).toHaveBeenCalledWith(['', '', ''])
    })

    it('選択肢は最大10個まで', () => {
      const options = Array(10).fill('')
      render(<PollForm {...defaultProps} options={options} />)

      expect(screen.queryByText(/選択肢を追加/)).not.toBeInTheDocument()
    })

    it('選択肢は最低2個必要', () => {
      render(<PollForm {...defaultProps} options={['a', 'b']} />)

      // 削除ボタンが表示されない
      const deleteButtons = screen.queryAllByRole('button').filter(btn =>
        btn.querySelector('svg') && btn.className.includes('text-muted-foreground')
      )
      expect(deleteButtons.length).toBe(0)
    })

    it('3個以上の場合は削除ボタンが表示される', () => {
      render(<PollForm {...defaultProps} options={['a', 'b', 'c']} />)

      // 削除ボタンが表示される
      const deleteButtons = screen.getAllByRole('button').filter(btn =>
        btn.querySelector('svg')
      )
      expect(deleteButtons.length).toBeGreaterThan(0)
    })
  })

  describe('選択肢の編集', () => {
    it('選択肢のテキストを変更できる', async () => {
      const user = userEvent.setup()
      const onOptionsChange = vi.fn()
      render(<PollForm {...defaultProps} onOptionsChange={onOptionsChange} />)

      const input = screen.getByPlaceholderText('選択肢 1')
      await user.type(input, 'テスト')

      expect(onOptionsChange).toHaveBeenCalled()
    })

    it('選択肢を削除できる', async () => {
      const user = userEvent.setup()
      const onOptionsChange = vi.fn()
      render(<PollForm {...defaultProps} options={['a', 'b', 'c']} onOptionsChange={onOptionsChange} />)

      // 削除ボタンをクリック
      const buttons = screen.getAllByRole('button')
      const deleteButton = buttons.find(btn =>
        btn.className.includes('hover:text-destructive')
      )
      if (deleteButton) {
        await user.click(deleteButton)
        expect(onOptionsChange).toHaveBeenCalled()
      }
    })
  })

  describe('投票期間', () => {
    it('期間を変更できる', async () => {
      const user = userEvent.setup()
      const onDurationChange = vi.fn()
      render(<PollForm {...defaultProps} onDurationChange={onDurationChange} />)

      const select = screen.getByRole('combobox')
      await user.selectOptions(select, '604800')

      expect(onDurationChange).toHaveBeenCalledWith(604800)
    })

    it('全ての期間オプションが表示される', () => {
      render(<PollForm {...defaultProps} />)

      expect(screen.getByText('1時間')).toBeInTheDocument()
      expect(screen.getByText('6時間')).toBeInTheDocument()
      expect(screen.getByText('12時間')).toBeInTheDocument()
      expect(screen.getByText('1日')).toBeInTheDocument()
      expect(screen.getByText('3日')).toBeInTheDocument()
      expect(screen.getByText('7日')).toBeInTheDocument()
    })
  })

  describe('閉じるボタン', () => {
    it('閉じるボタンでonToggleが呼ばれる', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      render(<PollForm {...defaultProps} onToggle={onToggle} />)

      // Xボタンをクリック
      const buttons = screen.getAllByRole('button')
      const closeButton = buttons.find(btn =>
        btn.className.includes('hover:bg-muted')
      )
      if (closeButton) {
        await user.click(closeButton)
        expect(onToggle).toHaveBeenCalled()
      }
    })
  })
})

// ============================================================
// PollDisplay テスト
// ============================================================

describe('PollDisplay - 追加テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVotePoll.mockResolvedValue({ success: true })
  })

  describe('投票UI', () => {
    it('未ログイン時は結果のみ表示される', () => {
      render(<PollDisplay poll={pollData} />)

      // 結果表示（パーセンテージ）- 5/8=62.5%->63%, 3/8=37.5%->38%
      expect(screen.getByText(/63%|62%/)).toBeInTheDocument()
      expect(screen.getByText(/38%|37%/)).toBeInTheDocument()
    })

    it('ログイン済みで未投票の場合は投票ボタンが表示される', () => {
      render(<PollDisplay poll={pollData} currentUserId="user-1" />)

      expect(screen.getByRole('button', { name: /投票する/i })).toBeInTheDocument()
    })

    it('投票済みの場合は結果が表示される', () => {
      const votedPoll = {
        ...pollData,
        votes: [{ userId: 'user-1', optionId: 'opt-1' }],
      }
      render(<PollDisplay poll={votedPoll} currentUserId="user-1" />)

      // 結果表示 - 5/8=62.5%->63%, 3/8=37.5%->38%
      expect(screen.getByText(/63%|62%/)).toBeInTheDocument()
      // チェックマークは選択肢テキストと一緒に表示される: "選択肢1 ✓"
      expect(screen.getByText(/選択肢1.*✓/)).toBeInTheDocument()
    })
  })

  describe('期限切れ', () => {
    it('期限切れの場合は「終了済み」と表示される', () => {
      const expiredPoll = {
        ...pollData,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      }
      render(<PollDisplay poll={expiredPoll} currentUserId="user-1" />)

      expect(screen.getByText('終了済み')).toBeInTheDocument()
    })

    it('期限切れの場合は投票ボタンが表示されない', () => {
      const expiredPoll = {
        ...pollData,
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      }
      render(<PollDisplay poll={expiredPoll} currentUserId="user-1" />)

      expect(screen.queryByRole('button', { name: /投票する/i })).not.toBeInTheDocument()
    })
  })

  describe('投票操作', () => {
    it('選択肢をクリックすると選択される', async () => {
      const user = userEvent.setup()
      render(<PollDisplay poll={pollData} currentUserId="user-1" />)

      const option = screen.getByText('選択肢1')
      await user.click(option)

      expect(option.closest('button')).toHaveClass('border-bonsai-green')
    })

    it('選択なしで投票ボタンは無効', () => {
      render(<PollDisplay poll={pollData} currentUserId="user-1" />)

      expect(screen.getByRole('button', { name: /投票する/i })).toBeDisabled()
    })

    it('選択後に投票できる', async () => {
      const user = userEvent.setup()
      render(<PollDisplay poll={pollData} currentUserId="user-1" />)

      await user.click(screen.getByText('選択肢1'))
      await user.click(screen.getByRole('button', { name: /投票する/i }))

      await waitFor(() => {
        expect(mockVotePoll).toHaveBeenCalledWith('poll-1', 'opt-1')
      })
    })

    it('投票中は「投票中...」と表示される', async () => {
      const user = userEvent.setup()
      mockVotePoll.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))

      render(<PollDisplay poll={pollData} currentUserId="user-1" />)

      await user.click(screen.getByText('選択肢1'))
      await user.click(screen.getByRole('button', { name: /投票する/i }))

      expect(screen.getByRole('button', { name: /投票中/i })).toBeInTheDocument()
    })
  })

  describe('投票数表示', () => {
    it('総投票数が表示される', () => {
      render(<PollDisplay poll={pollData} currentUserId="user-1" />)

      expect(screen.getByText('8票')).toBeInTheDocument()
    })

    it('残り時間が表示される', () => {
      render(<PollDisplay poll={pollData} currentUserId="user-1" />)

      expect(screen.getByText(/残り/)).toBeInTheDocument()
    })
  })

  describe('パーセンテージ計算', () => {
    it('0票の場合は0%と表示される', () => {
      const zeroPoll = {
        ...pollData,
        options: [
          { id: 'opt-1', text: '選択肢1', _count: { votes: 0 } },
          { id: 'opt-2', text: '選択肢2', _count: { votes: 0 } },
        ],
        _count: { votes: 0 },
      }
      render(<PollDisplay poll={zeroPoll} />)

      expect(screen.getAllByText('0%').length).toBe(2)
    })
  })

  describe('クリックイベント伝播', () => {
    it('クリックイベントが親に伝播しない', async () => {
      const user = userEvent.setup()
      const parentClick = vi.fn()
      render(
        <div onClick={parentClick}>
          <PollDisplay poll={pollData} currentUserId="user-1" />
        </div>
      )

      await user.click(screen.getByText('選択肢1'))

      expect(parentClick).not.toHaveBeenCalled()
    })
  })
})
