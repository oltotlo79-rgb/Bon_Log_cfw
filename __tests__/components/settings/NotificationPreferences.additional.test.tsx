import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationPreferences } from '@/components/settings/NotificationPreferences'
import { TIMEOUT_COPIED_FEEDBACK } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

const mockUpdateNotificationPreferences = vi.fn()

vi.mock('@/lib/actions/notification-preferences', () => ({
  updateNotificationPreferences: (...args: unknown[]) => mockUpdateNotificationPreferences(...args),
}))

describe('NotificationPreferences - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('TIMEOUT_COPIED_FEEDBACK 経過後にメッセージが自動的に消える', async () => {
    mockUpdateNotificationPreferences.mockResolvedValue({ success: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<NotificationPreferences initialPreferences={{}} />)

    const switches = screen.getAllByRole('switch')
    await user.click(switches[0]!)

    expect(await screen.findByText('設定を保存しました')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(TIMEOUT_COPIED_FEEDBACK)
    })

    expect(screen.queryByText('設定を保存しました')).not.toBeInTheDocument()
  })

  it('エラーに error フィールドが無い場合、フォールバックメッセージを表示する', async () => {
    mockUpdateNotificationPreferences.mockResolvedValueOnce({ success: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<NotificationPreferences initialPreferences={{}} />)

    const switches = screen.getAllByRole('switch')
    await user.click(switches[0]!)

    expect(await screen.findByText(MSG_ERROR_FALLBACK)).toBeInTheDocument()
  })
})
