/**
 * @file LoadingScreen.tsx
 * @description ローディング画面コンポーネント集
 *
 * このファイルには、アプリケーション全体で使用するローディング表示用の
 * コンポーネント群が含まれています。フルスクリーン表示からインライン表示まで、
 * さまざまなユースケースに対応しています。
 *
 * @features
 * - フルスクリーンローディング（ページ遷移時など）
 * - カスタムメッセージ表示
 * - サイズバリエーション（sm, md, lg）
 * - アニメーション付きロゴ表示
 * - シンプルなスピナーコンポーネント
 * - ページローディング用スケルトン
 *
 * @usage
 * ```tsx
 * // フルスクリーンローディング
 * <LoadingScreen />
 *
 * // メッセージ付き
 * <LoadingScreen message="データを読み込んでいます..." />
 *
 * // コンテナ内で使用
 * <LoadingScreen fullScreen={false} size="sm" />
 *
 * // シンプルなスピナー
 * <LoadingSpinner />
 * ```
 */

/**
 * Image - Next.jsの最適化画像コンポーネント
 * ロゴ画像の表示に使用（自動最適化、遅延読み込み対応）
 */
import Image from 'next/image'

/**
 * LoadingScreenコンポーネントのプロパティ定義
 */
interface LoadingScreenProps {
  /**
   * ローディングメッセージ
   * 表示する追加のテキスト（例: "データを読み込んでいます..."）
   * @optional
   */
  message?: string

  /**
   * フルスクリーン表示かどうか
   * true: 画面全体を覆うオーバーレイ表示
   * false: コンテナ内でのインライン表示
   * @default true
   */
  fullScreen?: boolean

  /**
   * ロゴとテキストのサイズ
   * - 'sm': 小サイズ（コンポーネント内）
   * - 'md': 中サイズ（標準）
   * - 'lg': 大サイズ（スプラッシュ画面）
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * サイズ別の設定値
 * 各サイズに対応するロゴの大きさとテキストサイズを定義
 */
const sizeConfig = {
  /** 小サイズ: コンポーネント内や部分的なローディング向け */
  sm: { logo: 80, text: 'text-xs' },
  /** 中サイズ: 標準的なローディング表示 */
  md: { logo: 120, text: 'text-sm' },
  /** 大サイズ: スプラッシュ画面や重要な読み込み時 */
  lg: { logo: 160, text: 'text-base' },
}

/**
 * ローディング画面コンポーネント
 *
 * アプリケーションのブランドロゴとアニメーションを使用した
 * ローディング表示。フルスクリーンまたはインラインで使用可能。
 *
 * @param props - コンポーネントプロパティ
 * @returns ローディング画面のReact要素
 *
 * @example
 * ```tsx
 * // フルスクリーンローディング
 * <LoadingScreen />
 *
 * // メッセージ付き
 * <LoadingScreen message="データを読み込んでいます..." />
 *
 * // コンテナ内で使用
 * <LoadingScreen fullScreen={false} size="sm" />
 * ```
 */
export function LoadingScreen({
  message,
  fullScreen = true,
  size = 'md',
}: LoadingScreenProps) {
  // サイズに対応する設定を取得
  const config = sizeConfig[size]

  /**
   * ローディングコンテンツ本体
   * ロゴ、アニメーション、ドットインジケーター、メッセージを含む
   */
  const content = (
    <div className="flex flex-col items-center justify-center gap-6" aria-live="polite" role="status">
      <span className="sr-only">読み込み中...</span>
      {/* ロゴコンテナ - 複数のアニメーションを重ねて表示 */}
      <div className="relative">
        {/* パルスリング - 外側に広がるアニメーション */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-primary/10 animate-ping" />
        </div>

        {/* パルス背景 - ロゴの後ろで脈打つ円 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full bg-primary/5 animate-pulse"
            style={{
              width: config.logo + 40,
              height: config.logo + 40,
            }}
          />
        </div>

        {/* ロゴ本体 - フェードインとバウンスアニメーション */}
        <div className="relative z-10 animate-fade-in">
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={config.logo}
            height={config.logo}
            className="animate-gentle-bounce drop-shadow-lg dark:invert"
            priority
            unoptimized
          />
        </div>
      </div>

      {/* ローディングインジケーター - 3つのドットがバウンス */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {/* 各ドットに異なる遅延を設定して波打つ効果 */}
          <span
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>

      {/* メッセージ表示（指定時のみ） */}
      {message && (
        <p className={`text-muted-foreground ${config.text} animate-pulse`}>
          {message}
        </p>
      )}
    </div>
  )

  // フルスクリーン表示の場合
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
        {content}
      </div>
    )
  }

  // インライン表示の場合
  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  )
}

/**
 * シンプルなローディングスピナーコンポーネント
 *
 * 小さなローディング表示に使用。ボタン内やインライン要素での
 * ローディング表示に適している。
 *
 * @param className - 追加のCSSクラス
 * @returns スピナーのReact要素
 *
 * @example
 * ```tsx
 * // ボタン内
 * <button disabled={loading}>
 *   {loading ? <LoadingSpinner /> : '送信'}
 * </button>
 *
 * // カスタムサイズ
 * <LoadingSpinner className="w-12 h-12" />
 * ```
 */
export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative">
        {/* 外側の薄い円（トラック） */}
        <div className="w-8 h-8 border-2 border-primary/20 rounded-full" />
        {/* 内側の回転する円（スピナー） */}
        <div className="absolute top-0 left-0 w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

/**
 * ページローディング用のスケルトンコンポーネント
 *
 * ページ遷移時のローディング表示に使用。
 * loading.tsxファイルでの使用を想定。
 *
 * @returns ページローディング表示のReact要素
 *
 * @example
 * ```tsx
 * // app/(main)/feed/loading.tsx
 * export default function Loading() {
 *   return <PageLoading />
 * }
 * ```
 */
export function PageLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      {/* インライン表示、中サイズのローディング画面 */}
      <LoadingScreen fullScreen={false} size="md" />
    </div>
  )
}
