/**
 * プロフィールヘッダー用ヘルパー関数
 * @module components/user/profile-utils
 */

/**
 * 生年月日をフォーマットする
 *
 * @param birthDate - 生年月日（nullの場合はnullを返す）
 * @returns フォーマットされた生年月日文字列（例: "1990年5月15日"）
 */
export function formatBirthDate(birthDate: Date | string | null): string | null {
  if (!birthDate) return null

  const birth = new Date(birthDate)
  const year = birth.getFullYear()
  const month = birth.getMonth() + 1
  const day = birth.getDate()

  return `${year}年${month}月${day}日`
}

/**
 * 盆栽歴を計算する
 *
 * 盆栽を始めた年月から現在までの期間を計算し、
 * 「X年Yヶ月」形式の文字列として返す。
 *
 * ## 戻り値の例
 * - 1年未満: 「6ヶ月」
 * - 開始直後: 「1ヶ月未満」
 * - 1年以上: 「3年2ヶ月」
 * - ぴったり年数: 「5年」
 *
 * @param startYear - 盆栽を始めた年（nullの場合はnullを返す）
 * @param startMonth - 盆栽を始めた月（nullの場合は1月として計算）
 * @returns 盆栽歴の文字列（開始年がnullの場合はnull）
 */
export function calculateBonsaiExperience(startYear: number | null, startMonth: number | null): string | null {
  if (!startYear) return null

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const startMonthNum = startMonth || 1

  let years = currentYear - startYear
  let months = currentMonth - startMonthNum

  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years < 0) return null

  if (years === 0) {
    if (months === 0) return '1ヶ月未満'
    return `${months}ヶ月`
  }
  if (months === 0) return `${years}年`
  return `${years}年${months}ヶ月`
}
