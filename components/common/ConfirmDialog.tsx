/**
 * @module components/common/ConfirmDialog
 */

'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { FormError } from '@/components/common/FormError'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'
import { cn } from '@/lib/utils'

export type ConfirmDialogVariant = 'destructive' | 'warning' | 'discard'

export type ConfirmDialogProps = {
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description: string
  variant?: ConfirmDialogVariant
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => Promise<void> | void
  showInlineError?: boolean
}

const VARIANT_CONFIRM_CLASSES: Record<ConfirmDialogVariant, string> = {
  destructive: buttonVariants({ variant: 'destructive' }),
  // bg-amber-700 は白字と組み合わせると WCAG AA (4.5:1) を満たす（コントラスト比 約5.5:1）
  warning: 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium bg-amber-700 text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2',
  discard: buttonVariants({ variant: 'outline' }),
}

const DEFAULT_CONFIRM_LABELS: Record<ConfirmDialogVariant, string> = {
  destructive: '削除する',
  warning: '実行する',
  discard: '破棄する',
}

const DEFAULT_CANCEL_LABELS: Record<ConfirmDialogVariant, string> = {
  destructive: 'キャンセル',
  warning: 'キャンセル',
  discard: '続けて編集',
}

export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  variant = 'destructive',
  confirmLabel,
  cancelLabel,
  onConfirm,
  showInlineError = true,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolvedConfirmLabel = confirmLabel ?? DEFAULT_CONFIRM_LABELS[variant]
  const resolvedCancelLabel = cancelLabel ?? DEFAULT_CANCEL_LABELS[variant]

  async function handleConfirm(e: React.MouseEvent) {
    // AlertDialogAction のデフォルト動作（ダイアログクローズ）を手動制御するため抑止
    e.preventDefault()

    setLoading(true)
    setError(null)

    const result = onConfirm()

    // Thenable チェック: async 関数も通常関数も安全に扱う
    if (result !== null && typeof result === 'object' && 'then' in result) {
      try {
        await result
        onOpenChange?.(false)
      } catch (err) {
        if (showInlineError) {
          setError(err instanceof Error ? err.message : MSG_ERROR_FALLBACK)
        }
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(false)
      onOpenChange?.(false)
    }
  }

  const content = (
    <AlertDialogContent
      onEscapeKeyDown={(e) => {
        // loading 中は Escape によるクローズを防ぐ
        if (loading) e.preventDefault()
      }}
    >
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription className="whitespace-pre-wrap">
          {description}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {error && showInlineError && (
        <FormError message={error} />
      )}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={loading}>
          {resolvedCancelLabel}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={handleConfirm}
          disabled={loading}
          aria-disabled={loading}
          aria-label={loading ? '処理中' : resolvedConfirmLabel}
          className={cn(VARIANT_CONFIRM_CLASSES[variant])}
        >
          {loading ? '処理中...' : resolvedConfirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  )

  if (trigger !== undefined) {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
        {content}
      </AlertDialog>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {content}
    </AlertDialog>
  )
}
