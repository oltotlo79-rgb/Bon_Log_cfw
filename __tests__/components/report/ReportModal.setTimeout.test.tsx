/**
 * ReportModal - setTimeout callback coverage (lines 257-258)
 *
 * Tests the onClose() and onSuccess?.() calls inside the
 * setTimeout callback that fires 2 seconds after a successful report.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ReportModal } from '@/components/report/ReportModal'

const mockCreateReport = vi.fn()
vi.mock('@/lib/actions/report', () => ({
  createReport: (...args: unknown[]) => mockCreateReport(...args),
}))

vi.mock('react-dom', async () => ({
  ...(await vi.importActual('react-dom')),
  createPortal: (node: React.ReactNode) => node,
}))

describe('ReportModal - setTimeout callback coverage', () => {
  const onClose = vi.fn()
  const onSuccess = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('成功後2秒でonCloseとonSuccessが呼ばれる', async () => {
    mockCreateReport.mockResolvedValue({ success: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <ReportModal
        targetType="post"
        targetId="post-123"
        onClose={onClose}
        onSuccess={onSuccess}
      />
    )

    await user.click(screen.getByText('スパム'))
    await user.click(screen.getByRole('button', { name: '通報する' }))

    await waitFor(() => {
      expect(screen.getByText('通報を受け付けました')).toBeInTheDocument()
    })

    // Before 2 seconds, callbacks should not have been called
    expect(onClose).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()

    // Advance past the 2-second setTimeout
    vi.advanceTimersByTime(2000)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('onSuccessが未指定でも成功後2秒でonCloseだけ呼ばれる', async () => {
    mockCreateReport.mockResolvedValue({ success: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <ReportModal
        targetType="comment"
        targetId="comment-456"
        onClose={onClose}
      />
    )

    await user.click(screen.getByText('誹謗中傷'))
    await user.click(screen.getByRole('button', { name: '通報する' }))

    await waitFor(() => {
      expect(screen.getByText('通報を受け付けました')).toBeInTheDocument()
    })

    vi.advanceTimersByTime(2000)

    expect(onClose).toHaveBeenCalledTimes(1)
    // onSuccess was not provided, so no error should occur
  })

  it('エラーレスポンスでsuccess:falseかつerrorプロパティなしの場合フォールバックエラーを表示', async () => {
    mockCreateReport.mockResolvedValue({ success: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <ReportModal
        targetType="post"
        targetId="post-789"
        onClose={onClose}
      />
    )

    await user.click(screen.getByText('著作権侵害'))
    await user.click(screen.getByRole('button', { name: '通報する' }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })

    // onClose should not be called on error
    vi.advanceTimersByTime(2000)
    expect(onClose).not.toHaveBeenCalled()
  })
})
