'use client'

/**
 * @file CommentContent.tsx
 * @description コメント本文コンポーネント（メンション・ハッシュタグのリンク化）
 */

import Link from 'next/link'
import Image from 'next/image'
import { parseContentSegments, type ContentSegment } from '@/lib/mention-utils'

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

/**
 * コメント本文コンポーネント
 *
 * テキストのメンション・ハッシュタグをリンクに変換し、
 * 添付メディア（画像・動画）を表示します。
 */
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
              href={`/users/${segment.userId}`}
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
              href={`/search?q=${encodeURIComponent(segment.tag)}`}
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
