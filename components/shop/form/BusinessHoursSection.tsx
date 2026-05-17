'use client'

import { BusinessHoursInput } from '@/components/shop/BusinessHoursInput'

type BusinessHoursSectionProps = {
  businessHours: string
  closedDays: string
  onBusinessHoursChange: (v: string) => void
  onClosedDaysChange: (v: string) => void
  disabled?: boolean
}

/**
 * 営業時間・定休日入力セクション
 *
 * stateなし（純粋な表示コンポーネント）
 */
export function BusinessHoursSection({
  businessHours,
  closedDays,
  onBusinessHoursChange,
  onClosedDaysChange,
  disabled,
}: BusinessHoursSectionProps) {
  return (
    <>
      {/* 営業時間入力（アナログ時計コンポーネント使用） */}
      <BusinessHoursInput
        value={businessHours}
        onChange={onBusinessHoursChange}
        disabled={disabled}
      />

      {/* 定休日入力フィールド */}
      <div className="space-y-2">
        <label htmlFor="closedDays" className="text-sm font-medium">
          定休日
        </label>
        <input
          id="closedDays"
          type="text"
          value={closedDays}
          onChange={(e) => onClosedDaysChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: 水曜日、年末年始"
        />
      </div>
    </>
  )
}
