/**
 * アラートコンポーネント群 (Alert)
 *
 * ユーザーに重要な情報やフィードバックを表示するためのコンポーネント。
 * 成功メッセージ、エラーメッセージ、警告、情報通知などに使用します。
 * ダイアログとは異なり、ページ内にインラインで表示されます。
 *
 * @example 基本的な使い方（デフォルト）
 * ```tsx
 * <Alert>
 *   <AlertTitle>お知らせ</AlertTitle>
 *   <AlertDescription>
 *     新しい機能が追加されました。
 *   </AlertDescription>
 * </Alert>
 * ```
 *
 * @example エラー表示（destructive）
 * ```tsx
 * <Alert variant="destructive">
 *   <AlertCircle className="h-4 w-4" />
 *   <AlertTitle>エラー</AlertTitle>
 *   <AlertDescription>
 *     投稿の削除に失敗しました。もう一度お試しください。
 *   </AlertDescription>
 * </Alert>
 * ```
 *
 * @example アイコン付き
 * ```tsx
 * <Alert>
 *   <Terminal className="h-4 w-4" />
 *   <AlertTitle>ヒント</AlertTitle>
 *   <AlertDescription>
 *     キーボードショートカット: Ctrl+Enterで投稿できます。
 *   </AlertDescription>
 * </Alert>
 * ```
 */

// ============================================================
// インポート
// ============================================================

// React本体をインポート - コンポーネント作成に必要
import * as React from "react"

// class-variance-authority (cva) - 条件付きクラス名を管理するユーティリティ
// VariantPropsは、cvaで定義したバリアントの型を取得するための型ヘルパー
import { cva, type VariantProps } from "class-variance-authority"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

// ============================================================
// アラートのスタイル定義 (cva)
// ============================================================

/**
 * alertVariants - アラートのスタイルバリエーションを定義
 *
 * cva()の第1引数: 全てのアラートに共通で適用されるベーススタイル
 * cva()の第2引数: バリアント（variant）ごとの追加スタイル
 */
const alertVariants = cva(
  // ============================================================
  // ベーススタイル（全アラート共通）
  // ============================================================
  // relative: 相対配置（子要素の絶対配置用）
  // w-full: 幅100%
  // rounded-lg: 大きめの角丸
  // border: ボーダー
  // px-4 py-3: 内側の余白
  // text-sm: フォントサイズ小
  // grid: グリッドレイアウト（アイコンとテキストの配置用）
  // has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr]:
  //   SVGアイコンがある場合は2カラム（アイコン幅 + 残り）
  // grid-cols-[0_1fr]: アイコンがない場合は実質1カラム
  // has-[>svg]:gap-x-3: アイコンとテキスト間のスペース
  // gap-y-0.5: タイトルと説明文の間のスペース
  // items-start: 上揃え
  // [&>svg]:size-4: アイコンサイズ16px
  // [&>svg]:translate-y-0.5: アイコンの位置微調整
  // [&>svg]:text-current: アイコン色を現在のテキスト色に
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    // ============================================================
    // バリアント定義
    // ============================================================
    variants: {
      /**
       * variant - アラートの種類
       */
      variant: {
        // default: 通常の情報表示（カードの背景色）
        default: "bg-card text-card-foreground",

        // destructive: エラーや危険な情報の表示（赤系）
        // [&>svg]:text-current: アイコンも赤色に
        // *:data-[slot=alert-description]:text-destructive/90:
        //   説明文を少し薄い赤色に
        destructive:
          "text-destructive bg-card [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
      },
    },

    // デフォルト値の設定
    defaultVariants: {
      variant: "default",
    },
  }
)

// ============================================================
// Alert（アラート本体）
// ============================================================

/**
 * Alert - アラートのルートコンポーネント
 *
 * アラート全体を囲むコンテナ。背景色、ボーダー、レイアウトを定義。
 * role="alert"でスクリーンリーダーへの適切な通知を実現。
 *
 * @param className - 追加のCSSクラス
 * @param variant - アラートの種類 ("default" | "destructive")
 * @param props - その他のdiv要素の属性
 */
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      // role="alert": アクセシビリティ対応（スクリーンリーダーが重要な情報として読み上げ）
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

// ============================================================
// AlertTitle（アラートタイトル）
// ============================================================

/**
 * AlertTitle - アラートのタイトル
 *
 * アラートの主要なタイトルを表示するコンポーネント。
 *
 * @param className - 追加のCSSクラス
 * @param props - その他のdiv要素の属性
 */
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        // col-start-2: グリッドの2列目（アイコンの右側）に配置
        // line-clamp-1: 1行で省略
        // min-h-4: 最小高さ16px
        // font-medium: 中太字
        // tracking-tight: 文字間隔を狭く
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// AlertDescription（アラート説明文）
// ============================================================

/**
 * AlertDescription - アラートの説明文
 *
 * タイトルの補足説明を表示するコンポーネント。
 * 複数の段落を含むことも可能。
 *
 * @param className - 追加のCSSクラス
 * @param props - その他のdiv要素の属性
 */
function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        // text-muted-foreground: グレーのテキスト色
        // col-start-2: グリッドの2列目に配置
        // grid justify-items-start: 内部要素を左揃え
        // gap-1: 段落間のスペース
        // text-sm: フォントサイズ小
        // [&_p]:leading-relaxed: p要素の行間をゆったりに
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// エクスポート
// ============================================================

export { Alert, AlertTitle, AlertDescription }
