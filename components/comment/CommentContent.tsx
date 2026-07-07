'use client'

/**
 * @module components/comment/CommentContent
 * コメント本文のメンション・ハッシュタグをリンク化する。
 */

import Link from 'next/link'
import Image from 'next/image'
import { parseContentSegments, type ContentSegment } from '@/lib/mention-utils'
import { buildUserPath, buildSearchPath } from '@/lib/constants/path-builders'

type CommentMedia = {
  id: string
  url: string
  type: string
  sortOrder: number
}

type MentionUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

interface CommentContentProps {
  content: string
  media?: CommentMedia[]
  mentionUsers?: Map<string, MentionUser>
}

export function CommentContent({ content, media, mentionUsers = new Map() }: CommentContentProps) {
  function renderContent(text: string) {
    const segments: ContentSegment[] = parseContentSegments(text)

    return segments.map((segment, i) => {
      switch (segment.type) {
        case 'mention': {
          const user = mentionUsers.get(segment.userId)
          return (
            <Link
              key={i}
              href={buildUserPath(segment.userId)}
              className="text-primary hover:underline font-medium"
            >
              @{user?.nickname || 'unknown'}
            </Link>
          )
        }
        case 'hashtag':
          return (
            <Link
              key={i}
              href={buildSearchPath(segment.tag)}
              className="text-bonsai-green hover:underline"
            >
              {segment.tag}
            </Link>
          )
        default:
          return <span key={i}>{segment.content}</span>
      }
    })
  }

  return (
    <>
      {content && (
        <p className="text-sm mt-1 whitespace-pre-wrap break-words">
          {renderContent(content)}
        </p>
      )}

      {media && media.length > 0 && (
        <div className={`mt-2 grid gap-2 ${media.length === 1 ? '' : 'grid-cols-2'}`}>
          {media.map((m) => (
            <div key={m.id} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
              {m.type === 'video' ? (
                <video
                  src={m.url}
                  controls
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={m.url}
                  alt="コメント画像"
                  fill
                  sizes={media.length === 1 ? '(max-width: 768px) 100vw, 600px' : '(max-width: 768px) 50vw, 300px'}
                  className="object-cover"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
