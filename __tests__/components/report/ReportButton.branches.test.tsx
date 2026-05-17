/**
 * ReportButton - additional branch coverage tests
 *
 * Targets:
 * - onSuccess callback passed through to ReportModal
 * - text variant with className
 * - menu variant without className (default empty string)
 */

import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ReportButton } from '@/components/report/ReportButton'

vi.mock('@/components/report/ReportModal', () => ({
  ReportModal: ({ onSuccess, onClose }: { onSuccess?: () => void; onClose: () => void }) => (
    <div data-testid="report-modal">
      <button onClick={() => onSuccess?.()}>成功コールバック</button>
      <button onClick={onClose}>閉じる</button>
    </div>
  ),
}))

describe('ReportButton - branch coverage', () => {
  it('onSuccessコールバックがReportModalに渡される', async () => {
    const onSuccess = vi.fn()
    const user = userEvent.setup()
    render(
      <ReportButton targetType="post" targetId="post-123" onSuccess={onSuccess} />
    )

    await user.click(screen.getByRole('button', { name: 'このコンテンツを通報' }))
    await user.click(screen.getByText('成功コールバック'))

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('textバリアントにclassNameが適用される', () => {
    render(
      <ReportButton targetType="post" targetId="post-123" variant="text" className="my-class" />
    )

    expect(screen.getByRole('button')).toHaveClass('my-class')
  })

  it('menuバリアントにclassNameが適用される', () => {
    render(
      <ReportButton targetType="post" targetId="post-123" variant="menu" className="menu-class" />
    )

    expect(screen.getByRole('button')).toHaveClass('menu-class')
  })

  it('classNameが未指定の場合に空文字フォールバックが使われる（icon）', () => {
    render(
      <ReportButton targetType="post" targetId="post-123" variant="icon" />
    )

    const button = screen.getByRole('button')
    // Should not crash, and should not have 'undefined' class
    expect(button.className).not.toContain('undefined')
  })

  it('classNameが未指定の場合に空文字フォールバックが使われる（text）', () => {
    render(
      <ReportButton targetType="post" targetId="post-123" variant="text" />
    )

    const button = screen.getByRole('button')
    expect(button.className).not.toContain('undefined')
  })

  it('classNameが未指定の場合に空文字フォールバックが使われる（menu）', () => {
    render(
      <ReportButton targetType="post" targetId="post-123" />
    )

    const button = screen.getByRole('button')
    expect(button.className).not.toContain('undefined')
  })
})
