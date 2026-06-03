/**
 * @module lib/constants/landing-animation
 * ランディングページのアニメーション (擬似動画) フレームパスとタイミング定数。
 *
 * 画像は `/public/images/generated/landing-motion/` 配下に Codex が生成した
 * 連番 WebP (例: hero-light-desktop-01.webp ... -08.webp) を配置する。
 * AnimatedInkImage が theme / viewport を判定して該当配列を再生する。
 *
 * Hero は spec 18 (root-landing-image-regeneration-18-2026-05-24.md) に基づく
 * 8 段階の盆栽 training 過程: 苗木選定 → 初期剪定/針金 → 幹曲げ → 枝配置 →
 * 幹肥大 → shari/jin 洗練 → 完成期 → 100 年完成。
 */

const BASE = '/images/generated/landing-motion'

function frameSeries(prefix: string, count: number): readonly string[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(2, '0')
    return `${BASE}/${prefix}-${n}.webp`
  })
}

export type LandingFrameSet = {
  readonly lightDesktop: readonly string[]
  readonly darkDesktop?: readonly string[]
  readonly lightMobile?: readonly string[]
  readonly darkMobile?: readonly string[]
}

export const LANDING_HERO_FRAMES: LandingFrameSet = {
  lightDesktop: frameSeries('hero-light-desktop', 8),
  darkDesktop: frameSeries('hero-dark-desktop', 8),
  lightMobile: frameSeries('hero-light-mobile', 8),
  darkMobile: frameSeries('hero-dark-mobile', 8),
}

export const LANDING_FEATURE_POST_FRAMES: LandingFrameSet = {
  lightDesktop: frameSeries('feature-post-light', 6),
  darkDesktop: frameSeries('feature-post-dark', 6),
}

export const LANDING_FEATURE_COMMUNITY_FRAMES: LandingFrameSet = {
  lightDesktop: frameSeries('feature-community-light', 4),
  darkDesktop: frameSeries('feature-community-dark', 4),
}

export const LANDING_FEATURE_MAP_FRAMES: LandingFrameSet = {
  lightDesktop: frameSeries('feature-map-light', 6),
  darkDesktop: frameSeries('feature-map-dark', 6),
}

export const LANDING_FINAL_CTA_FRAMES: LandingFrameSet = {
  lightDesktop: frameSeries('final-cta-light', 5),
  darkDesktop: frameSeries('final-cta-dark', 5),
}

// frame の再生間隔 (次のフレームが fade-in を開始するまでのms) と、
// 1 フレームの fade-in にかける時間 (crossfadeMs)。
// crossfadeMs > frameDurationMs にすることで複数 frame の fade-in が重なり、
// 連続的に墨が滲み出るような流れを作る (cumulative opacity 前提)。
//
// hero は他より長めの interval / crossfade でゆっくり "すー" と移ろうように。
// feature は loop=true + loopPauseMs=5000 で「最終フレーム到達後 5 秒余韻 → 再生 1 から再開」。
export const LANDING_ANIMATION_TIMING = {
  hero: { frameDurationMs: 1300, crossfadeMs: 1900, loop: false as const },
  feature: {
    frameDurationMs: 1000,
    crossfadeMs: 1500,
    loop: true as const,
    loopPauseMs: 5000,
  },
  finalCta: { frameDurationMs: 1100, crossfadeMs: 1500, loop: false as const },
} as const

// AnimatedInkImage の default crossfade duration (per-call で上書き可能)。
export const LANDING_FRAME_CROSSFADE_MS = 1500

// 墨が和紙に染みていくような、両端が dwell する S 字カーブ (easeInOutCubic)。
export const LANDING_FRAME_CROSSFADE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)'
