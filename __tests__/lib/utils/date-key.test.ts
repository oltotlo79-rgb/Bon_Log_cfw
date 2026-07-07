// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isoDateKey } from '@/lib/utils/date-key'

describe('isoDateKey', () => {
  it('UTC日付を YYYY-MM-DD 形式に変換する', () => {
    const date = new Date(Date.UTC(2025, 5, 15, 12, 30, 0))
    expect(isoDateKey(date)).toBe('2025-06-15')
  })

  it('日付が1桁の月・日でもゼロパディングされる', () => {
    const date = new Date(Date.UTC(2025, 0, 5, 0, 0, 0))
    expect(isoDateKey(date)).toBe('2025-01-05')
  })

  it('時刻部分を無視して日付のみを返す', () => {
    const date = new Date(Date.UTC(2025, 5, 15, 23, 59, 59, 999))
    expect(isoDateKey(date)).toBe('2025-06-15')
  })
})
