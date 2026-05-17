import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

const mockDeleteEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
}))

import { DeleteEventButton } from '@/app/(main)/events/[id]/DeleteEventButton'

describe('DeleteEventButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初期状態で削除ボタンを表示する', () => {
    render(<DeleteEventButton eventId="evt-1" />)
    expect(screen.getByText('削除')).toBeInTheDocument()
  })

  it('クリックで確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton eventId="evt-1" />)

    await user.click(screen.getByText('削除'))

    expect(screen.getByText('削除しますか？')).toBeInTheDocument()
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  it('キャンセルで元の状態に戻る', async () => {
    const user = userEvent.setup()
    render(<DeleteEventButton eventId="evt-1" />)

    await user.click(screen.getByText('削除'))
    await user.click(screen.getByText('キャンセル'))

    expect(screen.queryByText('削除しますか？')).not.toBeInTheDocument()
  })

  it('削除確認で実際に削除する', async () => {
    const user = userEvent.setup()
    mockDeleteEvent.mockResolvedValueOnce({ success: true })
    render(<DeleteEventButton eventId="evt-1" />)

    await user.click(screen.getByText('削除'))
    // 確認ダイアログの「削除」ボタン
    const confirmBtn = screen.getAllByText('削除').find(el => el.tagName === 'BUTTON' && el.className.includes('bg-red'))
    await user.click(confirmBtn!)

    expect(mockDeleteEvent).toHaveBeenCalledWith('evt-1')
  })
})
