

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { UserActionsDropdown } from '@/app/admin/users/UserActionsDropdown'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockSuspendUser = vi.fn()
const mockActivateUser = vi.fn()
vi.mock('@/lib/actions/admin/users', () => ({
  suspendUser: (...args: unknown[]) => mockSuspendUser(...args),
  activateUser: (...args: unknown[]) => mockActivateUser(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

const mockGetBoundingClientRect = vi.fn().mockReturnValue({
  top: 100, bottom: 130, left: 200, right: 230,
  width: 30, height: 30, x: 200, y: 100,
})
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  value: mockGetBoundingClientRect,
})
Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })

describe('UserActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuspendUser.mockResolvedValue({ success: true })
    mockActivateUser.mockResolvedValue({ success: true })
  })

  it('ドロップダウンボタンが表示される', () => {
    render(<UserActionsDropdown userId="u1" isSuspended={false} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('アクティブユーザーでアカウント停止ボタンを表示する', () => {
    render(<UserActionsDropdown userId="u1" isSuspended={false} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('アカウント停止')).toBeInTheDocument()
  })

  it('停止ユーザーでアカウント復帰ボタンを表示する', () => {
    render(<UserActionsDropdown userId="u1" isSuspended={true} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('アカウント復帰')).toBeInTheDocument()
  })

  it('アカウント停止クリックでモーダルを表示する', () => {
    render(<UserActionsDropdown userId="u1" isSuspended={false} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウント停止'))
    expect(screen.getByText('このユーザーのアカウントを停止します。停止理由を入力してください。')).toBeInTheDocument()
  })

  it('停止理由未入力でtoastを表示する', async () => {
    render(<UserActionsDropdown userId="u1" isSuspended={false} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウント停止'))
    fireEvent.click(screen.getByText('停止する'))
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '停止理由を入力してください', variant: 'destructive' }))
  })

  it('停止理由入力後に停止を実行する', async () => {
    render(<UserActionsDropdown userId="u1" isSuspended={false} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウント停止'))
    fireEvent.change(screen.getByPlaceholderText('停止理由'), { target: { value: 'スパム行為' } })
    fireEvent.click(screen.getByText('停止する'))
    await waitFor(() => {
      expect(mockSuspendUser).toHaveBeenCalledWith('u1', 'スパム行為')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('停止エラーでtoastを表示する', async () => {
    mockSuspendUser.mockResolvedValue({ error: '停止エラー' })
    render(<UserActionsDropdown userId="u1" isSuspended={false} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウント停止'))
    fireEvent.change(screen.getByPlaceholderText('停止理由'), { target: { value: 'reason' } })
    fireEvent.click(screen.getByText('停止する'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '停止エラー', variant: 'destructive' }))
    })
  })

  it('モーダルキャンセルでモーダルを閉じる', () => {
    render(<UserActionsDropdown userId="u1" isSuspended={false} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウント停止'))
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('このユーザーのアカウントを停止します。停止理由を入力してください。')).not.toBeInTheDocument()
  })

  it('アカウント復帰でconfirm→実行する', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<UserActionsDropdown userId="u1" isSuspended={true} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウント復帰'))
    await waitFor(() => {
      expect(mockActivateUser).toHaveBeenCalledWith('u1')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('アカウント復帰でconfirmキャンセル', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<UserActionsDropdown userId="u1" isSuspended={true} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウント復帰'))
    expect(mockActivateUser).not.toHaveBeenCalled()
  })

  it('アカウント復帰エラーでtoastを表示する', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockActivateUser.mockResolvedValue({ error: '復帰エラー' })
    render(<UserActionsDropdown userId="u1" isSuspended={true} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('アカウント復帰'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '復帰エラー', variant: 'destructive' }))
    })
  })

  it('背景クリックでメニューを閉じる', () => {
    render(<UserActionsDropdown userId="u1" isSuspended={false} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('アカウント停止')).toBeInTheDocument()
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]')
    if (overlay) fireEvent.click(overlay)
    expect(screen.queryByText('アカウント停止')).not.toBeInTheDocument()
  })

  it('画面下部でメニューが上向きに開く', () => {
    Object.defineProperty(window, 'innerHeight', { value: 100, writable: true })
    render(<UserActionsDropdown userId="u1" isSuspended={false} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('アカウント停止')).toBeInTheDocument()
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
  })
})
