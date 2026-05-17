/**
 * アラートダイアログコンポーネント群 (AlertDialog)
 *
 * ユーザーに重要な確認を求めるモーダルダイアログ。
 * 削除操作の確認など、ユーザーの明示的な操作が必要な場面で使用します。
 * Radix UIの@radix-ui/react-alert-dialogをベースにしています。
 *
 * 通常のDialogとの違い:
 * - 背景クリックやEscキーで閉じることができない（意図しない閉じを防ぐ）
 * - アクセシビリティ対応（スクリーンリーダーへの適切な通知）
 *
 * @example 基本的な使い方
 * ```tsx
 * <AlertDialog>
 *   <AlertDialogTrigger asChild>
 *     <Button variant="destructive">削除</Button>
 *   </AlertDialogTrigger>
 *   <AlertDialogContent>
 *     <AlertDialogHeader>
 *       <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
 *       <AlertDialogDescription>
 *         この操作は取り消せません。投稿は完全に削除されます。
 *       </AlertDialogDescription>
 *     </AlertDialogHeader>
 *     <AlertDialogFooter>
 *       <AlertDialogCancel>キャンセル</AlertDialogCancel>
 *       <AlertDialogAction onClick={handleDelete}>削除</AlertDialogAction>
 *     </AlertDialogFooter>
 *   </AlertDialogContent>
 * </AlertDialog>
 * ```
 */

// ============================================================
// "use client" ディレクティブ
// ============================================================
// このコンポーネントはクライアントサイドで動作する必要があります
// （ダイアログの開閉状態管理、アニメーション、イベントハンドリングのため）
"use client"

// ============================================================
// インポート
// ============================================================

// React本体をインポート
import * as React from "react"

// Radix UIのAlertDialogプリミティブ
// アクセシビリティ対応のアラートダイアログ機能を提供
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"

// クラス名を結合するユーティリティ関数
import { cn } from "@/lib/utils"

// ボタンのスタイルを再利用するためにインポート
import { buttonVariants } from "@/components/ui/button"

// ============================================================
// AlertDialog（ルートコンポーネント）
// ============================================================

/**
 * AlertDialog - アラートダイアログのルートコンポーネント
 *
 * ダイアログの開閉状態を管理するコンテナ。
 * 直接スタイルは持たず、状態管理のみを担当。
 *
 * @param props - Radix UIのAlertDialog.Rootのプロパティ
 */
function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

// ============================================================
// AlertDialogTrigger（トリガーボタン）
// ============================================================

/**
 * AlertDialogTrigger - ダイアログを開くトリガー要素
 *
 * このコンポーネントをクリックするとダイアログが開きます。
 * asChildプロパティを使用して、既存のボタンをトリガーとして使用可能。
 *
 * @param props - Radix UIのAlertDialog.Triggerのプロパティ
 */
function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  )
}

// ============================================================
// AlertDialogPortal（ポータル）
// ============================================================

/**
 * AlertDialogPortal - ダイアログをDOMの別の場所にレンダリング
 *
 * ダイアログをbody直下にレンダリングすることで、
 * z-indexの問題やスタイルの継承問題を回避します。
 *
 * @param props - Radix UIのAlertDialog.Portalのプロパティ
 */
function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  )
}

// ============================================================
// AlertDialogOverlay（オーバーレイ）
// ============================================================

/**
 * AlertDialogOverlay - ダイアログの背景オーバーレイ
 *
 * ダイアログが開いているときに背景を暗くする半透明のレイヤー。
 * フェードイン/アウトのアニメーション付き。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのAlertDialog.Overlayのプロパティ
 */
function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        // ============================================================
        // アニメーション（Tailwind CSSのanimate-inプラグイン使用）
        // ============================================================
        // data-[state=open]:animate-in: 開く時のアニメーション
        // data-[state=closed]:animate-out: 閉じる時のアニメーション
        // fade-in-0 / fade-out-0: フェード効果
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",

        // ============================================================
        // 配置とスタイル
        // ============================================================
        // fixed inset-0: 画面全体を覆う固定配置
        // z-50: 高いz-indexで他の要素より前面に
        // bg-black/50: 50%透明の黒背景
        "fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// AlertDialogContent（コンテンツ）
// ============================================================

