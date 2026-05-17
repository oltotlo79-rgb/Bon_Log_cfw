/**
 * PostActionsDropdown - branch coverage tests
 *
 * Targets:
 * - openUpward menu positioning
 * - overlay click closes menu
 * - cancel button in delete modal resets state
 * - isSubmitting shows '処理中...'
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { PostActionsDropdown } from '@/app/admin/posts/PostActionsDropdown'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockDeletePostByAdmin = vi.fn()
vi.mock('@/lib/actions/admin/posts', () => ({
  deletePostByAdmin: (...args: unknown[]) => mockDeletePostByAdmin(...args),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  value: vi.fn().mockReturnValue({
    top: 100, bottom: 130, left: 200, right: 230,
    width: 30, height: 30, x: 200, y: 100,
  }),
  configurable: true,
})

describe('PostActionsDropdown - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeletePostByAdmin.mockResolvedValue({ success: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
  })

  it('openUpward positioning when space is small', () => {
    Object.defineProperty(window, 'innerHeight', { value: 140, writable: true })

    render(<PostActionsDropdown postId="p-1" />)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('投稿を削除')).toBeInTheDocument()
  })

  it('overlay click closes menu', () => {
    render(<PostActionsDropdown postId="p-1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('投稿を削除')).toBeInTheDocument()

    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]')!
    fireEvent.click(overlay)

    expect(screen.queryByText('投稿を削除')).not.toBeInTheDocument()
  })

  it('cancel in delete modal resets reason and hides modal', () => {
    render(<PostActionsDropdown postId="p-1" />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('投稿を削除'))

    // Type a reason
    fireEvent.change(screen.getByPlaceholderText('削除理由'), { target: { value: 'テスト理由' } })

    // Cancel
    fireEvent.click(screen.getByText('キャンセル'))

    // Modal should be gone
    expect(screen.queryByPlaceholderText('削除理由')).not.toBeInTheDocument()
  })

  it('shows 処理中... while submitting', async () => {
    mockDeletePostByAdmin.mockImplementation(() => new Promise(() => {}))

    render(<PostActionsDropdown postId="p-1" />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('投稿を削除'))
    fireEvent.change(screen.getByPlaceholderText('削除理由'), { target: { value: 'スパム' } })
    fireEvent.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(screen.getByText('処理中...')).toBeInTheDocument()
    })
  })

  it('toggling menu off from open state', () => {
    render(<PostActionsDropdown postId="p-1" />)
    const button = screen.getByRole('button')

    // Open
    fireEvent.click(button)
    expect(screen.getByText('投稿を削除')).toBeInTheDocument()

    // Close by toggling
    fireEvent.click(button)
    expect(screen.queryByText('投稿を削除')).not.toBeInTheDocument()
  })
})
