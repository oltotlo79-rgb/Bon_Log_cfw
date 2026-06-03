'use client'

/**
 * ランディング専用テーマトグル。
 *
 * - 墨絵 / 和紙テイストに揃えた sumi-e style: 黒枠 + 透明背景 + hover で黒反転
 *   (dark mode では白枠に反転)
 * - light ↔ dark の 2 値トグル (system 選択は settings 画面で行える)
 * - SSR/hydration mismatch を避けるため、client mount 後にだけアイコンを描画する。
 *   mount 前は不可視 placeholder を返してレイアウトずれを防ぐ。
 *
 * @module components/landing/LandingThemeToggle
 */

import { Sun as SunIcon, Moon as MoonIcon } from 'lucide-react'
import { useTheme } from '@/components/theme/ThemeProvider'
import { useIsClient } from '@/hooks/use-is-client'

/**
 * ボタン共通 className。LandingAuthCTA の sumi-e style に揃える:
 *   - `bg-transparent border-black text-black hover:bg-black hover:text-white`
 *   - dark mode では border/text を白系に反転して可読性を維持
 *   - 形状は size="sm" の CTA と同じ高さに揃え、正方形でボタン群に馴染ませる
 */
const TOGGLE_BUTTON_CLASS = [
  'pointer-events-auto shrink-0 inline-flex items-center justify-center',
  'h-8 w-8 sm:h-9 sm:w-9 rounded-md',
  'bg-transparent border border-black/70 text-black',
  'hover:bg-black hover:text-white',
  'dark:border-white/70 dark:text-white dark:hover:bg-white dark:hover:text-black',
  'transition-colors btn-washi',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 dark:focus-visible:ring-white/40',
].join(' ')

/** アイコン共通サイズ。レイアウトずれを防ぐため placeholder と同じ寸法。 */
const ICON_CLASS = 'w-4 h-4 sm:w-[18px] sm:h-[18px]'

export function LandingThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isClient = useIsClient()

  // resolvedTheme は SSR でも値を持つが (default 'light')、hydration mismatch を避けるため
  // mount 完了後にだけ実値で分岐する。
  const isDark = isClient && resolvedTheme === 'dark'
  const next = isDark ? 'light' : 'dark'
  const label = isDark ? 'ライトモードに切り替える' : 'ダークモードに切り替える'

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={TOGGLE_BUTTON_CLASS}
    >
      {isClient ? (
        isDark ? (
          <SunIcon className={ICON_CLASS} aria-hidden="true" />
        ) : (
          <MoonIcon className={ICON_CLASS} aria-hidden="true" />
        )
      ) : (
        // hydration 前は領域だけ確保しレイアウトずれを防ぐ。aria-hidden で読み上げから除外。
        <span className={`block ${ICON_CLASS}`} aria-hidden="true" />
      )}
    </button>
  )
}
