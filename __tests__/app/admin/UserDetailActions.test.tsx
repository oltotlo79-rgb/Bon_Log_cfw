

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { UserDetailActions } from '@/app/admin/users/[id]/UserDetailActions'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const mockSuspendUser = vi.fn()
const mockActivateUser = vi.fn()
const mockDeleteUserByAdmin = vi.fn()
vi.mock('@/lib/actions/admin/users', () => ({
  suspendUser: (...args: unknown[]) => mockSuspendUser(...args),
  activateUser: (...args: unknown[]) => mockActivateUser(...args),
  deleteUserByAdmin: (...args: unknown[]) => mockDeleteUserByAdmin(...args),
}))

describe('UserDetailActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSuspendUser.mockResolvedValue({ success: true })
    mockActivateUser.mockResolvedValue({ success: true })
    mockDeleteUserByAdmin.mockResolvedValue({ success: true })
  })

  const activeProps = { userId: 'u1', isSuspended: false, nickname: 'テスト' }
  const suspendedProps = { userId: 'u1', isSuspended: true, nickname: 'テスト' }

  it('アクティブユーザーで停止ボタンと理由入力が表示される', () => {
    render(<UserDetailActions {...activeProps} />)
    expect(screen.getByText('アカウントを停止')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('停止理由を入力...')).toBeInTheDocument()
  })

  it('停止ユーザーで復帰ボタンが表示される', () => {
    render(<UserDetailActions {...suspendedProps} />)
    expect(screen.getByText('アカウントを復帰')).toBeInTheDocument()
  })

  it('理由未入力で停止ボタンが無効になっている', () => {
    render(<UserDetailActions {...activeProps} />)
    expect(screen.getByText('アカウントを停止')).toBeDisabled()
  })

  it('理由入力後に停止を実行する', async () => {
    render(<UserDetailActions {...activeProps} />)
    fireEvent.change(screen.getByPlaceholderText('停止理由を入力...'), { target: { value: '規約違反' } })
    fireEvent.click(screen.getByText('アカウントを停止'))
    await waitFor(() => {
      expect(mockSuspendUser).toHaveBeenCalledWith('u1', '規約違反')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('停止エラーでエラーメッセージが表示される', async () => {
    mockSuspendUser.mockResolvedValue({ success: false, error: '停止失敗' })
    render(<UserDetailActions {...activeProps} />)
    fireEvent.change(screen.getByPlaceholderText('停止理由を入力...'), { target: { value: '理由' } })
    fireEvent.click(screen.getByText('アカウントを停止'))
    await waitFor(() => {
      expect(screen.getByText('停止失敗')).toBeInTheDocument()
    })
  })

  it('復帰を実行する', async () => {
    render(<UserDetailActions {...suspendedProps} />)
    fireEvent.click(screen.getByText('アカウントを復帰'))
    await waitFor(() => {
      expect(mockActivateUser).toHaveBeenCalledWith('u1')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('復帰エラーでエラーメッセージが表示される', async () => {
    mockActivateUser.mockResolvedValue({ success: false, error: '復帰失敗' })
    render(<UserDetailActions {...suspendedProps} />)
    fireEvent.click(screen.getByText('アカウントを復帰'))
    await waitFor(() => {
      expect(screen.getByText('復帰失敗')).toBeInTheDocument()
    })
  })

  it('削除ボタンクリックで確認パネルが表示される', () => {
    render(<UserDetailActions {...activeProps} />)
    fireEvent.click(screen.getByText('アカウントを削除'))
    expect(screen.getByText('アカウント削除の確認')).toBeInTheDocument()
    expect(screen.getByText(/テスト/)).toBeInTheDocument()
  })

  it('削除確認でキャンセルできる', () => {
    render(<UserDetailActions {...activeProps} />)
    fireEvent.click(screen.getByText('アカウントを削除'))
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('アカウント削除の確認')).not.toBeInTheDocument()
  })

  it('アクティブユーザーの削除時に理由未入力で削除ボタンが無効', () => {
    render(<UserDetailActions {...activeProps} />)
    fireEvent.click(screen.getByText('アカウントを削除'))
    expect(screen.getByText('削除する')).toBeDisabled()
  })

  it('アクティブユーザーの削除を実行する', async () => {
    render(<UserDetailActions {...activeProps} />)
    fireEvent.click(screen.getByText('アカウントを削除'))
    fireEvent.change(screen.getByPlaceholderText('削除理由を入力...'), { target: { value: '悪質' } })
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(mockDeleteUserByAdmin).toHaveBeenCalledWith('u1', '悪質')
    })
    expect(mockPush).toHaveBeenCalledWith('/admin/users')
  })

  it('停止ユーザーの削除では理由入力欄が表示されない', () => {
    render(<UserDetailActions {...suspendedProps} />)
    fireEvent.click(screen.getByText('アカウントを削除'))
    expect(screen.queryByPlaceholderText('削除理由を入力...')).not.toBeInTheDocument()
  })

  it('削除エラーでエラーメッセージが表示される', async () => {
    mockDeleteUserByAdmin.mockResolvedValue({ success: false, error: '削除失敗' })
    render(<UserDetailActions {...activeProps} />)
    fireEvent.click(screen.getByText('アカウントを削除'))
    fireEvent.change(screen.getByPlaceholderText('削除理由を入力...'), { target: { value: '理由' } })
    fireEvent.click(screen.getByText('削除する'))
    await waitFor(() => {
      expect(screen.getByText('削除失敗')).toBeInTheDocument()
    })
  })
})
