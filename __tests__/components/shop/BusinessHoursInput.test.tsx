import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BusinessHoursInput } from '@/components/shop/BusinessHoursInput'

// AnalogClockPicker モック
vi.mock('@/components/ui/AnalogClockPicker', () => ({
  AnalogClockPicker: ({ value, onChange, label, disabled }: {
    value: string
    onChange: (value: string) => void
    label: string
    disabled?: boolean
  }) => (
    <div data-testid={`clock-picker-${label}`}>
      <span>{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-testid={`time-input-${label}`}
      />
    </div>
  ),
}))

describe('BusinessHoursInput', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('営業時間ラベルを表示する', () => {
    render(<BusinessHoursInput value="" onChange={mockOnChange} />)

    expect(screen.getByText('営業時間')).toBeInTheDocument()
  })

  it('時計ピッカーモードで開店・閉店を表示する', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} />)

    expect(screen.getByTestId('clock-picker-開店')).toBeInTheDocument()
    expect(screen.getByTestId('clock-picker-閉店')).toBeInTheDocument()
  })

  it('既存の値をパースして表示する', () => {
    render(<BusinessHoursInput value="10:00〜18:00" onChange={mockOnChange} />)

    expect(screen.getByTestId('time-input-開店')).toHaveValue('10:00')
    expect(screen.getByTestId('time-input-閉店')).toHaveValue('18:00')
  })

  it('開店時間を変更するとonChangeを呼び出す', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} />)

    fireEvent.change(screen.getByTestId('time-input-開店'), { target: { value: '10:00' } })

    expect(mockOnChange).toHaveBeenCalledWith('10:00〜17:00')
  })

  it('閉店時間を変更するとonChangeを呼び出す', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} />)

    fireEvent.change(screen.getByTestId('time-input-閉店'), { target: { value: '18:00' } })

    expect(mockOnChange).toHaveBeenCalledWith('09:00〜18:00')
  })

  it('設定プレビューを表示する', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} />)

    expect(screen.getByText(/設定: 09:00〜17:00/)).toBeInTheDocument()
  })

  it('よく使う時間プリセットを表示する', () => {
    render(<BusinessHoursInput value="" onChange={mockOnChange} />)

    expect(screen.getByText('よく使う時間:')).toBeInTheDocument()
    expect(screen.getByText('9:00〜17:00')).toBeInTheDocument()
    expect(screen.getByText('10:00〜18:00')).toBeInTheDocument()
    expect(screen.getByText('9:00〜16:00')).toBeInTheDocument()
    expect(screen.getByText('8:00〜17:00')).toBeInTheDocument()
  })

  it('プリセットをクリックすると時間を設定する', () => {
    render(<BusinessHoursInput value="" onChange={mockOnChange} />)

    fireEvent.click(screen.getByText('10:00〜18:00'))

    expect(mockOnChange).toHaveBeenCalledWith('10:00〜18:00')
  })

  it('テキスト入力モードに切り替える', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} />)

    fireEvent.click(screen.getByText('テキストで入力'))

    expect(screen.getByPlaceholderText(/例:/)).toBeInTheDocument()
    expect(screen.queryByTestId('clock-picker-開店')).not.toBeInTheDocument()
  })

  it('テキスト入力モードから時計モードに切り替える', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} />)

    // テキストモードに切り替え
    fireEvent.click(screen.getByText('テキストで入力'))
    expect(screen.getByText('時計で入力')).toBeInTheDocument()

    // 時計モードに戻す
    fireEvent.click(screen.getByText('時計で入力'))
    expect(screen.getByTestId('clock-picker-開店')).toBeInTheDocument()
  })

  it('テキスト入力で値を変更するとonChangeを呼び出す', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} />)

    fireEvent.click(screen.getByText('テキストで入力'))
    const input = screen.getByPlaceholderText(/例:/)
    fireEvent.change(input, { target: { value: '9:00〜18:00（季節変動）' } })

    expect(mockOnChange).toHaveBeenCalledWith('9:00〜18:00（季節変動）')
  })

  it('disabledの場合は入力を無効化する', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} disabled />)

    expect(screen.getByTestId('time-input-開店')).toBeDisabled()
    expect(screen.getByTestId('time-input-閉店')).toBeDisabled()
  })

  it('disabledの場合はモード切替ボタンを無効化する', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} disabled />)

    expect(screen.getByText('テキストで入力')).toBeDisabled()
  })

  it('disabledの場合はプリセットを表示しない', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} disabled />)

    expect(screen.queryByText('よく使う時間:')).not.toBeInTheDocument()
  })

  it('disabledの場合はモード切替ボタンをクリックしても切り替わらない', () => {
    render(<BusinessHoursInput value="09:00〜17:00" onChange={mockOnChange} disabled />)

    // disabledなボタンはクリックしても反応しない
    fireEvent.click(screen.getByText('テキストで入力'))

    // 時計モードのままになっている
    expect(screen.getByTestId('clock-picker-開店')).toBeInTheDocument()
  })

  it('空の値の場合はデフォルト値を使用する', () => {
    render(<BusinessHoursInput value="" onChange={mockOnChange} />)

    expect(screen.getByTestId('time-input-開店')).toHaveValue('09:00')
    expect(screen.getByTestId('time-input-閉店')).toHaveValue('17:00')
  })

  it('様々な区切り文字をパースする', () => {
    const testCases = [
      { input: '10:00〜18:00', expected: { open: '10:00', close: '18:00' } },
      { input: '10:00~18:00', expected: { open: '10:00', close: '18:00' } },
      { input: '10:00-18:00', expected: { open: '10:00', close: '18:00' } },
      { input: '10:00－18:00', expected: { open: '10:00', close: '18:00' } },
    ]

    testCases.forEach(({ input, expected }) => {
      const { unmount } = render(<BusinessHoursInput value={input} onChange={mockOnChange} />)

      expect(screen.getByTestId('time-input-開店')).toHaveValue(expected.open)
      expect(screen.getByTestId('time-input-閉店')).toHaveValue(expected.close)

      unmount()
    })
  })
})
