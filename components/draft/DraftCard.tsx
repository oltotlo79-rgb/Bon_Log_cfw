'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import {
  Trash2 as TrashIcon,
  Pencil as PencilIcon,
  Send as SendIcon,
  Image as ImageIcon,
} from 'lucide-react'
import { deleteDraft, publishDraft } from '@/lib/actions/draft'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  MSG_DRAFT_DELETE_CONFIRM_DESC,
  MSG_DRAFT_DELETE_CONFIRM_TITLE,
  MSG_DRAFT_DELETE_FAILED,
  MSG_DRAFT_POST_FAILED,
  MSG_DRAFT_PUBLISH_CONFIRM_DESC,
  MSG_DRAFT_PUBLISH_CONFIRM_TITLE,
} from '@/lib/constants/messages'
import { DRAFT_CARD_MEDIA_PREVIEW_COUNT } from '@/lib/constants/limits'
import { ROUTE_FEED } from '@/lib/constants/routes'
import { buildDraftEditPath } from '@/lib/constants/path-builders'

type DraftMedia = {
  id: string
  url: string
  type: string
}

type DraftGenre = {
  genreId: string
  genre: {
    id: string
    name: string
  }
}

type Draft = {
  id: string
  content: string | null
  createdAt: Date
  updatedAt: Date
  media: DraftMedia[]
  genres: DraftGenre[]
}

interface DraftCardProps {
  draft: Draft
}

export function DraftCard({ draft }: DraftCardProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const handleDeleteConfirm = async () => {
    try {
      const result = await deleteDraft(draft.id)
      if (!result.success) {
        throw new Error(result.error)
      }
      router.refresh()
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : MSG_DRAFT_DELETE_FAILED,
        variant: 'destructive',
      })
      throw err
    }
  }

  const handlePublishConfirm = async () => {
    try {
      const result = await publishDraft(draft.id)
      if ('error' in result) {
        throw new Error(result.error)
      }
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      router.push(ROUTE_FEED)
      router.refresh()
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : MSG_DRAFT_POST_FAILED,
        variant: 'destructive',
      })
      throw err
    }
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="p-4">
        <p className="text-xs text-muted-foreground mb-2">
          最終更新: {new Date(draft.updatedAt).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>

        {draft.content ? (
          <p className="whitespace-pre-wrap line-clamp-3">{draft.content}</p>
        ) : (
          <p className="text-muted-foreground italic">テキストなし</p>
        )}

        {draft.media.length > 0 && (
          <div className="mt-3 flex gap-2">
            {draft.media.slice(0, DRAFT_CARD_MEDIA_PREVIEW_COUNT).map((media) => (
              <div key={media.id} className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted">
                {media.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                ) : (
                  <Image
                    src={media.url}
                    alt="下書き画像"
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>
            ))}
            {draft.media.length > DRAFT_CARD_MEDIA_PREVIEW_COUNT && (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">
                +{draft.media.length - DRAFT_CARD_MEDIA_PREVIEW_COUNT}
              </div>
            )}
          </div>
        )}

        {draft.genres.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {draft.genres.map((g) => (
              <span
                key={g.genreId}
                className="px-2 py-1 text-xs bg-muted rounded-full"
              >
                {g.genre.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between">
        <div className="flex gap-2">
          <Link
            href={buildDraftEditPath(draft.id)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            編集
          </Link>
          <ConfirmDialog
            trigger={
              <button className="flex items-center gap-1 px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors">
                <TrashIcon className="w-4 h-4" />
                削除
              </button>
            }
            variant="destructive"
            title={MSG_DRAFT_DELETE_CONFIRM_TITLE}
            description={MSG_DRAFT_DELETE_CONFIRM_DESC}
            confirmLabel="削除する"
            onConfirm={handleDeleteConfirm}
          />
        </div>

        <ConfirmDialog
          trigger={
            <button className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              <SendIcon className="w-4 h-4" />
              投稿する
            </button>
          }
          variant="warning"
          title={MSG_DRAFT_PUBLISH_CONFIRM_TITLE}
          description={MSG_DRAFT_PUBLISH_CONFIRM_DESC}
          confirmLabel="投稿する"
          onConfirm={handlePublishConfirm}
        />
      </div>
    </div>
  )
}
