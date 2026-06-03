import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationPreferences } from '@/components/settings/NotificationPreferences'

const mockUpdateNotificationPreferences = vi.fn()

vi.mock('@/lib/actions/notification-preferences', () => ({
  updateNotificationPreferences: (...args: unknown[]) => mockUpdateNotificationPreferences(...args),
}))

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateNotificationPreferences.mockResolvedValue({ success: true })
  })

  it('全ての通知タイプが表示される', () => {
    render(<NotificationPreferences initialPreferences={{}} />)

    expect(screen.getByText('いいね')).toBeInTheDocument()
    expect(screen.getByText('コメント')).toBeInTheDocument()
    expect(screen.getByText('返信')).toBeInTheDocument()
    expect(screen.getByText('コメントいいね')).toBeInTheDocument()
    expect(screen.getByText('フォロー')).toBeInTheDocument()
    expect(screen.getByText('引用投稿')).toBeInTheDocument()
    expect(screen.getByText('フォローリクエスト')).toBeInTheDocument()
    expect(screen.getByText('フォロー承認')).toBeInTheDocument()
    expect(screen.getByText('メンション')).toBeInTheDocument()
    expect(screen.getByText('ダイレクトメッセージ')).toBeInTheDocument()
    expect(screen.getByText('リポスト')).toBeInTheDocument()
  })

  it('初期設定が反映される', () => {
    render(<NotificationPreferences initialPreferences={{ like: false }} />)

    const switches = screen.getAllByRole('switch')
    // like is the first one, should be unchecked
    expect(switches[0]).toHaveAttribute('aria-checked', 'false')
    // comment (second) should default to true
    expect(switches[1]).toHaveAttribute('aria-checked', 'true')
  })

  it('トグルをクリックすると設定が更新される', async () => {
    const user = userEvent.setup()
    render(<NotificationPreferences initialPreferences={{}} />)

    const switches = screen.getAllByRole('switch')
    await user.click(switches[0]) // toggle like off

    expect(mockUpdateNotificationPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ like: false })
    )
  })

  it('エラー時にメッセージが表示される', async () => {
    mockUpdateNotificationPreferences.mockResolvedValueOnce({ error: '更新に失敗しました' })
    const user = userEvent.setup()
    render(<NotificationPreferences initialPreferences={{}} />)

    const switches = screen.getAllByRole('switch')
    await user.click(switches[0])

    expect(await screen.findByText('更新に失敗しました')).toBeInTheDocument()
  })
})
