/**
 * @fileoverview ツールチップコンポーネント
 *
 * @description
 * ホバー時に追加情報を表示するポップアップコンポーネントです。
 * Radix UIのTooltipプリミティブをベースに、アクセシブルで
 * 洗練されたツールチップUIを提供します。
 *
 * @features
 * - フルアクセシビリティ対応（フォーカス時にも表示）
 * - 表示遅延のカスタマイズ可能
 * - 4方向の配置オプション（上下左右）
 * - アニメーション付きの表示/非表示
 * - 矢印インジケーター付き
 *
 * @example
 * // 基本的な使用例
 * <Tooltip>
 *   <TooltipTrigger asChild>
 *     <Button variant="ghost" size="icon">
 *       <HelpCircleIcon />
 *     </Button>
 *   </TooltipTrigger>
 *   <TooltipContent>
 *     <p>ヘルプを表示します</p>
 *   </TooltipContent>
 * </Tooltip>
 *
 * @example
 * // 遅延とサイド指定
 * <TooltipProvider delayDuration={300}>
 *   <Tooltip>
 *     <TooltipTrigger>ホバーしてください</TooltipTrigger>
 *     <TooltipContent side="right" sideOffset={8}>
 *       右側に表示されるツールチップ
 *     </TooltipContent>
 *   </Tooltip>
 * </TooltipProvider>
 *
 * @example
 * // 複数のツールチップで共有プロバイダー
 * <TooltipProvider>
 *   <div className="flex gap-2">
 *     <Tooltip>
 *       <TooltipTrigger><Button>ボタン1</Button></TooltipTrigger>
 *       <TooltipContent>説明1</TooltipContent>
 *     </Tooltip>
 *     <Tooltip>
 *       <TooltipTrigger><Button>ボタン2</Button></TooltipTrigger>
 *       <TooltipContent>説明2</TooltipContent>
 *     </Tooltip>
 *   </div>
 * </TooltipProvider>
 */

"use client"

// React本体のインポート（型定義に使用）
import * as React from "react"

// Radix UIのTooltipプリミティブ
// アクセシブルなツールチップの基盤を提供
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

/**
 * ツールチッププロバイダーコンポーネント
 *
 * ツールチップのグローバル設定を提供します。
 * 複数のツールチップで表示遅延などを共有する場合に使用します。
 *
 * @param props - Radix UIのTooltip.Providerのプロパティ
 * @param props.delayDuration - ホバーから表示までの遅延時間（ミリ秒）- デフォルト: 0
 * @param props.skipDelayDuration - 連続ホバー時の遅延スキップ時間
 */
function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      // 表示までの遅延時間（デフォルトは即座に表示）
      delayDuration={delayDuration}
      {...props}
    />
  )
}

/**
 * ツールチップのルートコンポーネント
 *
 * 個別のツールチップを包括するコンテナです。
 * TooltipProviderを自動的に含むため、単独でも使用可能です。
 *
 * @param props - Radix UIのTooltip.Rootのプロパティ
 * @param props.open - 制御コンポーネント時の開閉状態
 * @param props.defaultOpen - 初期の開閉状態
 * @param props.onOpenChange - 開閉状態変更時のコールバック
 */
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    // 単独使用時のためにTooltipProviderでラップ
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

/**
 * ツールチップトリガーコンポーネント
 *
 * ホバー/フォーカスでツールチップを表示する要素です。
 * asChildプロパティで任意の要素をトリガーにできます。
 *
 * @param props - Radix UIのTooltip.Triggerのプロパティ
 * @param props.asChild - 子要素をトリガーとして使用するかどうか
 */
function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/**
 * ツールチップコンテンツコンポーネント
 *
 * ツールチップとして表示されるコンテンツです。
 * ポータル内にレンダリングされ、アニメーション付きで表示されます。
 *
 * @param props - Radix UIのTooltip.Contentのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.sideOffset - トリガーからのオフセット距離（デフォルト: 0px）
 * @param props.children - ツールチップの内容
 * @param props.side - 表示位置（"top" | "right" | "bottom" | "left"）
 * @param props.align - 配置（"start" | "center" | "end"）
 */
function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        // トリガーからのオフセット距離
        sideOffset={sideOffset}
        className={cn(
          // 背景色とテキスト色（反転）
          "bg-foreground text-background",
          // 表示アニメーション
          "animate-in fade-in-0 zoom-in-95",
          // 非表示アニメーション
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          // 表示位置に応じたスライドアニメーション
          "data-[side=bottom]:slide-in-from-top-2",
          "data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2",
          "data-[side=top]:slide-in-from-bottom-2",
          // z-indexと幅
          "z-50 w-fit",
          // 変形原点（Radix UIの変数を使用）
          "origin-(--radix-tooltip-content-transform-origin)",
          // 角丸とパディング
          "rounded-md px-3 py-1.5",
          // フォントサイズとテキストバランス
          "text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        {/* ツールチップの矢印インジケーター */}
        <TooltipPrimitive.Arrow
          className="bg-foreground fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]"
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
