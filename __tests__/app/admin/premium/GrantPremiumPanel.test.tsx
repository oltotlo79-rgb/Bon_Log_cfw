import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '../../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { GrantPremiumPanel } from '@/app/admin/premium/GrantPremiumPanel'

// fake timers for debounce control
vi.useFakeTimers({ shouldAdvanceTime: true })

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockSearchUserForPremium = vi.fn()
const mockGrantPremium = vi.fn()
vi.mock('@/lib/actions/admin/premium', () => ({
  searchUserForPremium: (...args: unknown[]) => mockSearchUserForPremium(...args),
  grantPremium: (...args: unknown[]) => mockGrantPremium(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

vi.mock('lucide-react', () => ({
  Search: ({ className }: { className?: string }) => <span data-testid="search-icon" className={className} />,
  Crown: ({ className }: { className?: string }) => <span data-testid="crown-icon" className={className} />,
  UserCheck: ({ className }: { className?: string }) => <span data-testid="usercheck-icon" className={className} />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean
    children: React.ReactNode
    onOpenChange?: (v: boolean) => void
  }) =>
    open ? (
      <div data-testid="dialog" onClick={() => onOpenChange?.(false)}>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content" onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

const nonPremiumUser = {
  id: 'user-1',
  email: 'user1@example.com',
  nickname: 'テストユーザー1',
  avatarUrl: null,
  isPremium: false,
  premiumExpiresAt: null,
}

const premiumUser = {
  id: 'user-2',
  email: 'user2@example.com',
  nickname: 'プレミアムユーザー',
  avatarUrl: '/avatar.jpg',
  isPremium: true,
  premiumExpiresAt: new Date('2025-12-31'),
}

describe('GrantPremiumPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchUserForPremium.mockResolvedValue({ users: [] })
    mockGrantPremium.mockResolvedValue({ success: true, data: { expiresAt: new Date('2025-12-31') } })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('検索入力 / debounce', () => {
    it('初期状態でプレースホルダー付きの検索フィールドが表示される', () => {
      render(<GrantPremiumPanel />)
      expect(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）')
      ).toBeInTheDocument()
    })

    it('1文字の入力では searchUserForPremium が呼ばれない', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      const input = screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）')
      await user.type(input, 'a')

      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      expect(mockSearchUserForPremium).not.toHaveBeenCalled()
    })

    it('2文字以上 + debounce 経過後に searchUserForPremium が呼ばれる', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      const input = screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）')
      await user.type(input, 'テスト')

      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(mockSearchUserForPremium).toHaveBeenCalledWith('テスト')
      })
    })

    it('検索結果にユーザーのニックネームとメールが表示される', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      const input = screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）')
      await user.type(input, 'テスト')

      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('テストユーザー1')).toBeInTheDocument()
        expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      })
    })

    it('検索結果が 0 件のとき「ユーザーが見つかりませんでした」を表示する', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      const input = screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）')
      await user.type(input, 'zzz')

      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('ユーザーが見つかりませんでした')).toBeInTheDocument()
      })
    })

    it('searchUserForPremium がエラー（success:false）を返したときエラートーストを表示する', async () => {
      mockSearchUserForPremium.mockResolvedValue({ success: false, error: '検索失敗' })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      const input = screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）')
      await user.type(input, 'ab')

      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: '検索に失敗しました', variant: 'destructive' })
        )
      })
    })

    it('1文字入力後に文字を消すと検索結果がクリアされる', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      const input = screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）')
      await user.type(input, 'ab')

      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.getByText('テストユーザー1')).toBeInTheDocument()
      })

      // 2文字未満に戻す
      await user.clear(input)
      await user.type(input, 'a')

      await act(async () => {
        vi.advanceTimersByTime(400)
      })

      await waitFor(() => {
        expect(screen.queryByText('テストユーザー1')).not.toBeInTheDocument()
      })
    })
  })

  describe('未プレミアムユーザー', () => {
    it('「付与する」ボタンが表示される', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'テスト'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '付与する' })).toBeInTheDocument()
      })
    })

    it('「プレミアム済み」バッジが表示されない', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'テスト'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.queryByText('プレミアム済み')).not.toBeInTheDocument()
      })
    })

    it('「付与する」ボタンを押すと Dialog が開く', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'テスト'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '付与する' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: '付与する' }))

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByText('プレミアム会員を付与')).toBeInTheDocument()
      expect(screen.getByText(/テストユーザー1 さんにプレミアム会員を付与します/)).toBeInTheDocument()
    })
  })

  describe('プレミアム済みユーザー', () => {
    it('「プレミアム済み」バッジと「再付与」ボタンが表示される', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [premiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'プレミアム'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.getByText('プレミアム済み')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '再付与' })).toBeInTheDocument()
      })
    })

    it('「再付与」ボタンを押すと Dialog が開き現在の期限が表示される', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [premiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'プレミアム'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '再付与' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: '再付与' }))

      expect(screen.getByTestId('dialog')).toBeInTheDocument()
      expect(screen.getByText(/現在の期限/)).toBeInTheDocument()
      expect(screen.getByText(/新規付与で上書きされます/)).toBeInTheDocument()
    })

    it('アバター画像がある場合は img 要素が表示される', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [premiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'プレミアム'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        const img = screen.getByRole('img', { name: 'プレミアムユーザー' })
        expect(img).toBeInTheDocument()
        expect(img).toHaveAttribute('src', '/avatar.jpg')
      })
    })
  })

  describe('Dialog 内の日数バリデーション', () => {
    async function openDialog() {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'テスト'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '付与する' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: '付与する' }))

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })
    }

    it('初期値が DEFAULT_PREMIUM_GRANT_DAYS (30) である', async () => {
      await openDialog()
      expect(screen.getByLabelText('有効日数')).toHaveValue(30)
    })

    it('日数が 0 のとき付与ボタンが disabled になる', async () => {
      await openDialog()

      const daysInput = screen.getByLabelText('有効日数')
      fireEvent.change(daysInput, { target: { value: '0' } })

      // Dialog 内の「付与する」ボタン（2つ目）を取得
      const grantButtons = screen.getAllByRole('button', { name: '付与する' })
      const dialogGrantButton = grantButtons[grantButtons.length - 1]
      expect(dialogGrantButton).toBeDisabled()
    })

    it('日数が 366 のとき付与ボタンが disabled になる', async () => {
      await openDialog()

      const daysInput = screen.getByLabelText('有効日数')
      fireEvent.change(daysInput, { target: { value: '366' } })

      const grantButtons = screen.getAllByRole('button', { name: '付与する' })
      const dialogGrantButton = grantButtons[grantButtons.length - 1]
      expect(dialogGrantButton).toBeDisabled()
    })

    it('日数が 1 のとき付与ボタンが有効になる（MIN_PREMIUM_GRANT_DAYS 境界値）', async () => {
      await openDialog()

      const daysInput = screen.getByLabelText('有効日数')
      fireEvent.change(daysInput, { target: { value: '1' } })

      const grantButtons = screen.getAllByRole('button', { name: '付与する' })
      const dialogGrantButton = grantButtons[grantButtons.length - 1]
      expect(dialogGrantButton).not.toBeDisabled()
    })

    it('日数が 365 のとき付与ボタンが有効になる（MAX_PREMIUM_GRANT_DAYS 境界値）', async () => {
      await openDialog()

      const daysInput = screen.getByLabelText('有効日数')
      fireEvent.change(daysInput, { target: { value: '365' } })

      const grantButtons = screen.getAllByRole('button', { name: '付与する' })
      const dialogGrantButton = grantButtons[grantButtons.length - 1]
      expect(dialogGrantButton).not.toBeDisabled()
    })
  })

  describe('grantPremium 呼び出し', () => {
    async function openDialogAndGrant(days = '30') {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'テスト'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '付与する' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: '付与する' }))

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })

      if (days !== '30') {
        const daysInput = screen.getByLabelText('有効日数')
        fireEvent.change(daysInput, { target: { value: days } })
      }

      const grantButtons = screen.getAllByRole('button', { name: '付与する' })
      const dialogGrantButton = grantButtons[grantButtons.length - 1]
      if (!dialogGrantButton) throw new Error('付与するボタンが見つかりません')
      fireEvent.click(dialogGrantButton)
    }

    it('grantPremium 成功 → 成功トーストが表示される', async () => {
      mockGrantPremium.mockResolvedValue({
        success: true,
        data: { expiresAt: new Date('2025-12-31') },
      })

      await openDialogAndGrant()

      await waitFor(() => {
        expect(mockGrantPremium).toHaveBeenCalledWith('user-1', 30)
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('テストユーザー1'),
          })
        )
      })
    })

    it('grantPremium 成功 → router.refresh() が呼ばれる', async () => {
      mockGrantPremium.mockResolvedValue({
        success: true,
        data: { expiresAt: new Date('2025-12-31') },
      })

      await openDialogAndGrant()

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled()
      })
    })

    it('grantPremium 失敗 → エラートーストが表示される', async () => {
      mockGrantPremium.mockResolvedValue({ success: false, error: '付与に失敗しました' })

      await openDialogAndGrant()

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: '付与に失敗しました', variant: 'destructive' })
        )
      })
    })

    it('grantPremium 失敗 → router.refresh() は呼ばれない', async () => {
      mockGrantPremium.mockResolvedValue({ success: false, error: '付与に失敗しました' })

      await openDialogAndGrant()

      await waitFor(() => {
        expect(mockGrantPremium).toHaveBeenCalled()
      })

      expect(mockRefresh).not.toHaveBeenCalled()
    })

    it('expiresAt が null のとき成功トーストに「不明」が含まれる', async () => {
      mockGrantPremium.mockResolvedValue({
        success: true,
        data: { expiresAt: null },
      })

      await openDialogAndGrant()

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: '有効期限: 不明',
          })
        )
      })
    })
  })

  describe('Dialog キャンセル', () => {
    it('キャンセルボタンで Dialog が閉じる', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'テスト'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '付与する' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: '付与する' }))

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()
    })

    it('キャンセル後に日数入力が DEFAULT_PREMIUM_GRANT_DAYS にリセットされる', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'テスト'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '付与する' })).toBeInTheDocument()
      })

      fireEvent.click(screen.getByRole('button', { name: '付与する' }))

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
      })

      // 日数を変更してからキャンセル
      const daysInput = screen.getByLabelText('有効日数')
      fireEvent.change(daysInput, { target: { value: '90' } })
      expect(daysInput).toHaveValue(90)

      fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument()

      // 再度ダイアログを開いたとき初期値 30 に戻っている
      fireEvent.click(screen.getByRole('button', { name: '付与する' }))

      await waitFor(() => {
        expect(screen.getByTestId('dialog')).toBeInTheDocument()
        expect(screen.getByLabelText('有効日数')).toHaveValue(30)
      })
    })
  })

  describe('複数ユーザーの表示', () => {
    it('プレミアム済みと未プレミアムユーザーが混在しても正しく表示される', async () => {
      mockSearchUserForPremium.mockResolvedValue({ users: [nonPremiumUser, premiumUser] })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<GrantPremiumPanel />)

      await user.type(
        screen.getByPlaceholderText('ニックネーム・メールアドレスで検索（2文字以上）'),
        'ユーザー'
      )
      await act(async () => { vi.advanceTimersByTime(400) })

      await waitFor(() => {
        expect(screen.getByText('テストユーザー1')).toBeInTheDocument()
        expect(screen.getByText('プレミアムユーザー')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '付与する' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '再付与' })).toBeInTheDocument()
        expect(screen.getByText('プレミアム済み')).toBeInTheDocument()
      })
    })
  })
})
