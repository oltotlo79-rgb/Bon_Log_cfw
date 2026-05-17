import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ThreadMuteButton } from '@/components/comment/ThreadMuteButton'

const mockMuteThread = vi.fn()
const mockUnmuteThread = vi.fn()
vi.mock('@/lib/actions/comment-thread-mute', () => ({
  muteThread: (...args: unknown[]) => mockMuteThread(...args),
  unmuteThread: (...args: unknown[]) => mockUnmuteThread(...args),
}))

describe('ThreadMuteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未ミュート時にBellアイコンを表示する', () => {
    render(<ThreadMuteButton rootCommentId="c1" initialMuted={false} />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('title', 'スレッド通知をミュート')
    expect(button.querySelector('svg.lucide-bell')).toBeInTheDocument()
  })

  it('ミュート済み時にBellOffアイコンを表示する', () => {
    render(<ThreadMuteButton rootCommentId="c1" initialMuted={true} />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('title', 'スレッド通知をオンにする')
    expect(button.querySelector('svg.lucide-bell-off')).toBeInTheDocument()
  })

  it('未ミュート状態からクリックでmuteThreadを呼ぶ', async () => {
    mockMuteThread.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ThreadMuteButton rootCommentId="c1" initialMuted={false} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockMuteThread).toHaveBeenCalledWith('c1')
    })
    // ミュート後はBellOffに切り替わる
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('title', 'スレッド通知をオンにする')
    })
  })

  it('ミュート済み状態からクリックでunmuteThreadを呼ぶ', async () => {
    mockUnmuteThread.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ThreadMuteButton rootCommentId="c1" initialMuted={true} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockUnmuteThread).toHaveBeenCalledWith('c1')
    })
    // ミュート解除後はBellに切り替わる
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('title', 'スレッド通知をミュート')
    })
  })

  it('エラー時は状態が変わらない', async () => {
    mockMuteThread.mockResolvedValue({ error: 'エラー' })
    const user = userEvent.setup()
    render(<ThreadMuteButton rootCommentId="c1" initialMuted={false} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockMuteThread).toHaveBeenCalledWith('c1')
    })
    // エラー時はBellのまま
    expect(screen.getByRole('button')).toHaveAttribute('title', 'スレッド通知をミュート')
  })

  // ============================================================
  // アクセシビリティ
  // ============================================================

  describe('アクセシビリティ', () => {
    it('ミュート前のボタンにaria-label="スレッド通知をミュート"があること', () => {
      render(<ThreadMuteButton rootCommentId="c1" initialMuted={false} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', 'スレッド通知をミュート')
    })

    it('ミュート後のボタンにaria-label="スレッド通知をオンにする"があること', () => {
      render(<ThreadMuteButton rootCommentId="c1" initialMuted={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-label', 'スレッド通知をオンにする')
    })
  })
})
