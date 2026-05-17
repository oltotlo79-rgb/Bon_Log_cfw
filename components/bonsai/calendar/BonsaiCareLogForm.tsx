/**
 * 手入れ記録の追加・編集フォーム（Dialog 内）。
 *
 * 入力項目: 種別 / 実施日時 / 任意コメント の 3 つ。
 * Server Action 呼び出しは props 経由で渡される（テスト容易性）。
 *
 * @module components/bonsai/calendar/BonsaiCareLogForm
 */

'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { BonsaiCareType } from '@prisma/client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  BONSAI_CARE_LABELS,
  BONSAI_CARE_TYPES,
} from '@/lib/constants/bonsai-care'
import { MAX_BONSAI_CARE_NOTE_LENGTH } from '@/lib/constants/limits'
import type { CareLogListItem } from '@/types/bonsai-care'
import {
  addBonsaiCareLog,
  updateBonsaiCareLog,
} from '@/lib/actions/bonsai-care-log'

interface BonsaiCareLogFormProps {
  /** 開閉状態（制御コンポーネント） */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 編集対象（null なら新規作成） */
  editing: CareLogListItem | null
  /** 新規作成時の初期日付（既定: 今） */
  defaultDate?: Date
  /** 保存成功時のコールバック（リスト再取得トリガ等） */
  onSaved: () => void
}

/**
 * Date を `<input type="datetime-local">` の value 形式
 * (`YYYY-MM-DDTHH:mm`) に変換する。
 */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

export function BonsaiCareLogForm({
  open,
  onOpenChange,
  editing,
  defaultDate,
  onSaved,
}: BonsaiCareLogFormProps) {
  const { toast } = useToast()

  const [type, setType] = useState<BonsaiCareType>(BonsaiCareType.pesticide)
  const [performedAt, setPerformedAt] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // 開いた瞬間に編集対象 / 既定値を反映する
  useEffect(() => {
    if (!open) return
    if (editing) {
      setType(editing.type)
      setPerformedAt(toDatetimeLocalValue(editing.performedAt))
      setNote(editing.note ?? '')
    } else {
      const initial = defaultDate ?? new Date()
      setType(BonsaiCareType.pesticide)
      setPerformedAt(toDatetimeLocalValue(initial))
      setNote('')
    }
  }, [open, editing, defaultDate])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return

    const performedAtDate = new Date(performedAt)
    if (Number.isNaN(performedAtDate.getTime())) {
      toast({
        title: '入力エラー',
        description: '実施日時が正しくありません',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const result = editing
        ? await updateBonsaiCareLog(editing.id, {
            type,
            performedAt: performedAtDate,
            note: note.trim() === '' ? null : note,
          })
        : await addBonsaiCareLog({
            type,
            performedAt: performedAtDate,
            note: note.trim() === '' ? undefined : note,
          })

      if (!result.success) {
        toast({
          title: '保存に失敗しました',
          description: result.error,
          variant: 'destructive',
        })
        return
      }
      toast({ title: editing ? '記録を更新しました' : '記録を追加しました' })
      onSaved()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? '手入れ記録を編集' : '手入れ記録を追加'}</DialogTitle>
          <DialogDescription>
            カレンダーに表示される、ユーザー全体の手入れメモです。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            {/*
              radiogroup のラベルは <label htmlFor> で関連付けできない（for は
              フォームコントロールしか参照できない）ため、id 付きの見出し要素を
              radiogroup から aria-labelledby で参照する形にする。
            */}
            <span id="care-log-type-label" className="text-sm font-medium leading-none">
              種別
            </span>
            <div
              role="radiogroup"
              aria-labelledby="care-log-type-label"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {BONSAI_CARE_TYPES.map((t) => {
                const checked = type === t
                return (
                  <label
                    key={t}
                    className={
                      'cursor-pointer select-none rounded-md border px-2 py-1.5 text-center text-sm transition-colors ' +
                      (checked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:bg-muted/40')
                    }
                  >
                    <input
                      type="radio"
                      name="care-log-type-radio"
                      value={t}
                      checked={checked}
                      onChange={() => setType(t)}
                      className="sr-only"
                    />
                    {BONSAI_CARE_LABELS[t]}
                  </label>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-log-performed-at">実施日時</Label>
            <input
              id="care-log-performed-at"
              type="datetime-local"
              required
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="care-log-note">コメント（任意）</Label>
              <span className="text-xs text-muted-foreground">
                {note.length} / {MAX_BONSAI_CARE_NOTE_LENGTH}
              </span>
            </div>
            <Textarea
              id="care-log-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={MAX_BONSAI_CARE_NOTE_LENGTH}
              rows={4}
              placeholder="例: ベンレート 1000倍を全鉢に散布"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {editing ? '更新' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
