// Client Componentとして宣言 - useStateやuseCallback等のフックを使用するため
'use client'

// React フック
// - useState: コンポーネントの状態管理（投稿リスト、カーソル、ローディング状態）
// - useCallback: コールバック関数のメモ化（不要な再生成を防止）
import { useState, useCallback } from 'react'

// shadcn/ui のボタンコンポーネント - 「さらに読み込む」ボタンに使用
import { Button } from '@/components/ui/button'

// 投稿カードコンポーネント - 個々の投稿を表示
import { PostCard } from '@/components/post/PostCard'

// ブックマーク済み投稿を追加取得するServer Action
import { getBookmarkedPosts } from '@/lib/actions/bookmark'

// Server Action の戻り値の posts 型を直接利用（キャスト不要）
type BookmarkedPost = Awaited<ReturnType<typeof getBookmarkedPosts>>['posts'][number]

// lucide-react のブックマークアイコン - 空状態の表示に使用
import { Bookmark } from 'lucide-react'

// next/image - デコレーション画像の表示に使用
import Image from 'next/image'

type PostUser = {
  id: string              // ユーザーID
  nickname: string        // ニックネーム
  avatarUrl: string | null // アバター画像URL
}

type PostMedia = {
  id: string        // メディアID
  url: string       // メディアURL
  type: string      // メディアタイプ（image/video）
  sortOrder: number // 表示順序
}

type PostGenre = {
  id: string       // ジャンルID
  name: string     // ジャンル名
  category: string // カテゴリ
}

/**
 * 引用元またはリポスト元の投稿情報
 */
type QuotePost = {
  id: string               // 投稿ID
  content: string | null   // 投稿内容
  createdAt: string | Date // 投稿日時
  user: PostUser           // 投稿者情報
}

/**
 * ブックマークリストで表示する投稿の全情報
 */
type Post = {
  id: string                                      // 投稿ID
  content: string | null                          // 投稿内容
  createdAt: string | Date                        // 投稿日時
  user: PostUser                                  // 投稿者情報
  media: PostMedia[]                              // メディア一覧
  genres: PostGenre[]                             // ジャンル一覧
  likeCount: number                               // いいね数
  commentCount: number                            // コメント数
  quotePost?: QuotePost | null                    // 引用元投稿
  repostPost?: (QuotePost & { media: PostMedia[] }) | null // リポスト元投稿
  isLiked?: boolean                               // 現在ユーザーがいいね済みか
  isBookmarked?: boolean                          // 現在ユーザーがブックマーク済みか
}

type BookmarkPostListProps = {
  initialPosts: BookmarkedPost[]         // 初期表示する投稿一覧
  initialNextCursor?: string             // 次ページ取得用カーソル
  currentUserId: string                  // 現在ログイン中のユーザーID
}

/**
 * ブックマーク投稿リストコンポーネント
 *
 *
 * @param initialPosts - 初期表示する投稿一覧
 * @param initialNextCursor - 次ページ取得用カーソル
 * @param currentUserId - 現在ログイン中のユーザーID
 * @returns ブックマーク投稿リストのJSX
 */
export function BookmarkPostList({
  initialPosts,
  initialNextCursor,
  currentUserId,
}: BookmarkPostListProps) {
  // 投稿一覧の状態管理
  const [posts, setPosts] = useState<BookmarkedPost[]>(initialPosts)

  // 次ページ取得用カーソルの状態管理
  const [nextCursor, setNextCursor] = useState<string | undefined>(initialNextCursor)

  // ローディング状態の管理
  const [loading, setLoading] = useState(false)

  /**
   * 追加データ読み込み処理
   *
   */
  const loadMore = useCallback(async () => {
    // カーソルがない、またはローディング中の場合は処理しない
    if (!nextCursor || loading) return

    setLoading(true)

    // Server Actionで追加データを取得
    const result = await getBookmarkedPosts(nextCursor)

    if (result.posts) {
      // 既存の投稿リストに追加データをマージ
      setPosts(prev => [...prev, ...result.posts])
      // 次のカーソルを更新
      setNextCursor(result.nextCursor)
    }

    setLoading(false)
  }, [nextCursor, loading])

  // ブックマークが空の場合の表示
  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <Image src="/images/generated/placeholders/empty-bookmark.webp" alt="" width={192} height={144} className="mx-auto mb-4 opacity-60 empty-state-illustration" />
        <Bookmark className="w-12 h-12 mx-auto text-muted-foreground mb-4" />

        <p className="text-muted-foreground">
          ブックマークした投稿はありません
        </p>

        <p className="text-sm text-muted-foreground mt-2">
          気になる投稿をブックマークして後で見返しましょう
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="divide-y">
        {posts.map((post: Post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
          />
        ))}
      </div>

      {nextCursor && (
        <div className="p-4 text-center border-t">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? '読み込み中...' : 'さらに読み込む'}
          </Button>
        </div>
      )}
    </div>
  )
}
