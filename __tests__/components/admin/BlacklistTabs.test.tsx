import { vi } from 'vitest'
/**
 * BlacklistTabs コンポーネントのテスト
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BlacklistTabs } from '@/app/admin/blacklist/BlacklistTabs'

// モック
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, back: vi.fn() }),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

vi.mock('@/lib/actions/blacklist', () => ({
  addEmailToBlacklist: vi.fn().mockResolvedValue({ success: true }),
  removeEmailFromBlacklist: vi.fn().mockResolvedValue({ success: true }),
  addDeviceToBlacklist: vi.fn().mockResolvedValue({ success: true }),
  removeDeviceFromBlacklist: vi.fn().mockResolvedValue({ success: true }),
}))

import {
  addEmailToBlacklist,
  removeEmailFromBlacklist,
  addDeviceToBlacklist,
  removeDeviceFromBlacklist,
} from '@/lib/actions/blacklist'

const mockAddEmail = addEmailToBlacklist as ReturnType<typeof vi.fn>
const mockRemoveEmail = removeEmailFromBlacklist as ReturnType<typeof vi.fn>
const mockAddDevice = addDeviceToBlacklist as ReturnType<typeof vi.fn>
const mockRemoveDevice = removeDeviceFromBlacklist as ReturnType<typeof vi.fn>

const emailItems = [
  { id: 'e1', email: 'spam@example.com', reason: 'スパム行為', createdBy: 'admin', createdAt: new Date('2024-01-01') },
  { id: 'e2', email: 'bad@example.com', reason: null, createdBy: 'admin', createdAt: new Date('2024-02-01') },
]

const deviceItems = [
  { id: 'd1', fingerprint: 'abcdef1234567890abcdef1234567890', reason: '不正アクセス', originalEmail: 'user@example.com', createdBy: 'admin', createdAt: new Date('2024-01-01') },
  { id: 'd2', fingerprint: 'xyz1234567890abcdef1234567890abcd', reason: null, originalEmail: null, createdBy: 'admin', createdAt: new Date('2024-03-01') },
]

const defaultProps = {
  tab: 'email' as const,
  search: '',
  page: 1,
  limit: 20,
  emailItems,
  emailTotal: 2,
  deviceItems,
  deviceTotal: 2,
}

describe('BlacklistTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.confirm = vi.fn().mockReturnValue(true)
  })

  it('デフォルトでメールタブが表示される', () => {
    render(<BlacklistTabs {...defaultProps} />)
    const emailElements = screen.getAllByText(/メールアドレス/)
    expect(emailElements.length).toBeGreaterThan(0)
    expect(screen.getByText('spam@example.com')).toBeInTheDocument()
  })

  it('メールアイテムが表示される', () => {
    render(<BlacklistTabs {...defaultProps} />)
    expect(screen.getByText('spam@example.com')).toBeInTheDocument()
    expect(screen.getByText('bad@example.com')).toBeInTheDocument()
  })

  it('デバイスタブを選択するとデバイスアイテムが表示される', () => {
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    expect(screen.getByText(/abcdef1234567890abcd/)).toBeInTheDocument()
  })

  it('デバイスアイテムが表示される', () => {
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('タブ切り替えでrouter.pushが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    await user.click(screen.getByText('デバイス'))
    expect(mockPush).toHaveBeenCalledWith('/admin/blacklist?tab=device')
  })

  it('検索入力が表示される', () => {
    render(<BlacklistTabs {...defaultProps} />)
    expect(screen.getByPlaceholderText('メールアドレスで検索')).toBeInTheDocument()
  })

  it('デバイスタブでは検索プレースホルダーが変わる', () => {
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    expect(screen.getByPlaceholderText('フィンガープリント・メールで検索')).toBeInTheDocument()
  })

  it('正しい合計数を表示する', () => {
    render(<BlacklistTabs {...defaultProps} />)
    const countElements = screen.getAllByText('2')
    expect(countElements.length).toBeGreaterThan(0)
  })

  it('追加ボタンが表示される', () => {
    render(<BlacklistTabs {...defaultProps} />)
    expect(screen.getByText('追加')).toBeInTheDocument()
  })

  it('追加ボタンでモーダルが開く', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    await user.click(screen.getByText('追加'))
    expect(screen.getByText('メールアドレスを追加')).toBeInTheDocument()
  })

  it('メールアドレスを入力できる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    await user.click(screen.getByText('追加'))
    const input = screen.getByPlaceholderText('example@example.com')
    await user.type(input, 'new@example.com')
    expect(input).toHaveValue('new@example.com')
  })

  it('メール追加を送信するとサーバーアクションが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    await user.click(screen.getByText('追加'))
    await user.type(screen.getByPlaceholderText('example@example.com'), 'new@example.com')
    // モーダル内の追加ボタンをクリック
    const buttons = screen.getAllByText('追加')
    const modalAddBtn = buttons[buttons.length - 1]
    await user.click(modalAddBtn)

    await waitFor(() => {
      expect(mockAddEmail).toHaveBeenCalledWith('new@example.com', undefined)
    })
  })

  it('メール削除ボタンで確認ダイアログが表示される', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    const deleteButtons = screen.getAllByTitle('削除')
    await user.click(deleteButtons[0])
    expect(window.confirm).toHaveBeenCalledWith('このメールアドレスをブラックリストから削除しますか？')
  })

  it('メール削除を確認するとサーバーアクションが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    const deleteButtons = screen.getAllByTitle('削除')
    await user.click(deleteButtons[0])
    expect(mockRemoveEmail).toHaveBeenCalledWith('e1')
  })

  it('メール削除をキャンセルするとサーバーアクションが呼ばれない', async () => {
    ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    const deleteButtons = screen.getAllByTitle('削除')
    await user.click(deleteButtons[0])
    expect(mockRemoveEmail).not.toHaveBeenCalled()
  })

  it('デバイスタブで追加モーダルが開く', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    await user.click(screen.getByText('追加'))
    expect(screen.getByText('デバイスを追加')).toBeInTheDocument()
  })

  it('デバイスフィンガープリントを入力できる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    await user.click(screen.getByText('追加'))
    const input = screen.getByPlaceholderText('フィンガープリント')
    await user.type(input, 'newfingerprint123')
    expect(input).toHaveValue('newfingerprint123')
  })

  it('デバイス追加を送信するとサーバーアクションが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    await user.click(screen.getByText('追加'))
    await user.type(screen.getByPlaceholderText('フィンガープリント'), 'fp123')
    const buttons = screen.getAllByText('追加')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(mockAddDevice).toHaveBeenCalledWith('fp123', undefined, undefined)
    })
  })

  it('デバイス削除ボタンで確認ダイアログが表示される', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    const deleteButtons = screen.getAllByTitle('削除')
    await user.click(deleteButtons[0])
    expect(window.confirm).toHaveBeenCalledWith('このデバイスをブラックリストから削除しますか？')
  })

  it('デバイス削除を確認するとサーバーアクションが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    const deleteButtons = screen.getAllByTitle('削除')
    await user.click(deleteButtons[0])
    expect(mockRemoveDevice).toHaveBeenCalledWith('d1')
  })

  it('メールリストが空の場合に適切なメッセージを表示する', () => {
    render(<BlacklistTabs {...defaultProps} emailItems={[]} emailTotal={0} />)
    expect(screen.getByText('メールアドレスのブラックリストは空です')).toBeInTheDocument()
  })

  it('デバイスリストが空の場合に適切なメッセージを表示する', () => {
    render(<BlacklistTabs {...defaultProps} tab="device" deviceItems={[]} deviceTotal={0} />)
    expect(screen.getByText('デバイスのブラックリストは空です')).toBeInTheDocument()
  })

  it('メール追加エラー時にエラーメッセージが表示される', async () => {
    mockAddEmail.mockResolvedValueOnce({ error: '登録済みです' } as { error: string })
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    await user.click(screen.getByText('追加'))
    await user.type(screen.getByPlaceholderText('example@example.com'), 'dup@example.com')
    const buttons = screen.getAllByText('追加')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(screen.getByText('登録済みです')).toBeInTheDocument()
    })
  })

  it('メール削除エラー時にトーストが表示される', async () => {
    mockRemoveEmail.mockResolvedValueOnce({ error: '削除に失敗しました' } as { error: string })
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    const deleteButtons = screen.getAllByTitle('削除')
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除に失敗しました', variant: 'destructive' }))
    })
  })

  it('理由がnullの場合は-が表示される', () => {
    render(<BlacklistTabs {...defaultProps} />)
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('キャンセルボタンでモーダルが閉じる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} />)
    await user.click(screen.getByText('追加'))
    expect(screen.getByText('メールアドレスを追加')).toBeInTheDocument()
    await user.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('メールアドレスを追加')).not.toBeInTheDocument()
  })

  it('デバイス削除エラー時にトーストが表示される', async () => {
    mockRemoveDevice.mockResolvedValueOnce({ error: 'デバイス削除に失敗しました' } as { error: string })
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    const deleteButtons = screen.getAllByTitle('削除')
    await user.click(deleteButtons[0])

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'デバイス削除に失敗しました', variant: 'destructive' }))
    })
  })

  it('デバイス追加エラー時にエラーメッセージが表示される', async () => {
    mockAddDevice.mockResolvedValueOnce({ error: 'フィンガープリントは既に登録されています' } as { error: string })
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    await user.click(screen.getByText('追加'))
    await user.type(screen.getByPlaceholderText('フィンガープリント'), 'dupfingerprint')
    const buttons = screen.getAllByText('追加')
    await user.click(buttons[buttons.length - 1])

    await waitFor(() => {
      expect(screen.getByText('フィンガープリントは既に登録されています')).toBeInTheDocument()
    })
  })

  it('デバイス追加時に関連メールアドレスを入力できる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    await user.click(screen.getByText('追加'))

    // フィンガープリントを入力
    await user.type(screen.getByPlaceholderText('フィンガープリント'), 'fp12345')

    // 関連メールアドレスを入力
    const emailInput = screen.getByPlaceholderText('元ユーザーのメールアドレス')
    await user.type(emailInput, 'related@example.com')
    expect(emailInput).toHaveValue('related@example.com')
  })

  it('デバイス追加時に理由を入力できる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    await user.click(screen.getByText('追加'))

    // 理由を入力
    const reasonInput = screen.getByPlaceholderText('ブロックの理由')
    await user.type(reasonInput, '不正アクセス')
    expect(reasonInput).toHaveValue('不正アクセス')
  })

  it('メールタブをクリックするとrouter.pushが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)

    // メールアドレスタブをクリック
    const emailTabButtons = screen.getAllByText(/メールアドレス/)
    const emailTab = emailTabButtons.find(el => el.closest('button'))
    if (emailTab) {
      await user.click(emailTab)
      expect(mockPush).toHaveBeenCalledWith('/admin/blacklist?tab=email')
    }
  })

  it('デバイス削除をキャンセルするとサーバーアクションが呼ばれない', async () => {
    ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false)
    const user = userEvent.setup()
    render(<BlacklistTabs {...defaultProps} tab="device" />)
    const deleteButtons = screen.getAllByTitle('削除')
    await user.click(deleteButtons[0])
    expect(mockRemoveDevice).not.toHaveBeenCalled()
  })
})
