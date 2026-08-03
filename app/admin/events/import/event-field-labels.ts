import type { EventFieldViolation } from '@/lib/validation/event-import'

/**
 * イベントインポートの検証結果 (EventFieldViolation.field) を
 * 管理画面表示用の日本語ラベルに変換するためのマッピング。
 */
const EVENT_FIELD_LABELS: Record<string, string> = {
  title: 'タイトル',
  prefecture: '都道府県',
  city: '市区町村',
  venue: '会場',
  organizer: '主催者',
  admissionFee: '入場料',
  description: '説明',
  externalUrl: '外部URL',
  sourceRegion: '取得元地域',
  sourceUrl: '取得元URL',
  similarEventTitle: '類似イベント名',
}

/** 未知のフィールド名は英語キーのままフォールバック表示する。 */
export function getEventFieldLabel(field: string): string {
  return EVENT_FIELD_LABELS[field] ?? field
}

/** 「主催者 249/200文字」のような表示用テキストを生成する。 */
export function formatEventFieldViolation(violation: EventFieldViolation): string {
  return `${getEventFieldLabel(violation.field)} ${violation.actualLength}/${violation.maxLength}文字`
}
