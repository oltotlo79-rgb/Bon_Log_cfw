'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { REMAINING_CHARS_WARNING_THRESHOLD } from '@/lib/constants/limits'
import { FileText as FileTextIcon } from 'lucide-react'

type FormActionButtonsProps = {
  onSaveDraft?: () => void
  savingDraft?: boolean
  submitLoading: boolean
  submitDisabled: boolean
  charCount: number
  maxLength: number
  draftCount?: number
  draftHref?: string
}

/**
 * 投稿ボタン（type="submit"）・保存ボタン・文字数表示・下書き一覧リンク
 *
 * stateなし（純粋な表示コンポーネント）
 */
export function FormActionButtons({
  onSaveDraft,
  savingDraft = false,
  submitLoading,
  submitDisabled,
  charCount,
  maxLength,
  draftCount = 0,
  draftHref,
}: FormActionButtonsProps) {
  const remainingChars = maxLength - charCount

  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : remainingChars < REMAINING_CHARS_WARNING_THRESHOLD ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
        {remainingChars}
      </span>
      {draftCount > 0 && draftHref && (
        <Link
          href={draftHref}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="下書き一覧"
        >
          <FileTextIcon className="w-4 h-4" />
          <span className="hidden sm:inline">一覧</span>
        </Link>
      )}
      {onSaveDraft && (
        <Button
          type="button"
          variant="outline"
          onClick={onSaveDraft}
          disabled={savingDraft || submitDisabled}
        >
          {savingDraft ? '保存中...' : '下書き保存'}
        </Button>
      )}
      <Button
        type="submit"
        variant="bonsai"
        disabled={submitLoading || submitDisabled || remainingChars < 0}
      >
        {submitLoading ? '投稿中...' : '投稿する'}
      </Button>
    </div>
  )
}
