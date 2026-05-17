/**
 * @module components/ui/input
 *
 * shadcn/ui ベースの汎用 Input。`brush-input` で和風のシャドウ、
 * `focus-visible:ring-primary` でフォーカスリング、`aria-invalid` でエラー表示を切替える。
 *
 * @example
 * <Input type="email" placeholder="メールアドレス" />
 * <Input disabled placeholder="編集不可" />
 * <Input aria-invalid="true" placeholder="エラー" />
 */

import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 基本: shadow-washi で和紙風シャドウ、placeholder は薄く、ダーク時は背景を半透明にする。
        "file:text-foreground placeholder:text-muted-foreground/70 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-border/80 h-9 w-full min-w-0 rounded border bg-card/50 px-3 py-1 text-base shadow-washi transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm brush-input",
        // フォーカス時: ring 3px で AA 視認性、背景は不透明化してコントラスト確保。
        "focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px] focus-visible:bg-card",
        // ホバー時: 視覚的フィードバックを軽く出す。
        "hover:border-border hover:bg-card/80",
        // バリデーションエラー (aria-invalid="true"): destructive カラーのボーダー + リング。
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
