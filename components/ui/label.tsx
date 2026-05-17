/**
 * @fileoverview ラベルコンポーネント
 *
 * @description
 * フォーム要素に関連付けるアクセシブルなラベルを提供するコンポーネントです。
 * Radix UIのLabelプリミティブをベースに、プロジェクトのデザインシステムに
 * 合わせたスタイリングを適用しています。
 *
 * @features
 * - アクセシビリティ対応（スクリーンリーダー対応）
 * - 無効状態のスタイリング（peer-disabled/group-data-disabled）
 * - テキスト選択の防止（select-none）
 * - アイコンとの組み合わせに対応（gap-2）
 *
 * @example
 * // 基本的な使用例
 * <Label htmlFor="email">メールアドレス</Label>
 * <Input id="email" type="email" />
 *
 * @example
 * // アイコン付きラベル
 * <Label htmlFor="password">
 *   <LockIcon className="w-4 h-4" />
 *   パスワード
 * </Label>
 *
 * @example
 * // 無効状態のフォーム要素と連携
 * <div className="group" data-disabled={isDisabled}>
 *   <Label>無効化されたラベル</Label>
 *   <Input disabled={isDisabled} />
 * </div>
 */

"use client"

// React本体のインポート（型定義に使用）
import * as React from "react"

// Radix UIのLabelプリミティブ
// アクセシブルなラベル要素を提供し、htmlFor属性による
// フォーム要素との関連付けを自動的に処理する
import * as LabelPrimitive from "@radix-ui/react-label"

// クラス名を結合するユーティリティ関数
// 条件付きクラスや複数のクラス名を安全に結合する
import { cn } from "@/lib/utils"

/**
 * ラベルコンポーネント
 *
 * フォーム入力要素に関連付けるテキストラベルを表示します。
 * クリック時に関連する入力要素にフォーカスが移動するなど、
 * 標準的なHTMLラベルの動作を提供します。
 *
 * @param props - Radix UIのLabel.Rootコンポーネントのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.htmlFor - 関連付けるフォーム要素のID
 * @param props.children - ラベルとして表示するコンテンツ
 *
 * @returns ラベル要素をレンダリングするReactコンポーネント
 */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      // スロット識別子（テスト・スタイリング用）
      data-slot="label"
      className={cn(
        // 基本レイアウト: フレックスボックスで横並び、アイテム間に余白
        "flex items-center gap-2",
        // テキストスタイル: 小さめのフォント、行間なし、太字
        "text-sm leading-none font-medium",
        // テキスト選択を防止（フォーム操作時の誤選択防止）
        "select-none",
        // グループ無効状態: 親要素にdata-disabled=trueがある場合の表示
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50",
        // ピア無効状態: 兄弟のフォーム要素が無効な場合の表示
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        // カスタムクラスで上書き可能
        className
      )}
      {...props}
    />
  )
}

export { Label }
