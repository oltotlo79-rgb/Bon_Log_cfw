'use client'

import { Button } from '@/components/ui/button'
import { MAX_POLL_OPTIONS, MIN_POLL_OPTIONS, MAX_POLL_OPTION_LENGTH } from '@/lib/constants/limits'

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  )
}

const DURATION_OPTIONS = [
  { label: '1時間', value: 3600 },
  { label: '6時間', value: 21600 },
  { label: '12時間', value: 43200 },
  { label: '1日', value: 86400 },
  { label: '3日', value: 259200 },
  { label: '7日', value: 604800 },
]

type PollFormProps = {
  isActive: boolean
  onToggle: () => void
  options: string[]
  onOptionsChange: (options: string[]) => void
  duration: number
  onDurationChange: (duration: number) => void
}

export function PollForm({
  isActive,
  onToggle,
  options,
  onOptionsChange,
  duration,
  onDurationChange,
}: PollFormProps) {
  if (!isActive) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onToggle}
        aria-label="アンケートを追加"
      >
        <BarChartIcon className="w-5 h-5" />
      </Button>
    )
  }

  function updateOption(index: number, value: string) {
    const newOptions = [...options]
    newOptions[index] = value
    onOptionsChange(newOptions)
  }

  function addOption() {
    if (options.length < MAX_POLL_OPTIONS) {
      onOptionsChange([...options, ''])
    }
  }

  function removeOption(index: number) {
    if (options.length > MIN_POLL_OPTIONS) {
      onOptionsChange(options.filter((_, i) => i !== index))
    }
  }

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">アンケート</span>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 hover:bg-muted rounded"
          aria-label="アンケートを閉じる"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`選択肢 ${i + 1}`}
              maxLength={MAX_POLL_OPTION_LENGTH}
              className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {options.length > MIN_POLL_OPTIONS && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="p-1 text-muted-foreground hover:text-destructive"
                aria-label="選択肢を削除"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {options.length < MAX_POLL_OPTIONS && (
        <button
          type="button"
          onClick={addOption}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          選択肢を追加
        </button>
      )}

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">投票期間:</label>
        <select
          value={duration}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          className="text-sm border rounded-md px-2 py-1 bg-background"
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
