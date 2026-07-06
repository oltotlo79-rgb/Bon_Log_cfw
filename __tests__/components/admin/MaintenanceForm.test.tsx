import { vi } from 'vitest'
/**
 * MaintenanceForm コンポーネントのテスト
 */

import { render, screen, waitFor, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { MaintenanceForm } from '@/app/admin/maintenance/MaintenanceForm'

// モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh, push: vi.fn(), back: vi.fn() }),
}))

vi.mock('@/lib/actions/maintenance', () => ({
  updateMaintenanceSettings: vi.fn().mockResolvedValue({ success: true }),
}))

import { updateMaintenanceSettings } from '@/lib/actions/maintenance'

const mockUpdate = updateMaintenanceSettings as ReturnType<typeof vi.fn>

const defaultSettings = {
  enabled: false,
  startTime: null,
  endTime: null,
  message: 'メンテナンス中です。しばらくお待ちください。',
}

const enabledSettings = {
  enabled: true,
  startTime: '2024-06-01T10:00:00.000Z',
  endTime: '2024-06-01T18:00:00.000Z',
  message: 'システムメンテナンス中です',
}

describe('MaintenanceForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('初期設定でフォームを表示する', () => {
    render(<MaintenanceForm settings={defaultSettings} />)
    expect(screen.getByText('メンテナンス開始')).toBeInTheDocument()
    expect(screen.getByText('通常運用に戻す')).toBeInTheDocument()
  })

  it('無効状態が正しく表示される', () => {
    render(<MaintenanceForm settings={defaultSettings} />)
    expect(screen.getByText('設定を保存')).toBeInTheDocument()
  })

  it('有効状態が正しく表示される', () => {
    render(<MaintenanceForm settings={enabledSettings} />)
    expect(screen.getByText('メンテナンス開始')).toBeInTheDocument()
  })

  it('開始日時の入力が表示される', () => {
    render(<MaintenanceForm settings={defaultSettings} />)
    expect(screen.getByText('開始日時')).toBeInTheDocument()
  })

  it('終了日時の入力が表示される', () => {
    render(<MaintenanceForm settings={defaultSettings} />)
    expect(screen.getByText('終了予定日時')).toBeInTheDocument()
  })

  it('メッセージテキストエリアに初期値が表示される', () => {
    render(<MaintenanceForm settings={defaultSettings} />)
    const textarea = screen.getByDisplayValue('メンテナンス中です。しばらくお待ちください。')
    expect(textarea).toBeInTheDocument()
  })

  it('メッセージを編集できる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)
    const textarea = screen.getByDisplayValue('メンテナンス中です。しばらくお待ちください。')
    await user.clear(textarea)
    await user.type(textarea, '新しいメッセージ')
    expect(screen.getByDisplayValue('新しいメッセージ')).toBeInTheDocument()
  })

  it('メンテナンス開始ボタンをクリックするとenabledがtrueになる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)
    await user.click(screen.getByText('メンテナンス開始'))
    // メンテナンス開始ボタンにbg-red-600クラスが適用される
    const btn = screen.getByText('メンテナンス開始')
    expect(btn.className).toContain('bg-destructive')
  })

  it('通常運用に戻すボタンをクリックするとenabledがfalseになる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={enabledSettings} />)
    await user.click(screen.getByText('通常運用に戻す'))
    const btn = screen.getByText('通常運用に戻す')
    expect(btn.className).toContain('bg-foreground')
  })

  it('フォーム送信でサーバーアクションが呼ばれる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  it('成功時に成功メッセージが表示される', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(screen.getByText('設定を保存しました')).toBeInTheDocument()
    })
  })

  it('成功時にrouter.refreshが呼ばれる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('成功メッセージは3秒後に自動で消える', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(screen.getByText('設定を保存しました')).toBeInTheDocument()
    })

    vi.advanceTimersByTime(3000)

    await waitFor(() => {
      expect(screen.queryByText('設定を保存しました')).not.toBeInTheDocument()
    })
  })

  it('エラー時にエラーメッセージが表示される', async () => {
    mockUpdate.mockResolvedValueOnce({ success: false, error: '更新に失敗しました' } as { success: boolean; error: string })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
    })
  })

  it('空のメッセージでも送信できる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={{ ...defaultSettings, message: '' }} />)
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  it('開始日時を変更するとinputの表示値が更新される', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)
    const input = screen.getByText('開始日時').parentElement!.querySelector('input')!
    fireEvent.change(input, { target: { value: '2024-08-01T09:00' } })
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ startTime: new Date('2024-08-01T09:00').toISOString() })
      )
    })
  })

  it('終了日時を変更するとinputの表示値が更新される', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)
    const input = screen.getByText('終了予定日時').parentElement!.querySelector('input')!
    fireEvent.change(input, { target: { value: '2024-08-02T18:30' } })
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ endTime: new Date('2024-08-02T18:30').toISOString() })
      )
    })
  })

  it('表示メッセージの見出しが存在する', () => {
    render(<MaintenanceForm settings={defaultSettings} />)
    expect(screen.getByText('表示メッセージ')).toBeInTheDocument()
  })

  it('メンテナンス期間の見出しが存在する', () => {
    render(<MaintenanceForm settings={defaultSettings} />)
    expect(screen.getByText(/メンテナンス期間/)).toBeInTheDocument()
  })

  it('エラー後にフォームの値が保持される', async () => {
    mockUpdate.mockResolvedValueOnce({ success: false, error: 'エラー' } as { success: boolean; error: string })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<MaintenanceForm settings={defaultSettings} />)

    const textarea = screen.getByDisplayValue('メンテナンス中です。しばらくお待ちください。')
    await user.clear(textarea)
    await user.type(textarea, '編集後メッセージ')
    await user.click(screen.getByText('設定を保存'))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
    expect(screen.getByDisplayValue('編集後メッセージ')).toBeInTheDocument()
  })
})
