/**
 * @module lib/constants/contact-categories
 * お問い合わせカテゴリの単一の真実。フォーム選択肢・Zod 検証・確認メールの文面ラベルを
 * ここから導出し、3 箇所で value / label がズレるのを防ぐ。
 */

export const CONTACT_CATEGORIES = [
  { value: 'general', label: '一般的なお問い合わせ' },
  { value: 'account', label: 'アカウントについて' },
  { value: 'bug', label: '不具合の報告' },
  { value: 'feature', label: '機能のリクエスト' },
  { value: 'premium', label: 'プレミアム会員について' },
  { value: 'report', label: '不適切なコンテンツの報告' },
  { value: 'other', label: 'その他' },
] as const

export type ContactCategoryValue = (typeof CONTACT_CATEGORIES)[number]['value']

export const CONTACT_CATEGORY_VALUES: readonly ContactCategoryValue[] =
  CONTACT_CATEGORIES.map((c) => c.value)

export const CONTACT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CONTACT_CATEGORIES.map((c) => [c.value, c.label]),
)
