/**
 * 盆栽手入れログの数値制限定数テスト。
 *
 * 値そのものよりも「用途に沿った合理的なレンジに収まっているか」を
 * 検証することで、意図しない変更（極端な値への誤修正）を検知する。
 */

import {
  CARE_LOG_CACHE_SEC,
  CARE_LOG_FUTURE_TOLERANCE_MS,
  MAX_BONSAI_CARE_NOTE_LENGTH,
  MAX_CARE_LOG_RANGE_DAYS,
  MAX_DAYS_IN_MONTH,
  MAX_DOTS_PER_CELL,
  MULTIMONTH_CELL_MIN_WIDTH_PX,
} from '@/lib/constants/limits/bonsai-care'
import { ONE_DAY_MS } from '@/lib/constants/limits/time'

describe('limits/bonsai-care', () => {
  it('MAX_BONSAI_CARE_NOTE_LENGTH は実用的な上限（100〜2000 文字）', () => {
    expect(MAX_BONSAI_CARE_NOTE_LENGTH).toBeGreaterThanOrEqual(100)
    expect(MAX_BONSAI_CARE_NOTE_LENGTH).toBeLessThanOrEqual(2000)
  })

  it('MAX_CARE_LOG_RANGE_DAYS は 12 ヶ月ビュー（最大 366 日）をカバー', () => {
    expect(MAX_CARE_LOG_RANGE_DAYS).toBeGreaterThanOrEqual(366)
  })

  it('CARE_LOG_FUTURE_TOLERANCE_MS は 1 日分（タイムゾーン差吸収）', () => {
    expect(CARE_LOG_FUTURE_TOLERANCE_MS).toBe(ONE_DAY_MS)
  })

  it('CARE_LOG_CACHE_SEC は数秒〜数分の範囲（鮮度と負荷のバランス）', () => {
    expect(CARE_LOG_CACHE_SEC).toBeGreaterThanOrEqual(10)
    expect(CARE_LOG_CACHE_SEC).toBeLessThanOrEqual(600)
  })

  it('MAX_DAYS_IN_MONTH は 31（固定）', () => {
    expect(MAX_DAYS_IN_MONTH).toBe(31)
  })

  it('MULTIMONTH_CELL_MIN_WIDTH_PX は視認可能な下限以上', () => {
    expect(MULTIMONTH_CELL_MIN_WIDTH_PX).toBeGreaterThanOrEqual(16)
  })

  it('MAX_DOTS_PER_CELL は 1〜5 の範囲', () => {
    expect(MAX_DOTS_PER_CELL).toBeGreaterThanOrEqual(1)
    expect(MAX_DOTS_PER_CELL).toBeLessThanOrEqual(5)
  })
})
