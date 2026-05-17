// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
  SYSTEM_SETTING_KEYS,
  type SystemSettingKey,
} from '@/lib/constants/system-settings'

describe('SYSTEM_SETTING_KEYS', () => {
  it('MAINTENANCE_MODE キーは DB 上のキー名と正確に一致する', () => {
    expect(SYSTEM_SETTING_KEYS.MAINTENANCE_MODE).toBe('maintenance_mode')
  })

  it('キー一覧が凍結（as const）されていて実行時に拡張されない', () => {
    // as const の値は primitive literal union 型になるはず。
    // 型レベルの assignability を実行時に行うのは限界があるが、
    // 既知のキーだけが存在することを数で検証する。
    const keys = Object.keys(SYSTEM_SETTING_KEYS)
    expect(keys).toEqual(['MAINTENANCE_MODE'])
  })

  it('SystemSettingKey 型は定数値の union になっている', () => {
    // 型レベルの検証：以下の代入が通ることで literal union として機能している。
    const ok: SystemSettingKey = SYSTEM_SETTING_KEYS.MAINTENANCE_MODE
    expect(ok).toBe('maintenance_mode')
  })
})
