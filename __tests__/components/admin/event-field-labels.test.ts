import { getEventFieldLabel, formatEventFieldViolation } from '@/app/admin/events/import/event-field-labels'
import type { EventFieldViolation } from '@/lib/validation/event-import'

describe('getEventFieldLabel', () => {
  it('既知のフィールド名を日本語ラベルに変換する', () => {
    expect(getEventFieldLabel('organizer')).toBe('主催者')
    expect(getEventFieldLabel('title')).toBe('タイトル')
    expect(getEventFieldLabel('venue')).toBe('会場')
    expect(getEventFieldLabel('city')).toBe('市区町村')
    expect(getEventFieldLabel('prefecture')).toBe('都道府県')
    expect(getEventFieldLabel('admissionFee')).toBe('入場料')
    expect(getEventFieldLabel('description')).toBe('説明')
    expect(getEventFieldLabel('externalUrl')).toBe('外部URL')
    expect(getEventFieldLabel('sourceRegion')).toBe('取得元地域')
    expect(getEventFieldLabel('sourceUrl')).toBe('取得元URL')
    expect(getEventFieldLabel('similarEventTitle')).toBe('類似イベント名')
  })

  it('未知のフィールド名は英語キーのままフォールバックする', () => {
    expect(getEventFieldLabel('unknownField')).toBe('unknownField')
    expect(getEventFieldLabel('')).toBe('')
  })
})

describe('formatEventFieldViolation', () => {
  it('「フィールド名 実際/上限文字」形式の文字列を生成する', () => {
    const violation: EventFieldViolation = {
      field: 'organizer',
      kind: 'clipped',
      actualLength: 249,
      maxLength: 200,
    }
    expect(formatEventFieldViolation(violation)).toBe('主催者 249/200文字')
  })

  it('rejected な違反でも同じフォーマットを生成する', () => {
    const violation: EventFieldViolation = {
      field: 'externalUrl',
      kind: 'rejected',
      actualLength: 2001,
      maxLength: 2000,
    }
    expect(formatEventFieldViolation(violation)).toBe('外部URL 2001/2000文字')
  })

  it('未知のフィールドはキー名そのままで整形する', () => {
    const violation: EventFieldViolation = {
      field: 'weirdField',
      kind: 'clipped',
      actualLength: 10,
      maxLength: 5,
    }
    expect(formatEventFieldViolation(violation)).toBe('weirdField 10/5文字')
  })
})
