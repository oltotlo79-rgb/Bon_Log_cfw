'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { deleteScheduledPost } from '@/lib/actions/scheduled-post'
import { Calendar, Clock, Edit, Trash2, CheckCircle, XCircle, AlertCircle, ChevronRight } from 'lucide-react'
import { SCHEDULED_POST_STATUS } from '@/lib/constants/status'
import { SCHEDULED_POST_MEDIA_PREVIEW_COUNT } from '@/lib/constants/limits'

type ScheduledPostStatus = 'pending' | 'published' | 'failed' | 'cancelled'

type ScheduledPostCardProps = {
  post: {
    id: string
    content: string | null
    scheduledAt: Date
    status: ScheduledPostStatus
    createdAt: Date
    publishedPostId: string | null
    media: { url: string; type: string }[]
    genres: { genre: { id: string; name: string } }[]
  }
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusConfig = {
  pending: {
    label: '予約中',
    icon: Clock,
    className: 'text-foreground bg-muted/50',
  },
  published: {
    label: '公開済み',
    icon: CheckCircle,
    className: 'text-foreground bg-muted/50',
  },
  failed: {
    label: '公開失敗',
    icon: XCircle,
    className: 'text-destructive bg-destructive/10',
  },
  cancelled: {
    label: 'キャンセル',
    icon: AlertCircle,
    className: 'text-gray-600 bg-gray-50',
  },
}

export function ScheduledPostCard({ post }: ScheduledPostCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const status = statusConfig[post.status]
  const StatusIcon = status.icon

  async function handleDelete() {
    setDeleting(true)
    await deleteScheduledPost(post.id)
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{formatDate(post.scheduledAt)}</span>
            <span className="mx-1">|</span>
            <Clock className="w-4 h-4" />
            <span>{formatTime(post.scheduledAt)}</span>
          </div>
        </div>

        <div className="mb-3">
          {post.content ? (
            <p className="text-sm whitespace-pre-wrap line-clamp-3">{post.content}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">（テキストなし）</p>
          )}
        </div>

        {post.media.length > 0 && (
          <div className={`grid gap-2 mb-3 ${post.media.length === 1 ? '' : 'grid-cols-3'}`}>
            {post.media.slice(0, SCHEDULED_POST_MEDIA_PREVIEW_COUNT).map((media, index) => (
              <div key={index} className="relative aspect-video rounded overflow-hidden bg-muted">
                {media.type === 'video' ? (
                  <video src={media.url} className="w-full h-full object-cover" />
                ) : (
                  <Image src={media.url} alt={`予約投稿画像 ${index + 1}`} fill sizes="(max-width: 640px) 33vw, 200px" className="object-cover" />
                )}
              </div>
            ))}
            {post.media.length > SCHEDULED_POST_MEDIA_PREVIEW_COUNT && (
              <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                +{post.media.length - SCHEDULED_POST_MEDIA_PREVIEW_COUNT}
              </div>
            )}
          </div>
        )}

        {post.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {post.genres.map(({ genre }) => (
              <span key={genre.id} className="text-xs bg-secondary px-2 py-0.5 rounded">
                {genre.name}
              </span>
            ))}
          </div>
        )}

        {post.status === SCHEDULED_POST_STATUS.PENDING && (
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Link href={`/posts/scheduled/${post.id}/edit`}>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-1" />
                編集
              </Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4 mr-1" />
                  削除
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>予約投稿を削除</AlertDialogTitle>
                  <AlertDialogDescription>
                    この予約投稿を削除しますか？この操作は取り消せません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {deleting ? '削除中...' : '削除する'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {post.status === SCHEDULED_POST_STATUS.PUBLISHED && post.publishedPostId && (
          <div className="pt-3 border-t">
            <Link href={`/posts/${post.publishedPostId}`}>
              <Button variant="link" size="sm" className="p-0 h-auto inline-flex items-center gap-1">
                公開された投稿を見る <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
