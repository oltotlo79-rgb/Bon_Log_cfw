/**
 * @fileoverview ドロップダウンメニューコンポーネント
 *
 * @description
 * クリックで展開するドロップダウンメニューを提供するコンポーネント群です。
 * Radix UIのDropdownMenuプリミティブをベースに、アクセシブルで
 * 機能豊富なメニューUIを実現しています。
 *
 * @features
 * - フルアクセシビリティ対応（キーボード操作、スクリーンリーダー）
 * - ネストしたサブメニュー対応
 * - チェックボックス・ラジオボタンメニューアイテム
 * - ショートカットキー表示
 * - 区切り線・ラベル
 * - アニメーション付き開閉
 *
 * @example
 * // 基本的な使用例
 * <DropdownMenu>
 *   <DropdownMenuTrigger asChild>
 *     <Button>メニューを開く</Button>
 *   </DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuItem>プロフィール</DropdownMenuItem>
 *     <DropdownMenuItem>設定</DropdownMenuItem>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem variant="destructive">ログアウト</DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 *
 * @example
 * // サブメニュー付き
 * <DropdownMenu>
 *   <DropdownMenuTrigger>オプション</DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuSub>
 *       <DropdownMenuSubTrigger>シェア</DropdownMenuSubTrigger>
 *       <DropdownMenuSubContent>
 *         <DropdownMenuItem>Twitter</DropdownMenuItem>
 *         <DropdownMenuItem>Facebook</DropdownMenuItem>
 *       </DropdownMenuSubContent>
 *     </DropdownMenuSub>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 */

"use client"

// React本体のインポート（型定義に使用）
import * as React from "react"

// Radix UIのDropdownMenuプリミティブ
// アクセシブルなドロップダウンメニューの基盤を提供
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"

// Lucideアイコン
// チェックマーク、矢印、ラジオボタンのインジケーター用
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

/**
 * ドロップダウンメニューのルートコンポーネント
 *
 * メニュー全体を包括するコンテナです。
 * 開閉状態の管理を行います。
 *
 * @param props - Radix UIのDropdownMenu.Rootのプロパティ
 */
function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

/**
 * ドロップダウンメニューのポータルコンポーネント
 *
 * メニューコンテンツをDOMツリーの別の場所にレンダリングします。
 * z-indexの問題を回避するために使用されます。
 *
 * @param props - Radix UIのDropdownMenu.Portalのプロパティ
 */
function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

/**
 * ドロップダウンメニューのトリガーコンポーネント
 *
 * クリックするとメニューが開くボタン/要素です。
 * asChildプロパティで任意の要素をトリガーにできます。
 *
 * @param props - Radix UIのDropdownMenu.Triggerのプロパティ
 */
function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

/**
 * ドロップダウンメニューのコンテンツコンポーネント
 *
 * メニューアイテムを包括するコンテナです。
 * ポータル内にレンダリングされ、アニメーション付きで表示されます。
 *
 * @param props - Radix UIのDropdownMenu.Contentのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.sideOffset - トリガーからのオフセット距離（デフォルト: 4px）
 */
function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          // 背景色とテキスト色
          "bg-popover text-popover-foreground",
          // 開閉アニメーション
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          // 表示位置に応じたスライドアニメーション
          "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          // z-indexと最大高さ
          "z-50 max-h-(--radix-dropdown-menu-content-available-height)",
          // サイズと変形原点
          "min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin)",
          // オーバーフロー処理（横: 非表示、縦: スクロール）
          "overflow-x-hidden overflow-y-auto",
          // 角丸、ボーダー、パディング、シャドウ
          "rounded-md border p-1 shadow-md",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

/**
 * ドロップダウンメニューのグループコンポーネント
 *
 * 関連するメニューアイテムをグループ化します。
 * ラベルと組み合わせて使用することが多いです。
 *
 * @param props - Radix UIのDropdownMenu.Groupのプロパティ
 */
function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

/**
 * ドロップダウンメニューのアイテムコンポーネント
 *
 * 選択可能なメニュー項目です。
 *
 * @param props - Radix UIのDropdownMenu.Itemのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.inset - 左側にパディングを追加するかどうか（アイコンなしの場合に揃える用）
 * @param props.variant - バリアント（"default" | "destructive"）
 */
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  /** 左側にインセット（パディング）を追加するかどうか */
  inset?: boolean
  /** アイテムのバリアント - "destructive"で削除等の危険な操作を示す */
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        // フォーカス時のスタイル
        "focus:bg-accent focus:text-accent-foreground",
        // destructiveバリアントのスタイル
        "data-[variant=destructive]:text-destructive",
        "data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20",
        "data-[variant=destructive]:focus:text-destructive",
        "data-[variant=destructive]:*:[svg]:!text-destructive",
        // SVGアイコンのデフォルト色
        "[&_svg:not([class*='text-'])]:text-muted-foreground",
        // レイアウト
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
        // アウトラインを非表示、テキスト選択防止
        "outline-hidden select-none",
        // 無効状態のスタイル
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        // インセット時の左パディング
        "data-[inset]:pl-8",
        // SVGアイコンのスタイル
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

