import { vi } from 'vitest'
/**
 * BusinessHoursSectionコンポーネントのテスト
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// BusinessHoursInputモック（AnalogClockPickerの複雑な依存を避ける）
vi.mock('@/components/shop/BusinessHoursInput', () => ({
  BusinessHoursInput: ({
    value,
    onChange,
    disabled,
  }: {
    value: string
    onChange: (v: string) => void
    disabled?: boolean
  }) => (
    <div data-testid="business-hours-input">
      <label htmlFor="business-hours">営業時間</label>
      <input
        id="business-hours"
        data-testid="business-hours-value"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="営業時間を入力"
      />
    </div>
  ),
}))

import { BusinessHoursSection } from '@/components/shop/form/BusinessHoursSection'

describe('BusinessHoursSection', () => {
  const mockOnBusinessHoursChange = vi.fn()
  const mockOnClosedDaysChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // レンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('営業時間入力コンポーネントが表示される', () => {
      render(
        <BusinessHoursSection
          businessHours="09:00〜17:00"
          closedDays="水曜日"
          onBusinessHoursChange={mockOnBusinessHoursChange}
          onClosedDaysChange={mockOnClosedDaysChange}
        />
      )

      expect(screen.getByTestId('business-hours-input')).toBeInTheDocument()
    })

    it('定休日入力フィールドが表示される', () => {
      render(
        <BusinessHoursSection
          businessHours="09:00〜17:00"
          closedDays="水曜日"
          onBusinessHoursChange={mockOnBusinessHoursChange}
          onClosedDaysChange={mockOnClosedDaysChange}
        />
      )

      expect(screen.getByLabelText('定休日')).toBeInTheDocument()
    })

    it('定休日フィールドに現在の値が表示される', () => {
      render(
        <BusinessHoursSection
          businessHours="09:00〜17:00"
          closedDays="水曜日"
          onBusinessHoursChange={mockOnBusinessHoursChange}
          onClosedDaysChange={mockOnClosedDaysChange}
        />
      )

      expect(screen.getByLabelText('定休日')).toHaveValue('水曜日')
    })

    it('営業時間コンポーネントに現在の値が渡される', () => {
      render(
        <BusinessHoursSection
          businessHours="09:00〜17:00"
          closedDays=""
          onBusinessHoursChange={mockOnBusinessHoursChange}
          onClosedDaysChange={mockOnClosedDaysChange}
        />
      )

      expect(screen.getByTestId('business-hours-value')).toHaveValue('09:00〜17:00')
    })
  })

  // ============================================================
  // インタラクション
  // ============================================================

  describe('インタラクション', () => {
    it('定休日フィールドを変更するとonClosedDaysChangeが呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <BusinessHoursSection
          businessHours="09:00〜17:00"
          closedDays=""
          onBusinessHoursChange={mockOnBusinessHoursChange}
          onClosedDaysChange={mockOnClosedDaysChange}
        />
      )

      await user.type(screen.getByLabelText('定休日'), '水曜日')

      expect(mockOnClosedDaysChange).toHaveBeenCalled()
    })

    it('営業時間を変更するとonBusinessHoursChangeが呼ばれる', async () => {
      render(
        <BusinessHoursSection
          businessHours=""
          closedDays=""
          onBusinessHoursChange={mockOnBusinessHoursChange}
          onClosedDaysChange={mockOnClosedDaysChange}
        />
      )

      const hoursInput = screen.getByTestId('business-hours-value')
      fireEvent.change(hoursInput, { target: { value: '10:00〜18:00' } })

      expect(mockOnBusinessHoursChange).toHaveBeenCalledWith('10:00〜18:00')
    })
  })

  // ============================================================
  // disabled状態
  // ============================================================

  describe('disabled状態', () => {
    it('disabled時に定休日フィールドが無効化される', () => {
      render(
        <BusinessHoursSection
          businessHours="09:00〜17:00"
          closedDays="水曜日"
          onBusinessHoursChange={mockOnBusinessHoursChange}
          onClosedDaysChange={mockOnClosedDaysChange}
          disabled
        />
      )

      expect(screen.getByLabelText('定休日')).toBeDisabled()
    })

    it('disabled時に営業時間コンポーネントが無効化される', () => {
      render(
        <BusinessHoursSection
          businessHours="09:00〜17:00"
          closedDays=""
          onBusinessHoursChange={mockOnBusinessHoursChange}
          onClosedDaysChange={mockOnClosedDaysChange}
          disabled
        />
      )

      expect(screen.getByTestId('business-hours-value')).toBeDisabled()
    })
  })

  // ============================================================
  // プレースホルダー
  // ============================================================

  describe('プレースホルダー', () => {
    it('定休日フィールドに適切なプレースホルダーが表示される', () => {
      render(
        <BusinessHoursSection
          businessHours=""
          closedDays=""
          onBusinessHoursChange={mockOnBusinessHoursChange}
          onClosedDaysChange={mockOnClosedDaysChange}
        />
      )

      expect(screen.getByPlaceholderText('例: 水曜日、年末年始')).toBeInTheDocument()
    })
  })
})
