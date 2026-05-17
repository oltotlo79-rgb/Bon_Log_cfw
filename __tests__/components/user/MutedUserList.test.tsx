import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { MutedUserList } from '@/components/user/MutedUserList'

// Server Action モック
const mockUnmuteUser = vi.fn()
vi.mock('@/lib/actions/mute', () => ({
  unmuteUser: (...args: unknown[]) => mockUnmuteUser(...args),
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

describe('MutedUserList', () => {
  const mockUsers = [
    {
      id: 'user-1',
      nickname: 'ミュートユーザー1',
      avatarUrl: 'https://example.com/avatar1.jpg',
      bio: '自己紹介文1',
    },
    {
      id: 'user-2',
      nickname: 'ミュートユーザー2',
      avatarUrl: null,
      bio: null,
    },
    {
      id: 'user-3',
      nickname: 'ミュートユーザー3',
      avatarUrl: null,
      bio: '長い自己紹介文がここに入ります',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ミュート中のユーザー一覧を表示する', () => {
    render(<MutedUserList users={mockUsers} />)

    expect(screen.getByText('ミュートユーザー1')).toBeInTheDocument()
    expect(screen.getByText('ミュートユーザー2')).toBeInTheDocument()
    expect(screen.getByText('ミュートユーザー3')).toBeInTheDocument()
  })

  it('各ユーザーにミュート解除ボタンを表示する', () => {
    render(<MutedUserList users={mockUsers} />)

    const unmuteButtons = screen.getAllByRole('button', { name: 'ミュート解除' })
    expect(unmuteButtons).toHaveLength(3)
  })

  it('自己紹介がある場合は表示する', () => {
    render(<MutedUserList users={mockUsers} />)

    expect(screen.getByText('自己紹介文1')).toBeInTheDocument()
  })

  it('アバター画像がある場合は表示する', () => {
    render(<MutedUserList users={mockUsers} />)

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(1)
  })

  it('アバター画像がない場合はイニシャルを表示する', () => {
    render(<MutedUserList users={mockUsers} />)

    // 2人のユーザーがアバターなしなので2つのイニシャルが表示される
    const initials = screen.getAllByText('ミ')
    expect(initials.length).toBe(2)
  })

  it('ユーザープロフィールへのリンクを持つ', () => {
    render(<MutedUserList users={mockUsers} />)

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/users/user-1')
  })

  it('ミュート解除をクリックするとServer Actionを呼び出す', async () => {
    mockUnmuteUser.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<MutedUserList users={mockUsers} />)

    const unmuteButtons = screen.getAllByRole('button', { name: 'ミュート解除' })
    await user.click(unmuteButtons[0])

    await waitFor(() => {
      expect(mockUnmuteUser).toHaveBeenCalledWith('user-1')
    })
  })

  it('ミュート解除成功時にトーストを表示する', async () => {
    mockUnmuteUser.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<MutedUserList users={mockUsers} />)

    const unmuteButtons = screen.getAllByRole('button', { name: 'ミュート解除' })
    await user.click(unmuteButtons[0])

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'ミュートを解除しました',
        description: 'ミュートユーザー1さんのミュートを解除しました',
      })
    })
  })

  it('ミュート解除エラー時にエラートーストを表示する', async () => {
    mockUnmuteUser.mockResolvedValue({ error: 'ミュート解除に失敗しました' })
    const user = userEvent.setup()
    render(<MutedUserList users={mockUsers} />)

    const unmuteButtons = screen.getAllByRole('button', { name: 'ミュート解除' })
    await user.click(unmuteButtons[0])

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'エラー',
        description: 'ミュート解除に失敗しました',
        variant: 'destructive',
      })
    })
  })

  it('ミュート解除後にページをリフレッシュする', async () => {
    mockUnmuteUser.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<MutedUserList users={mockUsers} />)

    const unmuteButtons = screen.getAllByRole('button', { name: 'ミュート解除' })
    await user.click(unmuteButtons[0])

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('ローディング中はボタンが無効化される', async () => {
    mockUnmuteUser.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
    )
    const user = userEvent.setup()
    render(<MutedUserList users={mockUsers} />)

    const unmuteButtons = screen.getAllByRole('button', { name: 'ミュート解除' })
    await user.click(unmuteButtons[0])

    await waitFor(() => {
      expect(screen.getByText('...')).toBeInTheDocument()
    })
  })

  it('空の配列の場合は何も表示しない', () => {
    const { container } = render(<MutedUserList users={[]} />)

    expect(container.querySelector('.space-y-4')?.children).toHaveLength(0)
  })
})
