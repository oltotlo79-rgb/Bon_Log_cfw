/**
 * システム設定テーブル (`systemSetting`) の固定キー。
 *
 * 文字列リテラルを散逸させないため、DB 側で保持するキーをここで一元管理する。
 * 値（value）は JSON フィールドなので、呼び出し側で Zod スキーマでパースすること。
 *
 * @module lib/constants/system-settings
 */

export const SYSTEM_SETTING_KEYS = {
  /** メンテナンスモード設定（enabled / startTime / endTime / message）。 */
  MAINTENANCE_MODE: 'maintenance_mode',
} as const

export type SystemSettingKey =
  (typeof SYSTEM_SETTING_KEYS)[keyof typeof SYSTEM_SETTING_KEYS]
