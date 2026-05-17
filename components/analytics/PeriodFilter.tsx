'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const PERIODS = [
  { value: '7', label: '7日' },
  { value: '30', label: '30日' },
  { value: '90', label: '90日' },
] as const

export function PeriodFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('days') || '30'

  function handleChange(days: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('days', days)
    router.push(`/analytics?${params.toString()}`)
  }

  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1">
      {PERIODS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => handleChange(value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            current === value
              ? 'bg-background text-foreground shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
