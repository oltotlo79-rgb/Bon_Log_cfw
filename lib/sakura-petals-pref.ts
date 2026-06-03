/**
 * 背景アニメーション表示の設定（localStorage）
 *
 * デフォルトは「季節自動」で月に応じたアニメーションを表示。
 * 設定画面で個別に選択した場合はその設定が優先される。
 */

/** 実際に描画されるアニメーション種別 */
export const ANIMATION_TYPES = ['sakura', 'momiji', 'snow', 'dandelion', 'rain', 'rain-drops', 'none'] as const
export type AnimationType = (typeof ANIMATION_TYPES)[number]

/** localStorage に保存される設定値（'seasonal' = 季節自動切替） */
export const ANIMATION_PREFS = [...ANIMATION_TYPES, 'seasonal'] as const
export type AnimationPref = (typeof ANIMATION_PREFS)[number]

/** 任意の文字列を `AnimationPref` に narrowing する型ガード。 */
export function isAnimationPref(value: string): value is AnimationPref {
  return (ANIMATION_PREFS as readonly string[]).includes(value)
}

export const BG_ANIMATION_STORAGE_KEY = 'bg-animation-type'

/** 旧バージョンの localStorage キー。後方互換マイグレーションのためにのみ参照する。 */
const LEGACY_ANIMATION_STORAGE_KEY = 'sakura-petals-enabled'

/** 設定変更時に発火するカスタムイベント名（同一タブで即時反映するため） */
export const BG_ANIMATION_CHANGE_EVENT = 'bg-animation-change'

export type BgAnimationChangeDetail = { type: AnimationType }

/** デフォルトは季節自動切替 */
const DEFAULT_PREF: AnimationPref = 'seasonal'

/**
 * 現在の月に応じた季節アニメーションを返す
 *
 *  3-4月: 桜    5月: 綿毛    6月: 雨
 *  7-9月: 水面  10-11月: 紅葉  12-2月: 雪
 */
export function getSeasonalAnimationType(): AnimationType {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 4) return 'sakura'
  if (month === 5) return 'dandelion'
  if (month === 6) return 'rain-drops'
  if (month >= 7 && month <= 9) return 'rain'
  if (month >= 10 && month <= 11) return 'momiji'
  return 'snow' // 12, 1, 2
}

/**
 * ユーザーの設定値（seasonal / 個別指定）を取得する
 */
export function getBgAnimationPref(): AnimationPref {
  if (typeof window === 'undefined') return DEFAULT_PREF

  // 旧キーに値が残っているユーザーは新キーへ移行してから読む（旧 true=seasonal / false=none）
  const oldStored = localStorage.getItem(LEGACY_ANIMATION_STORAGE_KEY)
  if (oldStored !== null) {
    const pref: AnimationPref = oldStored === 'true' ? 'seasonal' : 'none'
    localStorage.setItem(BG_ANIMATION_STORAGE_KEY, pref)
    localStorage.removeItem(LEGACY_ANIMATION_STORAGE_KEY)
    return pref
  }

  const stored = localStorage.getItem(BG_ANIMATION_STORAGE_KEY)
  if (stored === null) return DEFAULT_PREF
  if (isAnimationPref(stored)) return stored
  return DEFAULT_PREF
}

/**
 * 実際に描画するアニメーション種別を取得する
 * seasonal の場合は現在の月から解決する
 */
export function getBgAnimationType(): AnimationType {
  const pref = getBgAnimationPref()
  if (pref === 'seasonal') return getSeasonalAnimationType()
  return pref
}

/**
 * アニメーション設定を保存し、同一タブのコンポーネントに通知する
 */
export function setBgAnimationType(type: AnimationPref): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(BG_ANIMATION_STORAGE_KEY, type)

  const resolved: AnimationType = type === 'seasonal' ? getSeasonalAnimationType() : type
  window.dispatchEvent(
    new CustomEvent<BgAnimationChangeDetail>(BG_ANIMATION_CHANGE_EVENT, {
      detail: { type: resolved },
    })
  )
}
