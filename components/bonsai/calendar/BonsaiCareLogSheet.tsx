/**
 * 日付クリック時に開くドロワー（実態は Dialog）。
 *
 * 当日のログ一覧を時刻順に表示し、編集・削除・新規追加ボタンを提供する。
 *
 * @module components/bonsai/calendar/BonsaiCareLogSheet
 */

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ImageIcon, Pencil, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  BONSAI_CARE_COLOR_CLASS,
  BONSAI_CARE_LABELS,
  CALENDAR_OVERLAY_COLOR_CLASS,
  CALENDAR_OVERLAY_LABELS,
  CALENDAR_OVERLAY_POST,
  CALENDAR_OVERLAY_RECORD,
} from '@/lib/constants/bonsai-care'
import { CALENDAR_SHEET_PREVIEW_MAX_LENGTH } from '@/lib/constants/limits'
import { ROUTE_BONSAI, ROUTE_POSTS } from '@/lib/constants/routes'
import { deleteBonsaiCareLog } from '@/lib/actions/bonsai-care-log'
import type {
  BonsaiPostCalendarItem,
  BonsaiRecordCalendarItem,
  CareLogListItem,
} from '@/types/bonsai-care'

interface BonsaiCareLogSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** クリックされた日（null なら描画しない） */
  date: Date | null
  /** 当日のログ（時刻昇順想定） */
  logs: readonly CareLogListItem[]
  /** 当日の成長記録（読み取り専用、クリックで盆栽詳細へ遷移） */
  records: readonly BonsaiRecordCalendarItem[]
  /** 当日のタグ付け投稿（読み取り専用、クリックで投稿詳細へ遷移） */
  posts: readonly BonsaiPostCalendarItem[]
  onEdit: (log: CareLogListItem) => void
  onAdd: () => void
  onChanged: () => void
}

const TIME_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_FORMATTER = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})

/** 本文を {@link CALENDAR_SHEET_PREVIEW_MAX_LENGTH} で省略する。空 / null は空文字を返す */
function truncatePreview(text: string | null): string {
  if (!text) return ''
  return text.length > CALENDAR_SHEET_PREVIEW_MAX_LENGTH
    ? `${text.slice(0, CALENDAR_SHEET_PREVIEW_MAX_LENGTH)}…`
    : text
}

export function BonsaiCareLogSheet({
  open,
  onOpenChange,
  date,
  logs,
  records,
  posts,
  onEdit,
  onAdd,
  onChanged,
}: BonsaiCareLogSheetProps) {
  const { toast } = useToast()
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const totalCount = logs.length + records.length + posts.length

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      const result = await deleteBonsaiCareLog(pendingDeleteId)
      if (!result.success) {
        toast({
          title: '削除に失敗しました',
          description: result.error,
          variant: 'destructive',
        })
        return
      }
      toast({ title: '記録を削除しました' })
      onChanged()
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{date ? DATE_FORMATTER.format(date) : ''}</DialogTitle>
            <DialogDescription>
              この日の記録（{totalCount}件）
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {totalCount === 0 ? (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                記録はまだありません
              </p>
            ) : (
              <>
                {logs.length > 0 && (
                  <section aria-label="手入れ記録">
                    <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                      手入れ
                    </h3>
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {logs.map((log) => (
                        <li key={log.id} className="flex items-start gap-3 p-3">
                          <span
                            data-care-type={log.type}
                            className={cn(
                              'mt-1 inline-block h-3 w-3 shrink-0 rounded-full',
                              BONSAI_CARE_COLOR_CLASS[log.type],
                            )}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{BONSAI_CARE_LABELS[log.type]}</span>
                              <span className="text-xs text-muted-foreground">
                                {TIME_FORMATTER.format(log.performedAt)}
                              </span>
                            </div>
                            {log.note && (
                              <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                                {log.note}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="編集"
                              onClick={() => onEdit(log)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label="削除"
                              onClick={() => setPendingDeleteId(log.id)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {records.length > 0 && (
                  <section aria-label={CALENDAR_OVERLAY_LABELS[CALENDAR_OVERLAY_RECORD]}>
                    <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                      {CALENDAR_OVERLAY_LABELS[CALENDAR_OVERLAY_RECORD]}
                    </h3>
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {records.map((record) => (
                        <li key={record.id}>
                          <Link
                            href={`${ROUTE_BONSAI}/${record.bonsaiId}`}
                            className="flex items-start gap-3 p-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => onOpenChange(false)}
                          >
                            <span
                              data-overlay-kind={CALENDAR_OVERLAY_RECORD}
                              className={cn(
                                'mt-1 inline-block h-3 w-3 shrink-0 rounded-full',
                                CALENDAR_OVERLAY_COLOR_CLASS[CALENDAR_OVERLAY_RECORD],
                              )}
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="truncate font-medium">{record.bonsaiName}</span>
                                {record.imageCount > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                                    <ImageIcon className="h-3 w-3" aria-hidden="true" />
                                    {record.imageCount}
                                  </span>
                                )}
                              </div>
                              {record.content && (
                                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                                  {truncatePreview(record.content)}
                                </p>
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {posts.length > 0 && (
                  <section aria-label={CALENDAR_OVERLAY_LABELS[CALENDAR_OVERLAY_POST]}>
                    <h3 className="mb-1 text-xs font-medium text-muted-foreground">
                      {CALENDAR_OVERLAY_LABELS[CALENDAR_OVERLAY_POST]}
                    </h3>
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {posts.map((post) => (
                        <li key={post.id}>
                          <Link
                            href={`${ROUTE_POSTS}/${post.id}`}
                            className="flex items-start gap-3 p-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => onOpenChange(false)}
                          >
                            <span
                              data-overlay-kind={CALENDAR_OVERLAY_POST}
                              className={cn(
                                'mt-1 inline-block h-3 w-3 shrink-0 rounded-full',
                                CALENDAR_OVERLAY_COLOR_CLASS[CALENDAR_OVERLAY_POST],
                              )}
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="truncate font-medium">{post.bonsaiName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {TIME_FORMATTER.format(post.createdAt)}
                                </span>
                                {post.mediaCount > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                                    <ImageIcon className="h-3 w-3" aria-hidden="true" />
                                    {post.mediaCount}
                                  </span>
                                )}
                              </div>
                              {post.content && (
                                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                                  {truncatePreview(post.content)}
                                </p>
                              )}
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            <Button type="button" className="w-full" onClick={onAdd}>
              手入れ記録を追加
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(o) => !o && setPendingDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記録を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={deleting}>
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