/**
 * AlertDialogContent - ダイアログのメインコンテンツ
 *
 * ダイアログの本体部分。タイトル、説明文、アクションボタンを含みます。
 * 画面中央に配置され、開閉時にズームアニメーションを伴います。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのAlertDialog.Contentのプロパティ
 */
function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    // PortalとOverlayを自動的に含む
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          // ============================================================
          // 基本スタイル
          // ============================================================
          // bg-background: 背景色
          // fixed: 固定配置
          // top-[50%] left-[50%]: 画面中央に配置
          // translate-x-[-50%] translate-y-[-50%]: 中央寄せの調整
          // z-50: 高いz-index
          // grid: グリッドレイアウト
          // w-full max-w-[calc(100%-2rem)]: 幅（モバイルで余白確保）
          // sm:max-w-lg: デスクトップでの最大幅
          // gap-4: 子要素間のスペース
          // rounded-lg: 大きめの角丸
          // border: ボーダー
          // p-6: 内側の余白
          // shadow-lg: 影
          // duration-200: アニメーション時間
          "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",

          // ============================================================
          // 開閉アニメーション
          // ============================================================
          // フェード + ズーム効果
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

// ============================================================
// AlertDialogHeader（ヘッダー）
// ============================================================

/**
 * AlertDialogHeader - ダイアログのヘッダー部分
 *
 * タイトルと説明文を配置するエリア。
 *
 * @param className - 追加のCSSクラス
 * @param props - div要素のプロパティ
 */
function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        // flex flex-col: 縦方向のフレックスボックス
        // gap-2: 要素間のスペース
        // text-center sm:text-left: モバイルは中央揃え、デスクトップは左揃え
        "flex flex-col gap-2 text-center sm:text-left",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// AlertDialogFooter（フッター）
// ============================================================

/**
 * AlertDialogFooter - ダイアログのフッター部分
 *
 * アクションボタン（確認・キャンセル）を配置するエリア。
 *
 * @param className - 追加のCSSクラス
 * @param props - div要素のプロパティ
 */
function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        // flex flex-col-reverse: モバイルでは縦方向で逆順（キャンセルが下）
        // gap-2: ボタン間のスペース
        // sm:flex-row sm:justify-end: デスクトップでは横並びで右寄せ
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// AlertDialogTitle（タイトル）
// ============================================================

/**
 * AlertDialogTitle - ダイアログのタイトル
 *
 * ダイアログの主要なタイトルを表示。
 * アクセシビリティのため、スクリーンリーダーに適切に読み上げられます。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのAlertDialog.Titleのプロパティ
 */
function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(
        // text-lg: 大きめのフォントサイズ
        // font-semibold: 太字
        "text-lg font-semibold",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// AlertDialogDescription（説明文）
// ============================================================

/**
 * AlertDialogDescription - ダイアログの説明文
 *
 * タイトルの補足説明を表示。
 * 操作の結果や注意事項を伝えるために使用。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのAlertDialog.Descriptionのプロパティ
 */
function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(
        // text-muted-foreground: グレーのテキスト色
        // text-sm: 小さめのフォントサイズ
        "text-muted-foreground text-sm",
        className
      )}
      {...props}
    />
  )
}

// ============================================================
// AlertDialogAction（確認ボタン）
// ============================================================

/**
 * AlertDialogAction - 確認アクションボタン
 *
 * ダイアログの主要なアクション（削除、確認など）を実行するボタン。
 * クリックするとダイアログが閉じ、指定されたアクションが実行されます。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのAlertDialog.Actionのプロパティ
 */
function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      // buttonVariants()でデフォルトのボタンスタイルを適用
      className={cn(buttonVariants(), className)}
      {...props}
    />
  )
}

// ============================================================
// AlertDialogCancel（キャンセルボタン）
// ============================================================

/**
 * AlertDialogCancel - キャンセルボタン
 *
 * ダイアログを閉じるためのボタン。アクションは実行されません。
 *
 * @param className - 追加のCSSクラス
 * @param props - Radix UIのAlertDialog.Cancelのプロパティ
 */
function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      // buttonVariants({ variant: "outline" })でアウトラインスタイルを適用
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  )
}

// ============================================================
// エクスポート
// ============================================================

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
