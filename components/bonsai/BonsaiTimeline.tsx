'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { Trash2 as TrashIcon, Heart as HeartIcon, MessageCircle as MessageCircleIcon, ImageIcon, Leaf as LeafIcon } from 'lucide-react'
import { deleteBonsaiRecord } from '@/lib/actions/bonsai'
import { useToast } from '@/hooks/use-toast'
import { MSG_BONSAI_DELETE_FAILED } from '@/lib/constants/messages'
import { MAX_POST_IMAGES_FREE } from '@/lib/constants/limits'
import { buildPostPath } from '@/lib/constants/path-builders'

interface BonsaiRecord {
  id: string
  content: string | null
  recordAt: Date
  createdAt: Date
  images: { id: string; url: string }[]
}

type PostUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

type PostMedia = {
  id: string
  url: string
  type: string
  sortOrder: number
}

type PostGenre = {
  postId: string
  genreId: string
  genre: {
    id: string
    name: string
    category: string
  }
}

interface Post {
  id: string
  content: string | null
  createdAt: string | Date
  user: PostUser
  media: PostMedia[]
  genres: PostGenre[]
  _count: {
    likes: number
    comments: number
  }
}

type TimelineItem =
  | { type: 'record'; data: BonsaiRecord; date: Date }
  | { type: 'post'; data: Post; date: Date }

interface BonsaiTimelineProps {
  records: BonsaiRecord[]
  posts: Post[]
  isOwner: boolean
  currentUserId?: string
}

export function BonsaiTimeline({ records, posts, isOwner }: BonsaiTimelineProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const timelineItems: TimelineItem[] = [
    ...records.map((record) => ({
      type: 'record' as const,
      data: record,
      date: new Date(record.recordAt || record.createdAt),
    })),
    ...posts.map((post) => ({
      type: 'post' as const,
      data: post,
      date: new Date(post.createdAt),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('この記録を削除しますか？')) return

    setDeletingId(recordId)
    try {
      const result = await deleteBonsaiRecord(recordId)
      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' })
      } else {
        router.refresh()
      }
    } catch {
      toast({ title: MSG_BONSAI_DELETE_FAILED, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  if (timelineItems.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <ImageIcon className="w-12 h-12 mx-auto mb-3" />
        <p>まだ記録や投稿がありません</p>
      </div>
    )
  }

  return (
    <>
      <div className="divide-y">
        {timelineItems.map((item) => {
          if (item.type === 'record') {
            const record = item.data
            return (
              <div key={`record-${record.id}`} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-bonsai-green/10 rounded-full flex items-center justify-center">
                    <LeafIcon className="w-5 h-5 text-bonsai-green" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-bonsai-green">成長記録</span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(item.date, { addSuffix: true, locale: ja })}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          disabled={deletingId === record.id}
                          className="ml-auto p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                          title="削除"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {record.content && (
                      <p className="mt-1 text-sm whitespace-pre-wrap">{record.content}</p>
                    )}

                    {record.images.length > 0 && (
                      <div className="mt-2 flex gap-2 flex-wrap">
                        {record.images.map((image) => (
                          <button
                            key={image.id}
                            onClick={() => setSelectedImage(image.url)}
                            className="relative w-20 h-20 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                          >
                            <Image
                              src={image.url}
                              alt="成長記録画像"
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          } else {
            const post = item.data
            return (
              <Link
                key={`post-${post.id}`}
                href={buildPostPath(post.id)}
                className="block p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    {post.user.avatarUrl ? (
                      <Image
                        src={post.user.avatarUrl}
                        alt={post.user.nickname}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">
                          {post.user.nickname.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold truncate">{post.user.nickname}</span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(item.date, { addSuffix: true, locale: ja })}
                      </span>
                    </div>

                    {post.content && (
                      <p className="mt-1 text-sm whitespace-pre-wrap break-words line-clamp-3">
                        {post.content}
                      </p>
                    )}

                    {post.media.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {post.media.slice(0, MAX_POST_IMAGES_FREE).map((media, index) => (
                          <div key={media.id} className="relative w-16 h-16 bg-muted rounded overflow-hidden">
                            {media.type === 'video' ? (
                              <video src={media.url} className="w-full h-full object-cover" />
                            ) : (
                              <Image src={media.url} alt={`投稿画像 ${index + 1}`} fill sizes="64px" className="object-cover" />
                            )}
                            {index === MAX_POST_IMAGES_FREE - 1 && post.media.length > MAX_POST_IMAGES_FREE && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold">
                                +{post.media.length - MAX_POST_IMAGES_FREE}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {post.genres.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {post.genres.map((pg) => (
                          <span
                            key={pg.genreId}
                            className="px-2 py-0.5 text-xs bg-muted rounded-full text-muted-foreground"
                          >
                            {pg.genre.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <HeartIcon className="w-4 h-4" />
                        {post._count.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircleIcon className="w-4 h-4" />
                        {post._count.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          }
        })}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full">
            <Image
              src={selectedImage}
              alt="成長記録画像"
              fill
              sizes="(max-width: 768px) 100vw, 896px"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  )
}
