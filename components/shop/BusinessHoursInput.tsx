/**
 * @module components/shop/BusinessHoursInput
 */

'use client'

import { useState } from 'react'
import { AnalogClockPicker } from '@/components/ui/AnalogClockPicker'

interface BusinessHoursInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function BusinessHoursInput({
  value,
  onChange,
  disabled = false,
}: BusinessHoursInputProps) {

  const parseBusinessHours = (str: string): { open: string; close: string } => {
    // 区切り文字は 〜 ~ - － のいずれにも対応
    const match = str.match(/(\d{1,2}:\d{2})\s*[〜~\-－]\s*(\d{1,2}:\d{2})/)
    if (match?.[1] && match[2]) {
      return {
        open: match[1].padStart(5, '0'),
        close: match[2].padStart(5, '0'),
      }
    }
    return { open: '09:00', close: '17:00' }
  }

  const { open, close } = parseBusinessHours(value)

  const [openTime, setOpenTime] = useState(open)
  const [closeTime, setCloseTime] = useState(close)
  const [useCustom, setUseCustom] = useState(false)
  const [customText, setCustomText] = useState(value)

  const handleOpenChange = (newOpen: string) => {
    setOpenTime(newOpen)
    onChange(`${newOpen}〜${closeTime}`)
  }

  const handleCloseChange = (newClose: string) => {
    setCloseTime(newClose)
    onChange(`${openTime}〜${newClose}`)
  }

  const handleCustomChange = (text: string) => {
    setCustomText(text)
    onChange(text)
  }

  const toggleMode = () => {
    if (useCustom) {
      onChange(`${openTime}〜${closeTime}`)
    } else {
      setCustomText(value || `${openTime}〜${closeTime}`)
    }
    setUseCustom(!useCustom)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">営業時間</label>
        <button
          type="button"
          onClick={toggleMode}
          disabled={disabled}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          {useCustom ? '時計で入力' : 'テキストで入力'}
        </button>
      </div>

      {useCustom ? (
        <input
          type="text"
          value={customText}
          onChange={(e) => handleCustomChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          placeholder="例: 9:00〜17:00（季節により変動）"
        />
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <AnalogClockPicker
              value={openTime}
              onChange={handleOpenChange}
              label="開店"
              disabled={disabled}
            />
          </div>

          <span className="text-lg text-muted-foreground mt-6">〜</span>

          <div className="flex-1">
            <AnalogClockPicker
              value={closeTime}
              onChange={handleCloseChange}
              label="閉店"
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {!useCustom && (
        <p className="text-sm text-muted-foreground">
          設定: {openTime}〜{closeTime}
        </p>
      )}

      {!useCustom && !disabled && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">よく使う時間:</span>
          {[
            { label: '9:00〜17:00', open: '09:00', close: '17:00' },
            { label: '10:00〜18:00', open: '10:00', close: '18:00' },
            { label: '9:00〜16:00', open: '09:00', close: '16:00' },
            { label: '8:00〜17:00', open: '08:00', close: '17:00' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setOpenTime(preset.open)
                setCloseTime(preset.close)
                onChange(`${preset.open}〜${preset.close}`)
              }}
              className="px-2 py-1 text-xs rounded border hover:bg-muted transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
