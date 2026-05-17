/**
 * @module lib/constants/animation
 *
 * 背景パーティクルアニメーションのチューニング定数。
 * Why centralized: 旧実装は粒子数や揺れ量を SakuraAnimation 内に
 * 直書きしていたためマジックナンバー化していた。SSR / Edge から参照しない
 * 純粋な数値定数のため、依存方向の制約はない。
 */

import type { AnimationType } from '@/lib/sakura-petals-pref'

/** アニメーション種別ごとに同時に描画するパーティクル数。`rain` は波紋のみで粒子は使わない。 */
export const PARTICLE_COUNT_BY_TYPE: Readonly<Record<AnimationType, number>> = {
  none: 0,
  rain: 0,
  'rain-drops': 90,
  sakura: 35,
  snow: 80,
  dandelion: 30,
  momiji: 45,
}

/** PARTICLE_COUNT_BY_TYPE に該当しないケース用のフォールバック (TS narrow 用)。 */
export const PARTICLE_COUNT_FALLBACK = 45

/** 波紋 (`rain`) 同時表示数の上限。多いと CPU 負荷が増えるため抑制。 */
export const RIPPLE_MAX_CONCURRENT = 30

/** 1 frame に新しい波紋を発生させる確率。0–1 の範囲。 */
export const RIPPLE_SPAWN_PROBABILITY = 0.15

/** 波紋の最大半径 (px) 範囲: BASE 〜 BASE + JITTER。 */
export const RIPPLE_MAX_RADIUS_BASE = 120
export const RIPPLE_MAX_RADIUS_JITTER = 100

/** 波紋の初速 (px/frame) 範囲。 */
export const RIPPLE_SPEED_BASE = 0.5
export const RIPPLE_SPEED_JITTER = 0.8

/** 波紋の進行度が増すほど速度が落ちる際の下限係数。 */
export const RIPPLE_SPEED_MIN_RATIO = 0.08

/** 波紋の進行度から速度減衰を計算する指数。 */
export const RIPPLE_DECELERATION_EXP = 1.5

/** 波紋の alpha 減衰量の下限 (1 frame あたり)。半径経由の減衰が遅すぎても確実に消える。 */
export const RIPPLE_ALPHA_MIN_DECAY = 0.003

/** リング (波紋の輪) を 2 本にする確率。残りは 3 本。 */
export const RIPPLE_TWO_RINGS_PROBABILITY = 0.5

/** アニメーション種別ごとの左右揺れ振幅倍率。値が大きいほど横に揺れる。 */
export const SWAY_MULTIPLIER_BY_TYPE: Readonly<Record<AnimationType, number>> = {
  none: 0,
  rain: 0,
  'rain-drops': 0,
  sakura: 1.5,
  snow: 2.0,
  dandelion: 3.0,
  momiji: 2.5,
}

/** SWAY_MULTIPLIER_BY_TYPE に該当しないケース用のフォールバック。 */
export const SWAY_MULTIPLIER_FALLBACK = 2.5

/** 雪結晶を立体的にフリップ描画するためのサイズ閾値。これ以上は xFlip/yFlip 両軸を適用。 */
export const SNOW_FLAKE_3D_FLIP_MIN_SIZE = 6
