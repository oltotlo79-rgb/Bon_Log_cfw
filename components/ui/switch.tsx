/**
 * @fileoverview スイッチ（トグル）コンポーネント
 *
 * @description
 * オン/オフの切り替えを行うトグルスイッチコンポーネントです。
 * Radix UIのSwitchプリミティブをベースに、iOSスタイルの
 * 洗練されたトグルUIを提供します。
 *
 * @features
 * - アクセシビリティ対応（キーボード操作、スクリーンリーダー対応）
 * - スムーズなアニメーション遷移
 * - ダークモード対応
 * - フォーカス時のリング表示
 * - 無効状態のスタイリング
 *
 * @example
 * // 基本的な使用例
 * const [enabled, setEnabled] = useState(false)
 * <Switch checked={enabled} onCheckedChange={setEnabled} />
 *
 * @example
 * // ラベル付きスイッチ
 * <div className="flex items-center gap-2">
 *   <Switch id="notifications" />
 *   <Label htmlFor="notifications">通知を受け取る</Label>
 * </div>
 *
 * @example
 * // フォーム内での使用
 * <form>
 *   <Switch
 *     name="isPublic"
 *     checked={formData.isPublic}
 *     onCheckedChange={(checked) => setFormData({...formData, isPublic: checked})}
 *   />
 * </form>
 */

"use client"

// React本体のインポート（型定義に使用）
import * as React from "react"

// Radix UIのSwitchプリミティブ
// アクセシブルなトグルスイッチを提供し、
// キーボード操作やスクリーンリーダーに対応
import * as SwitchPrimitive from "@radix-ui/react-switch"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

/**
 * スイッチ（トグル）コンポーネント
 *
 * 二値（オン/オフ）の状態を切り替えるためのUIコンポーネントです。
 * チェックボックスの代替として、より視覚的に分かりやすい
 * トグル操作を提供します。
 *
 * @param props - Radix UIのSwitch.Rootコンポーネントのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.checked - スイッチのオン/オフ状態
 * @param props.onCheckedChange - 状態変更時のコールバック関数
 * @param props.disabled - 無効状態にするかどうか
 * @param props.name - フォーム送信時の名前
 *
 * @returns スイッチ要素をレンダリングするReactコンポーネント
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      // スロット識別子（テスト・スタイリング用）
      data-slot="switch"
      className={cn(
        // ピア要素として登録（関連するLabel等との連携用）
        "peer",
        // 状態別の背景色
        // チェック時: プライマリカラー、未チェック時: 入力フィールドの背景色
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        // フォーカス時のスタイル（リング表示）
        "focus-visible:border-ring focus-visible:ring-ring/50",
        // ダークモード時の未チェック状態
        "dark:data-[state=unchecked]:bg-input/80",
        // サイズとレイアウト
        "inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full",
        // ボーダーとシャドウ
        "border border-transparent shadow-xs",
        // アニメーションとアウトライン
        "transition-all outline-none focus-visible:ring-[3px]",
        // 無効状態のスタイル
        "disabled:cursor-not-allowed disabled:opacity-50",
        // カスタムクラスで上書き可能
        className
      )}
      {...props}
    >
      {/* スイッチのつまみ（Thumb）部分 */}
      <SwitchPrimitive.Thumb
        // スロット識別子（テスト・スタイリング用）
        data-slot="switch-thumb"
        className={cn(
          // 背景色（通常は白）
          "bg-background",
          // ダークモード時の色設定
          "dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground",
          // クリックイベントを無効化（親要素で処理）
          "pointer-events-none",
          // サイズと形状
          "block size-4 rounded-full",
          // リング効果なし
          "ring-0",
          // スライドアニメーション
          "transition-transform",
          // 状態に応じた位置（チェック時は右へ移動）
          "data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
