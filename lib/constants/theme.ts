/**
 * @module lib/constants/theme
 *
 * ブランドの presentation theme トークン。viewport.themeColor, OG, email など
 * Tailwind class が使えない JS / JSON コンテキストで参照する。
 *
 * Tailwind class で参照する場合は globals.css `@theme inline` 側に CSS 変数を
 * 定義済み (例: bg-kinoko, dark:bg-yozora)。両者の値は乖離させないこと。
 */

/**
 * <meta name="theme-color"> 用のブランド黒色。
 * Light/Dark 両方で同じ値を使うことで、モバイル browser chrome の色を統一する。
 */
export const BRAND_THEME_COLOR = '#0a0a0a'

/**
 * 鳥の子色 (kinoko-iro)。ランディングのベース紙色。
 * `bg-kinoko` Tailwind class と同値。
 */
export const BRAND_KINOKO_HEX = '#f0ece4'

/**
 * 夜空色 (yozora)。ランディング hero の dark mode 背景。
 * `dark:bg-yozora` Tailwind class と同値。
 */
export const BRAND_YOZORA_HEX = '#1a1a2e'
