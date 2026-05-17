/**
 * 星評価コンポーネント
 *
 * @module components/shop/StarRating
 */

'use client'

/**
 * React Hooks
 * useState: ホバー時の評価値を管理
 */
import { useState } from 'react'

/**
 * StarRatingコンポーネントのプロパティ定義
 */
interface StarRatingProps {
  /** 評価値（0〜5の数値） */
  rating: number
  /** 星のサイズ（sm: 小、md: 中、lg: 大） */
  size?: 'sm' | 'md' | 'lg'
  /** インタラクティブモード（クリック・ホバー可能かどうか） */
  interactive?: boolean
  /** 値が変更された時のコールバック関数（interactiveモード時に使用） */
  onChange?: (rating: number) => void
}

/**
 * 星アイコンコンポーネント
 *
 * 塗りつぶし/空の星を表示するSVGアイコン。
 *
 * @param filled - trueの場合は塗りつぶし、falseの場合は空
 * @param className - 追加のCSSクラス名
 */
function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      // filledがtrueの場合は塗りつぶし、falseの場合は枠線のみ
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

/**
 * 汎用星評価コンポーネント
 *
 * 表示専用と入力可能の両方に対応した星評価コンポーネント。
 * interactiveプロパティでモードを切り替える。
 *
 * ## 入力モードの動作
 * - クリック: 評価を確定
 * - ホバー: プレビュー表示（マウスを離すと元に戻る）
 *
 * @param rating - 評価値
 * @param size - 星のサイズ
 * @param interactive - インタラクティブモードのフラグ
 * @param onChange - 値変更時のコールバック
 */
export function StarRating({ rating, size = 'md', interactive = false, onChange }: StarRatingProps) {

  /**
   * ホバー時の評価値
   * 0の場合はホバーしていない状態
   */
  const [hoverRating, setHoverRating] = useState(0)

  /**
   * サイズごとのCSSクラスマッピング
   */
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  /**
   * 表示する評価値
   * ホバー中の場合はホバー評価値を使用
   */
  const displayRating = hoverRating || rating

  /**
   * 塗りつぶす星の数（整数部分）
   */
  const fullStars = Math.floor(displayRating)

  /**
   * 半星（0.5星）を表示するかどうか
   * 小数部分が0.5以上の場合にtrueになる
   */
  const hasHalfStar = displayRating % 1 >= 0.5

  /**
   * 星をクリックした時のハンドラ
   *
   * インタラクティブモードかつonChangeが定義されている場合に、
   * クリックされた星の位置（1〜5）で評価を確定する。
   *
   * @param index - クリックされた星の位置（1から始まる）
   */
  const handleClick = (index: number) => {
    if (interactive && onChange) {
      onChange(index)
    }
  }

  /**
   * 星にマウスカーソルが入った時のハンドラ
   *
   * インタラクティブモードの場合、ホバー評価値を設定してプレビュー表示する。
   *
   * @param index - ホバーしている星の位置（1から始まる）
   */
  const handleMouseEnter = (index: number) => {
    if (interactive) {
      setHoverRating(index)
    }
  }

  /**
   * 星からマウスカーソルが離れた時のハンドラ
   *
   * インタラクティブモードの場合、ホバー評価値をリセットして元の評価に戻す。
   */
  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(0)
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      {/* 5つの星を並べて表示 */}
      {[1, 2, 3, 4, 5].map((index) => {
        /**
         * この星を塗りつぶすかどうか
         * - fullStars以下の場合: 塗りつぶし
         * - fullStars+1で半星フラグがtrueの場合: 塗りつぶし
         */
        const isFilled = index <= fullStars || (index === fullStars + 1 && hasHalfStar)

        return (
          <button
            key={index}
            type="button"
            disabled={!interactive}
            onClick={() => handleClick(index)}
            onMouseEnter={() => handleMouseEnter(index)}
            onMouseLeave={handleMouseLeave}
            aria-label={`${index}つ星`}
            // インタラクティブモードではホバー時に拡大
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform disabled:cursor-default`}
          >
            <StarIcon
              filled={isFilled}
              className={`${sizeClasses[size]} ${isFilled ? 'text-amber-500' : 'text-muted'}`}
            />
          </button>
        )
      })}
    </div>
  )
}

/**
 * 入力用の星評価コンポーネント
 *
 * StarRatingコンポーネントをインタラクティブモードで使用するラッパー。
 * レビュー投稿フォームなどで使用される。
 *
 * @param value - 現在の評価値
 * @param onChange - 評価変更時のコールバック
 * @param size - 星のサイズ
 */
export function StarRatingInput({ value, onChange, size = 'md' }: {
  value: number
  onChange: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
}) {
  return <StarRating rating={value} onChange={onChange} size={size} interactive />
}

/**
 * 表示専用の星評価コンポーネント（半星対応）
 *
 * 読み取り専用で星評価を表示する。
 * 半星（0.5単位）にも対応しており、平均評価の表示に使用される。
 *
 * @param rating - 評価値（0〜5の小数）
 * @param size - 星のサイズ
 * @param showValue - 評価値を数値でも表示するかどうか
 */
export function StarRatingDisplay({ rating, size = 'md', showValue = false }: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean
}) {

  /**
   * サイズごとのCSSクラスマッピング
   */
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }

  /**
   * 塗りつぶす星の数（整数部分）
   */
  const fullStars = Math.floor(rating)

  /**
   * 半星を表示するかどうか
   * 小数部分が0.5以上の場合にtrueになる
   */
  const hasHalfStar = rating % 1 >= 0.5

  return (
    <div className="flex items-center gap-1">
      {/* 星の並び */}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((index) => {
          if (index <= fullStars) {
            // 塗りつぶし星
            return (
              <StarIcon key={index} filled className={`${sizeClasses[size]} text-amber-500`} />
            )
          } else if (index === fullStars + 1 && hasHalfStar) {
            // 半星: CSSのoverflowで左半分のみ表示
            return (
              <div key={index} className="relative">
                {/* 背景: 空の星 */}
                <StarIcon filled={false} className={`${sizeClasses[size]} text-muted`} />
                {/* 前景: 左半分だけ表示された塗りつぶし星 */}
                <div className="absolute inset-0 overflow-hidden w-1/2">
                  <StarIcon filled className={`${sizeClasses[size]} text-amber-500`} />
                </div>
              </div>
            )
          } else {
            // 空の星
            return (
              <StarIcon key={index} filled={false} className={`${sizeClasses[size]} text-muted`} />
            )
          }
        })}
      </div>

      {/* 評価値を数値で表示（オプション） */}
      {showValue && (
        <span className="text-sm text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}
