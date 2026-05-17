import Link from 'next/link'
import { Heart, MessageSquare, Trophy } from 'lucide-react'

type TopPost = {
  id: string
  content: string | null
  createdAt: Date
  likeCount: number
  commentCount: number
}

type TopPostsListProps = {
  posts: TopPost[]
}

export function TopPostsList({ posts }: TopPostsListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        投稿がありません
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {posts.map((post, index) => (
        <Link
          key={post.id}
          href={`/posts/${post.id}`}
          className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
            index === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' :
            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
            'bg-muted text-muted-foreground'
          }`}>
            {index < 3 ? <Trophy className="w-4 h-4" /> : index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm line-clamp-2">
              {post.content || '(メディア投稿)'}
            </p>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {post.likeCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {post.commentCount}
              </span>
              <span>
                {new Date(post.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <span className="text-lg font-bold text-primary">
              {post.likeCount + post.commentCount}
            </span>
            <p className="text-xs text-muted-foreground">反応</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
