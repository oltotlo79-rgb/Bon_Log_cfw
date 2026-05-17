/**
 * @fileoverview テキストエリアコンポーネント
 *
 * @description
 * 複数行テキスト入力用のテキストエリアコンポーネントです。
 * 標準のHTML textarea要素をベースに、プロジェクトのデザインシステムに
 * 合わせたスタイリングとアクセシビリティ機能を追加しています。
 *
 * @features
 * - コンテンツに応じた自動リサイズ（field-sizing-content）
 * - バリデーションエラー表示（aria-invalid対応）
 * - フォーカス時のリング表示
 * - ダークモード対応
 * - レスポンシブなフォントサイズ
 *
 * @example
 * // 基本的な使用例
 * <Textarea placeholder="コメントを入力..." />
 *
 * @example
 * // 最大文字数制限付き
 * <Textarea
 *   value={content}
 *   onChange={(e) => setContent(e.target.value)}
 *   maxLength={500}
 *   placeholder="投稿内容（500文字以内）"
 * />
 *
 * @example
 * // バリデーションエラー表示
 * <Textarea
 *   aria-invalid={errors.content ? "true" : "false"}
 *   className="min-h-32"
 * />
 *
 * @example
 * // React Hook Formとの連携
 * <Textarea {...register("description")} />
 */

// React本体のインポート（型定義に使用）
import * as React from "react"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

/**
 * テキストエリアコンポーネント
 *
 * 複数行のテキスト入力を受け付けるフォーム要素です。
 * 投稿内容、コメント、説明文などの長文入力に使用します。
 *
 * @param props - 標準のHTMLTextAreaElementのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.placeholder - プレースホルダーテキスト
 * @param props.value - 入力値（制御コンポーネントとして使用時）
 * @param props.onChange - 値変更時のコールバック関数
 * @param props.disabled - 無効状態にするかどうか
 * @param props.maxLength - 最大入力文字数
 * @param props.rows - 表示行数（指定しない場合は内容に応じて自動調整）
 *
 * @returns テキストエリア要素をレンダリングするReactコンポーネント
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      // スロット識別子（テスト・スタイリング用）
      data-slot="textarea"
      className={cn(
        // ボーダーとプレースホルダーの色
        "border-input placeholder:text-muted-foreground",
        // フォーカス時のスタイル（ボーダー色変更とリング表示）
        "focus-visible:border-ring focus-visible:ring-ring/50",
        // バリデーションエラー時のスタイル（赤系のリングとボーダー）
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        // ダークモード時の背景色
        "dark:bg-input/30",
        // レイアウト設定
        "flex",
        // コンテンツに応じた自動リサイズ（CSS field-sizing）
        "field-sizing-content",
        // 最小高さと幅
        "min-h-16 w-full",
        // 角丸とボーダー
        "rounded-md border",
        // 背景色を透明に（ダークモード時は上書き）
        "bg-transparent",
        // パディング
        "px-3 py-2",
        // フォントサイズ（モバイル: 16px、デスクトップ: 14px）
        // モバイルで16px未満だとiOSでズームが発生するため
        "text-base md:text-sm",
        // シャドウとトランジション
        "transition-[color,box-shadow] brush-input",
        // アウトラインを非表示（フォーカスリングで代替）
        "outline-none",
        // フォーカス時のリング
        "focus-visible:ring-[3px]",
        // 無効状態のスタイル
        "disabled:cursor-not-allowed disabled:opacity-50",
        // カスタムクラスで上書き可能
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
