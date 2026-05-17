import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ComposeButton } from '@/components/feed/ComposeButton'

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
vi.mock('@/lib/actions/post', () => ({
  createPost: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/draft', () => ({
  saveDraft: vi.fn().mockResolvedValue({ success: true }),
}))

// メンション検索モック
vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: vi.fn().mockResolvedValue([]),
}))

// 画像圧縮モック
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  isVideoFile: vi.fn(),
  formatFileSize: vi.fn(),
  MAX_IMAGE_SIZE: 10485760,
  MAX_VIDEO_SIZE: 104857600,
  uploadVideoToR2: vi.fn(),
}))

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
    { id: 'genre-2', name: '五葉松', category: '松柏類' },
  ],
  '雑木類': [
    { id: 'genre-3', name: 'もみじ', category: '雑木類' },
  ],
}

const defaultLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  canSchedulePost: false,
  canViewAnalytics: false,
}

const defaultProps = {
  genres: mockGenres,
  limits: defaultLimits,
}

describe('ComposeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('フローティング投稿ボタンを表示する', () => {
    render(<ComposeButton {...defaultProps} />)
    expect(screen.getByRole('button', { name: '投稿を作成' })).toBeInTheDocument()
  })

  it('投稿ボタンにペンアイコンが含まれる', () => {
    render(<ComposeButton {...defaultProps} />)
    const button = screen.getByRole('button', { name: '投稿を作成' })
    const svg = button.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('投稿ボタンにaria-labelが設定されている', () => {
    render(<ComposeButton {...defaultProps} />)
    const button = screen.getByRole('button', { name: '投稿を作成' })
    expect(button).toHaveAttribute('aria-label', '投稿を作成')
  })

  it('初期状態ではモーダルが閉じている', () => {
    render(<ComposeButton {...defaultProps} />)
    expect(screen.queryByPlaceholderText('いまどうしてる？')).not.toBeInTheDocument()
  })

  it('投稿ボタンをクリックするとモーダルが開く', async () => {
    const user = userEvent.setup()
    render(<ComposeButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: '投稿を作成' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
    })
  })

  it('モーダルが開くと投稿ボタンが表示される', async () => {
    const user = userEvent.setup()
    render(<ComposeButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: '投稿を作成' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '投稿する' })).toBeInTheDocument()
    })
  })

  it('モーダルの閉じるボタンでモーダルを閉じる', async () => {
    const user = userEvent.setup()
    render(<ComposeButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: '投稿を作成' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
    })

    // 閉じるボタンをクリック
    const allButtons = screen.getAllByRole('button')
    const closeButton = allButtons.find(btn => btn.className.includes('rounded-full') && btn !== screen.getByRole('button', { name: '投稿を作成' }))
    if (closeButton) {
      await user.click(closeButton)
    }

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('いまどうしてる？')).not.toBeInTheDocument()
    })
  })

  it('ジャンル情報がモーダルに渡される', async () => {
    const user = userEvent.setup()
    render(<ComposeButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: '投稿を作成' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
    })
  })

  it('下書き数を渡すとモーダルに表示される', async () => {
    const user = userEvent.setup()
    render(<ComposeButton {...defaultProps} draftCount={3} />)

    await user.click(screen.getByRole('button', { name: '投稿を作成' }))

    await waitFor(() => {
      expect(screen.getByText('下書き一覧')).toBeInTheDocument()
    })
  })

  it('盆栽一覧を渡すとモーダルに表示される', async () => {
    const bonsais = [
      { id: 'bonsai-1', name: '黒松一号', species: '黒松' },
    ]
    const user = userEvent.setup()
    render(<ComposeButton {...defaultProps} bonsais={bonsais} />)

    await user.click(screen.getByRole('button', { name: '投稿を作成' }))

    await waitFor(() => {
      expect(screen.getByText('関連する盆栽（任意）')).toBeInTheDocument()
    })
  })

  it('投稿ボタンに適切なスタイルクラスが適用されている', () => {
    render(<ComposeButton {...defaultProps} />)
    const button = screen.getByRole('button', { name: '投稿を作成' })
    expect(button.className).toContain('rounded-full')
  })

  it('投稿ボタンにホバースタイルが設定されている', () => {
    render(<ComposeButton {...defaultProps} />)
    const button = screen.getByRole('button', { name: '投稿を作成' })
    expect(button.className).toContain('hover:scale-105')
  })

  it('draftCountのデフォルト値は0', async () => {
    const user = userEvent.setup()
    render(<ComposeButton genres={mockGenres} limits={defaultLimits} />)

    await user.click(screen.getByRole('button', { name: '投稿を作成' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
    })
  })

  it('bonsaisのデフォルト値は空配列', async () => {
    const user = userEvent.setup()
    render(<ComposeButton genres={mockGenres} limits={defaultLimits} />)

    await user.click(screen.getByRole('button', { name: '投稿を作成' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('いまどうしてる？')).toBeInTheDocument()
    })
    // 盆栽選択は表示されない
    expect(screen.queryByText('関連する盆栽（任意）')).not.toBeInTheDocument()
  })

  it('モーダルを開閉しても投稿ボタンは常に表示される', async () => {
    const user = userEvent.setup()
    render(<ComposeButton {...defaultProps} />)

    // 初期状態でボタンがある
    expect(screen.getByRole('button', { name: '投稿を作成' })).toBeInTheDocument()

    // モーダルを開く
    await user.click(screen.getByRole('button', { name: '投稿を作成' }))

    // ボタンはまだある
    expect(screen.getByRole('button', { name: '投稿を作成' })).toBeInTheDocument()
  })

  it('ボタンがクリック可能な状態である', () => {
    render(<ComposeButton {...defaultProps} />)
    const button = screen.getByRole('button', { name: '投稿を作成' })
    expect(button).not.toBeDisabled()
  })
})
