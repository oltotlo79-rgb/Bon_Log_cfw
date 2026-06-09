/**
 * Admin components - branch coverage boost tests
 *
 * Targets:
 * - MaintenanceForm: error without error property (fallback message)
 * - MaintenanceForm: toLocalDateTimeString with valid ISO string
 * - MaintenanceForm: toISOString with empty string returns null
 * - MaintenanceForm: quickEnable clears startTime/endTime
 * - MaintenanceForm: isPending shows 保存中...
 * - ContactActionsDropdown: handleStatusChange with error response
 * - ContactActionsDropdown: handleDelete with confirm=true and error
 * - ContactActionsDropdown: handleDelete with confirm=false
 * - ContactActionsDropdown: outside click closes menu
 * - ContactDetailActions: handleDelete with confirm=true and success
 * - ContactDetailActions: handleDelete with confirm=false
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { MaintenanceForm } from '@/app/admin/maintenance/MaintenanceForm'
import { ContactActionsDropdown } from '@/app/admin/contact/ContactActionsDropdown'
import { ContactDetailActions } from '@/app/admin/contact/[id]/ContactDetailActions'

// Navigation mock
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, back: vi.fn() }),
}))

// Maintenance mock
const mockUpdateMaintenanceSettings = vi.fn()
vi.mock('@/lib/actions/maintenance', () => ({
  updateMaintenanceSettings: (...args: unknown[]) => mockUpdateMaintenanceSettings(...args),
}))

// Contact mocks
const mockUpdateInquiryStatus = vi.fn()
const mockDeleteInquiry = vi.fn()
vi.mock('@/lib/actions/contact', () => ({
  updateInquiryStatus: (...args: unknown[]) => mockUpdateInquiryStatus(...args),
  deleteInquiry: (...args: unknown[]) => mockDeleteInquiry(...args),
}))

// Toast mock
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

describe('MaintenanceForm - branch boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('error without error property shows fallback message', async () => {
    mockUpdateMaintenanceSettings.mockResolvedValue({ success: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <MaintenanceForm
        settings={{ enabled: false, startTime: null, endTime: null, message: 'test' }}
      />
    )

    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
    })
  })

  it('isPending shows 保存中... text', async () => {
    mockUpdateMaintenanceSettings.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(
      <MaintenanceForm
        settings={{ enabled: false, startTime: null, endTime: null, message: 'test' }}
      />
    )

    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument()
    })
  })

  it('quickEnable sets enabled=true and clears time fields', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mockUpdateMaintenanceSettings.mockResolvedValue({ success: true })

    render(
      <MaintenanceForm
        settings={{
          enabled: false,
          startTime: '2024-06-01T10:00:00.000Z',
          endTime: '2024-06-01T18:00:00.000Z',
          message: 'test',
        }}
      />
    )

    await user.click(screen.getByText('メンテナンス開始'))
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(mockUpdateMaintenanceSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          startTime: null,
          endTime: null,
        })
      )
    })
  })

  it('toLocalDateTimeString correctly formats ISO string for datetime-local', () => {
    render(
      <MaintenanceForm
        settings={{
          enabled: true,
          startTime: '2024-06-15T10:00:00.000Z',
          endTime: '2024-06-15T18:00:00.000Z',
          message: 'メンテナンス',
        }}
      />
    )

    // The datetime-local inputs should have formatted values
    const dateInputs = document.querySelectorAll('input[type="datetime-local"]')
    expect(dateInputs.length).toBe(2)
    // Both should have non-empty values
    expect((dateInputs[0] as HTMLInputElement).value).toBeTruthy()
    expect((dateInputs[1] as HTMLInputElement).value).toBeTruthy()
  })
})

describe('ContactActionsDropdown - branch boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateInquiryStatus.mockResolvedValue({ success: true })
    mockDeleteInquiry.mockResolvedValue({ success: true })
  })

  it('handleStatusChange with error response shows toast', async () => {
    mockUpdateInquiryStatus.mockResolvedValue({ error: 'ステータス更新エラー' })
    render(<ContactActionsDropdown inquiryId="inq-1" currentStatus="pending" />)

    fireEvent.click(screen.getByText('操作'))
    fireEvent.click(screen.getByText('対応中にする'))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'ステータス更新エラー',
          variant: 'destructive',
        })
      )
    })
  })

  it('handleDelete with confirm=true and success closes menu', async () => {
    mockDeleteInquiry.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ContactActionsDropdown inquiryId="inq-1" currentStatus="pending" />)

    fireEvent.click(screen.getByText('操作'))
    fireEvent.click(screen.getByText('削除'))

    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockDeleteInquiry).toHaveBeenCalledWith('inq-1')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('handleDelete with confirm=false does not delete', async () => {
    const user = userEvent.setup()
    render(<ContactActionsDropdown inquiryId="inq-1" currentStatus="pending" />)

    fireEvent.click(screen.getByText('操作'))
    fireEvent.click(screen.getByText('削除'))

    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockDeleteInquiry).not.toHaveBeenCalled()
  })

  it('handleDelete with error response shows toast', async () => {
    mockDeleteInquiry.mockResolvedValue({ error: '削除エラー' })
    const user = userEvent.setup()
    render(<ContactActionsDropdown inquiryId="inq-1" currentStatus="pending" />)

    fireEvent.click(screen.getByText('操作'))
    fireEvent.click(screen.getByText('削除'))

    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '削除エラー',
          variant: 'destructive',
        })
      )
    })
  })

  it('outside click closes the menu', async () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <ContactActionsDropdown inquiryId="inq-1" currentStatus="pending" />
      </div>
    )

    fireEvent.click(screen.getByText('操作'))
    expect(screen.getByText('対応中にする')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))

    await waitFor(() => {
      expect(screen.queryByText('対応中にする')).not.toBeInTheDocument()
    })
  })
})

describe('ContactDetailActions - branch boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateInquiryStatus.mockResolvedValue({ success: true })
    mockDeleteInquiry.mockResolvedValue({ success: true })
  })

  it('handleDelete with confirm=true and success redirects to /admin/contact', async () => {
    const user = userEvent.setup()
    render(
      <ContactDetailActions inquiryId="inq-1" currentStatus="pending" currentNote="" />
    )

    fireEvent.click(screen.getByText('削除'))

    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockDeleteInquiry).toHaveBeenCalledWith('inq-1')
      expect(mockPush).toHaveBeenCalledWith('/admin/contact')
    })
  })

  it('handleDelete with confirm=false does not delete', async () => {
    const user = userEvent.setup()
    render(
      <ContactDetailActions inquiryId="inq-1" currentStatus="pending" currentNote="" />
    )

    fireEvent.click(screen.getByText('削除'))

    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockDeleteInquiry).not.toHaveBeenCalled()
  })

  it('handleDelete with error response shows toast', async () => {
    mockDeleteInquiry.mockResolvedValue({ error: '削除エラー' })
    const user = userEvent.setup()
    render(
      <ContactDetailActions inquiryId="inq-1" currentStatus="pending" currentNote="" />
    )

    fireEvent.click(screen.getByText('削除'))

    await waitFor(() => { expect(screen.getByRole('alertdialog')).toBeInTheDocument() })
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '削除エラー',
          variant: 'destructive',
        })
      )
    })
  })

  it('handleUpdate with status change sends updated status', async () => {
    render(
      <ContactDetailActions inquiryId="inq-1" currentStatus="pending" currentNote="メモ" />
    )

    // Change status via select
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'resolved' } })
    fireEvent.click(screen.getByText('更新する'))

    await waitFor(() => {
      expect(mockUpdateInquiryStatus).toHaveBeenCalledWith('inq-1', 'resolved', 'メモ')
    })
  })
})
