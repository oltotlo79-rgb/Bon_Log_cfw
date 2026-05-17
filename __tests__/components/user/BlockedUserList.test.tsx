import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BlockedUserList } from '@/components/user/BlockedUserList'

// Server Action モック
const mockUnblockUser = vi.fn()
vi.mock('@/lib/actions/block', () => ({
  unblockUser: (...args: unknown[]) => mockUnblockUser(...args),
}))

// useRouter モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// useToast モック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

describe('BlockedUserList', () => {
  const mockUsers = [
    {
      id: 'user-1',
      nickname: 'ブロックユーザー1',
      avatarUrl: 'https://example.com/avatar1.jpg',
      bio: '自己紹介文1',
    },
    {
      id: 'user-2',
      nickname: 'ブロックユーザー2',
      avatarUrl: null,
      bio: null,
    },
    {
      id: 'user-3',
      nickname: 'ブロックユーザー3',
      avatarUrl: null,
      bio: '長い自己紹介文がここに入ります',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ブロック中のユーザー一覧を表示する', () => {
    render(<BlockedUserList users={mockUsers} />)

    expect(screen.getByText('ブロックユーザー1')).toBeInTheDocument()
    expect(screen.getByText('ブロックユーザー2')).toBeInTheDocument()
    expect(screen.getByText('ブロックユーザー3')).toBeInTheDocument()
  })

  it('各ユーザーにブロック解除ボタンを表示する', () => {
    render(<BlockedUserList users={mockUsers} />)

    const unblockButtons = screen.getAllByRole('button', { name: 'ブロック解除' })
    expect(unblockButtons).toHaveLength(3)
  })

  it('自己紹介がある場合は表示する', () => {
    render(<BlockedUserList users={mockUsers} />)

    expect(screen.getByText('自己紹介文1')).toBeInTheDocument()
  })

  it('アバター画像がある場合は表示する', () => {
    render(<BlockedUserList users={mockUsers} />)

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1) // 1人だけアバターURLがある
  })

  it('アバター画像がない場合はイニシャルを表示する', () => {
    render(<BlockedUserList users={mockUsers} />)

    // 2人のユーザーがアバターなしなので2つのイニシャルが表示される
    const initials = screen.getAllByText('ブ')
    expect(initials.length).toBe(2)
  })

  it('ユーザープロフィールへのリンクを持つ', () => {
    render(<BlockedUserList users={mockUsers} />)

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/users/user-1')
  })

  it('ブロック解除をクリックするとServer Actionを呼び出す', async () => {
    mockUnblockUser.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<BlockedUserList users={mockUsers} />)

    const unblockButtons = screen.getAllByRole('button', { name: 'ブロック解除' })
    await user.click(unblockButtons[0])

    await waitFor(() => {
      expect(mockUnblockUser).toHaveBeenCalledWith('user-1')
    })
  })

  it('ブロック解除成功時にトーストを表示する', async () => {
    mockUnblockUser.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<BlockedUserList users={mockUsers} />)

    const unblockButtons = screen.getAllByRole('button', { name: 'ブロック解除' })
    await user.click(unblockButtons[0])

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'ブロックを解除しました',
        description: 'ブロックユーザー1さんのブロックを解除しました',
      })
    })
  })

  it('ブロック解除エラー時にエラートーストを表示する', async () => {
    mockUnblockUser.mockResolvedValue({ success: false, error: 'ブロック解除に失敗しました' })
    const user = userEvent.setup()
    render(<BlockedUserList users={mockUsers} />)

    const unblockButtons = screen.getAllByRole('button', { name: 'ブロック解除' })
    await user.click(unblockButtons[0])

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'エラー',
        description: 'ブロック解除に失敗しました',
        variant: 'destructive',
      })
    })
  })

  it('ブロック解除後にページをリフレッシュする', async () => {
    mockUnblockUser.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<BlockedUserList users={mockUsers} />)

    const unblockButtons = screen.getAllByRole('button', { name: 'ブロック解除' })
    await user.click(unblockButtons[0])

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('ローディング中はボタンが無効化される', async () => {
    mockUnblockUser.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
    )
    const user = userEvent.setup()
    render(<BlockedUserList users={mockUsers} />)

    const unblockButtons = screen.getAllByRole('button', { name: 'ブロック解除' })
    await user.click(unblockButtons[0])

    await waitFor(() => {
      expect(screen.getByText('...')).toBeInTheDocument()
    })
  })

  it('空の配列の場合は何も表示しない', () => {
    const { container } = render(<BlockedUserList users={[]} />)

    expect(container.querySelector('.space-y-4')?.children).toHaveLength(0)
  })
})
