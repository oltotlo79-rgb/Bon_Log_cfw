import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { SearchTabs } from '@/components/search/SearchTabs'

// Next.js navigation モック
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}))

describe('SearchTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('3つのタブを表示する', () => {
    render(<SearchTabs />)
    expect(screen.getByRole('button', { name: '投稿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ユーザー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'タグ' })).toBeInTheDocument()
  })

  it('デフォルトで投稿タブがアクティブ', () => {
    render(<SearchTabs />)
    const postsTab = screen.getByRole('button', { name: '投稿' })
    expect(postsTab).toHaveClass('text-primary')
  })

  it('指定したタブがアクティブになる', () => {
    render(<SearchTabs activeTab="users" />)
    const usersTab = screen.getByRole('button', { name: 'ユーザー' })
    expect(usersTab).toHaveClass('text-primary')
  })

  it('タブクリックでURLを変更する', async () => {
    const user = userEvent.setup()
    render(<SearchTabs />)

    await user.click(screen.getByRole('button', { name: 'ユーザー' }))
    expect(mockPush).toHaveBeenCalledWith('/search?tab=users')
  })

  it('タグタブクリックでURLを変更する', async () => {
    const user = userEvent.setup()
    render(<SearchTabs />)

    await user.click(screen.getByRole('button', { name: 'タグ' }))
    expect(mockPush).toHaveBeenCalledWith('/search?tab=tags')
  })

  it('非アクティブなタブはtext-muted-foregroundクラスを持つ', () => {
    render(<SearchTabs activeTab="posts" />)
    const usersTab = screen.getByRole('button', { name: 'ユーザー' })
    expect(usersTab).toHaveClass('text-muted-foreground')
  })
})