/**
 * ドロップダウンメニューのチェックボックスアイテムコンポーネント
 *
 * チェック状態を持つメニュー項目です。
 * 複数選択可能なオプションに使用します。
 *
 * @param props - Radix UIのDropdownMenu.CheckboxItemのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.children - メニューアイテムの内容
 * @param props.checked - チェック状態
 */
function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        // フォーカス時のスタイル
        "focus:bg-accent focus:text-accent-foreground",
        // レイアウト（左側にチェックマーク用のスペースを確保）
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm",
        // アウトラインを非表示、テキスト選択防止
        "outline-hidden select-none",
        // 無効状態のスタイル
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        // SVGアイコンのスタイル
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      {/* チェックマークインジケーター */}
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

/**
 * ドロップダウンメニューのラジオグループコンポーネント
 *
 * ラジオボタン形式のメニューアイテムをグループ化します。
 * グループ内で1つだけ選択可能です。
 *
 * @param props - Radix UIのDropdownMenu.RadioGroupのプロパティ
 */
function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

/**
 * ドロップダウンメニューのラジオアイテムコンポーネント
 *
 * ラジオボタン形式のメニュー項目です。
 * RadioGroup内で1つだけ選択可能です。
 *
 * @param props - Radix UIのDropdownMenu.RadioItemのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.children - メニューアイテムの内容
 */
function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        // フォーカス時のスタイル
        "focus:bg-accent focus:text-accent-foreground",
        // レイアウト（左側にインジケーター用のスペースを確保）
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm",
        // アウトラインを非表示、テキスト選択防止
        "outline-hidden select-none",
        // 無効状態のスタイル
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        // SVGアイコンのスタイル
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {/* ラジオボタンインジケーター（塗りつぶした円） */}
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

/**
 * ドロップダウンメニューのラベルコンポーネント
 *
 * メニューグループのタイトル/見出しとして使用します。
 * 選択不可の説明テキストです。
 *
 * @param props - Radix UIのDropdownMenu.Labelのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.inset - 左側にパディングを追加するかどうか
 */
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  /** 左側にインセット（パディング）を追加するかどうか */
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        // パディングとフォントスタイル
        "px-2 py-1.5 text-sm font-medium",
        // インセット時の左パディング
        "data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

/**
 * ドロップダウンメニューの区切り線コンポーネント
 *
 * メニューアイテム間に水平線を表示します。
 * グループ分けに使用します。
 *
 * @param props - Radix UIのDropdownMenu.Separatorのプロパティ
 * @param props.className - 追加のCSSクラス名
 */
function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  )
}

/**
 * ドロップダウンメニューのショートカットコンポーネント
 *
 * キーボードショートカットを表示するためのコンポーネントです。
 * メニューアイテムの右側に配置されます。
 *
 * @param props - HTMLSpan要素のプロパティ
 * @param props.className - 追加のCSSクラス名
 */
function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        // 薄い色、自動左マージン、小さいフォント
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  )
}

/**
 * ドロップダウンメニューのサブメニューコンポーネント
 *
 * ネストしたサブメニューのルートです。
 *
 * @param props - Radix UIのDropdownMenu.Subのプロパティ
 */
function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

/**
 * ドロップダウンメニューのサブメニュートリガーコンポーネント
 *
 * ホバー/クリックでサブメニューを開くトリガーです。
 * 右側に矢印アイコンが表示されます。
 *
 * @param props - Radix UIのDropdownMenu.SubTriggerのプロパティ
 * @param props.className - 追加のCSSクラス名
 * @param props.inset - 左側にパディングを追加するかどうか
 * @param props.children - トリガーの内容
 */
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  /** 左側にインセット（パディング）を追加するかどうか */
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        // フォーカス・オープン時のスタイル
        "focus:bg-accent focus:text-accent-foreground",
        "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        // SVGアイコンのデフォルト色
        "[&_svg:not([class*='text-'])]:text-muted-foreground",
        // レイアウト
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
        // アウトラインを非表示、テキスト選択防止
        "outline-hidden select-none",
        // インセット時の左パディング
        "data-[inset]:pl-8",
        // SVGアイコンのスタイル
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      {/* サブメニューを示す右矢印アイコン */}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

/**
 * ドロップダウンメニューのサブメニューコンテンツコンポーネント
 *
 * サブメニューのコンテンツを包括するコンテナです。
 * アニメーション付きで表示されます。
 *
 * @param props - Radix UIのDropdownMenu.SubContentのプロパティ
 * @param props.className - 追加のCSSクラス名
 */
function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        // 背景色とテキスト色
        "bg-popover text-popover-foreground",
        // 開閉アニメーション
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        // 表示位置に応じたスライドアニメーション
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
        "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        // z-indexとサイズ
        "z-50 min-w-[8rem]",
        // 変形原点
        "origin-(--radix-dropdown-menu-content-transform-origin)",
        // オーバーフロー処理
        "overflow-hidden",
        // 角丸、ボーダー、パディング、シャドウ
        "rounded-md border p-1 shadow-lg",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
