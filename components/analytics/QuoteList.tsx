import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buildPostPath } from '@/lib/constants/path-builders'
import { Heart, MessageSquare } from 'lucide-react'
import { QUOTE_DISPLAY_LIMIT } from '@/lib/constants/limits'

type Quote = {
  id: string
  content: string | null
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  originalPostId: string | null
  originalContent: string | null
  likeCount: number
  commentCount: number
  createdAt: Date
}

type QuoteListProps = {
  quotes: Quote[]
}

function formatRelativeTime(date: Date) {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '今日'
  if (days === 1) return '昨日'
  if (days < 7) return `${days}日前`
  if (days < 30) return `${Math.floor(days / 7)}週間前`
  return `${Math.floor(days / 30)}ヶ月前`
}

export function QuoteList({ quotes }: QuoteListProps) {
  if (quotes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        引用された投稿はありません
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto">
      {quotes.slice(0, QUOTE_DISPLAY_LIMIT).map((quote) => (
        <Link
          key={quote.id}
          href={buildPostPath(quote.id)}
          className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={quote.user.avatarUrl || undefined} alt={quote.user.nickname} />
              <AvatarFallback>{quote.user.nickname[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium truncate">{quote.user.nickname}</span>
                <span className="text-muted-foreground text-xs">
                  {formatRelativeTime(quote.createdAt)}
                </span>
              </div>
              {quote.content && (
                <p className="text-sm line-clamp-2 mt-1">{quote.content}</p>
              )}
              {quote.originalContent && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                  <span className="font-medium">引用元:</span> {quote.originalContent}
                </div>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  {quote.likeCount}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {quote.commentCount}
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
