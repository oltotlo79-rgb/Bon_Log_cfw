import { describe, it, expect } from 'vitest'
import {
  STORAGE_KEY_THEME,
  STORAGE_KEY_RECENT_SEARCHES,
  STORAGE_KEY_EVENT_FILTER,
} from '@/lib/constants/storage-keys'

describe('storage-keys', () => {
  const allKeys = [
    STORAGE_KEY_THEME,
    STORAGE_KEY_RECENT_SEARCHES,
    STORAGE_KEY_EVENT_FILTER,
  ]

  it('全てのキーが空でない文字列である', () => {
    for (const key of allKeys) {
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    }
  })

  it('全てのキーがユニーク（重複なし）である', () => {
    const unique = new Set(allKeys)
    expect(unique.size).toBe(allKeys.length)
  })

  it('キーの値が変更されていない（回帰テスト）', () => {
    expect(STORAGE_KEY_THEME).toBe('theme')
    expect(STORAGE_KEY_RECENT_SEARCHES).toBe('bonsai-sns-recent-searches')
    expect(STORAGE_KEY_EVENT_FILTER).toBe('event-filter-settings')
  })
})
