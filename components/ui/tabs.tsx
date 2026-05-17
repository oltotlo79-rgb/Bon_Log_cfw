/**
 * @fileoverview タブコンポーネント
 *
 * @description
 * コンテンツを複数のパネルに分割し、タブで切り替えて表示するコンポーネント群です。
 * Radix UIのTabsプリミティブをベースに、アクセシブルで
 * 使いやすいタブインターフェースを提供します。
 *
 * @features
 * - フルアクセシビリティ対応（キーボード操作、スクリーンリーダー）
 * - 矢印キーでのタブ切り替え
 * - フォーカス時のリング表示
 * - ダークモード対応
 * - スムーズなトランジション
 *
 * @example
 * // 基本的な使用例
 * <Tabs defaultValue="posts">
 *   <TabsList>
 *     <TabsTrigger value="posts">投稿</TabsTrigger>
 *     <TabsTrigger value="media">メディア</TabsTrigger>
 *     <TabsTrigger value="likes">いいね</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="posts">
 *     <PostList />
 *   </TabsContent>
 *   <TabsContent value="media">
 *     <MediaGrid />
 *   </TabsContent>
 *   <TabsContent value="likes">
 *     <LikedPosts />
 *   </TabsContent>
 * </Tabs>
 *
 * @example
 * // 制御コンポーネントとして使用
 * const [activeTab, setActiveTab] = useState('profile')
 *
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   <TabsList>
 *     <TabsTrigger value="profile">プロフィール</TabsTrigger>
 *     <TabsTrigger value="settings">設定</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="profile">...</TabsContent>
 *   <TabsContent value="settings">...</TabsContent>
 * </Tabs>
 */

"use client"

// React本体のインポート（型定義に使用）
import * as React from "react"

// Radix UIのTabsプリミティブ
// アクセシブルなタブインターフェースの基盤を提供
import * as TabsPrimitive from "@radix-ui/react-tabs"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

/**
 * タブのルートコンポーネント
 *
 * タブ全体を包括するコンテナです。
 * アクティブなタブの状態を管理します。
 *
 * @param props - Radix UIのTabs.Rootのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.defaultValue - 初期選択されるタブの値
 * @param props.value - 制御コンポーネント時の選択タブ
 * @param props.onValueChange - タブ変更時のコールバック
 */
function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      // 縦方向のフレックスレイアウト、タブリストとコンテンツ間に余白
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

/**
 * タブリストコンポーネント
 *
 * タブトリガーを横並びに配置するコンテナです。
 * 背景色と角丸を持つバー形状で表示されます。
 *
 * @param props - Radix UIのTabs.Listのプロパティ
 * @param props.className - 追加のCSSクラス名
 */
function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // 背景色とテキスト色
        "bg-muted text-muted-foreground",
        // 横並びレイアウト
        "inline-flex",
        // 高さと幅（コンテンツに応じた幅）
        "h-9 w-fit",
        // 中央揃え
        "items-center justify-center",
        // 角丸とパディング
        "rounded-lg p-[3px]",
        className
      )}
      {...props}
    />
  )
}

/**
 * タブトリガーコンポーネント
 *
 * クリックして対応するタブパネルを表示するボタンです。
 * アクティブ状態のスタイリングが適用されます。
 *
 * @param props - Radix UIのTabs.Triggerのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.value - このトリガーに対応するタブの値
 */
function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // アクティブ状態のスタイル（背景色と影）
        "data-[state=active]:bg-background",
        "dark:data-[state=active]:text-foreground",
        // フォーカス時のスタイル（リング表示）
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring",
        // ダークモードでのアクティブ状態
        "dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30",
        // テキスト色
        "text-foreground dark:text-muted-foreground",
        // レイアウト（横並び、中央揃え）
        "inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5",
        // 角丸とボーダー（透明）
        "rounded-md border border-transparent",
        // パディングとテキストスタイル
        "px-2 py-1 text-sm font-medium whitespace-nowrap",
        // トランジションとフォーカスリング
        "transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1",
        // 無効状態のスタイル
        "disabled:pointer-events-none disabled:opacity-50",
        // アクティブ状態の影
        "data-[state=active]:shadow-sm",
        // SVGアイコンのスタイル
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

/**
 * タブコンテンツコンポーネント
 *
 * タブに対応するコンテンツパネルです。
 * 選択されているタブに対応するパネルのみ表示されます。
 *
 * @param props - Radix UIのTabs.Contentのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.value - このコンテンツに対応するタブの値
 */
function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      // フレックスアイテムとして伸縮、アウトライン非表示
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
