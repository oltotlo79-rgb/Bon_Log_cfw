/** このファイルは盆栽の成長記録と関連する投稿を統合して */

'use client'

// React のフック: 状態管理に使用
import { useState } from 'react'
// Next.js の画像最適化コンポーネント
import Image from 'next/image'
// Next.js のリンクコンポーネント: 投稿詳細へのナビゲーション用
import Link from 'next/link'
// Next.js のルーター: データリフレッシュに使用
import { useRouter } from 'next/navigation'
// 相対時間表示ユーティリティ（date-fns）
import { formatDistanceToNow } from 'date-fns'
// 日本語ロケール
import { ja } from 'date-fns/locale'
// Server Action: 成長記録を削除するサーバーサイド関数
import { Trash2 as TrashIcon, Heart as HeartIcon, MessageCircle as MessageCircleIcon, ImageIcon, Leaf as LeafIcon } from 'lucide-react'
import { deleteBonsaiRecord } from '@/lib/actions/bonsai'
import { useToast } from '@/hooks/use-toast'
import { MSG_BONSAI_DELETE_FAILED } from '@/lib/constants/messages'
import { MAX_POST_IMAGES_FREE } from '@/lib/constants/limits'

/**
 * 成長記録データの型定義
 */
interface BonsaiRecord {
  /** 記録ID */
  id: string
  /** 記録内容（テキスト） */
  content: string | null
  /** 記録日時 */
  recordAt: Date
  /** 作成日時 */
  createdAt: Date
  /** 添付画像のリスト */
  images: { id: string; url: string }[]
}

/**
 * 投稿者情報の型定義
 */
type PostUser = {
  /** ユーザーID */
  id: string
  /** ニックネーム */
  nickname: string
  /** アバター画像URL */
  avatarUrl: string | null
}

/**
 * 投稿メディアの型定義
 */
type PostMedia = {
  /** メディアID */
  id: string
  /** メディアURL */
  url: string
  /** メディアタイプ（image/video） */
  type: string
  /** 表示順序 */
  sortOrder: number
}

/**
 * 投稿ジャンルの型定義
 */
type PostGenre = {
  /** 投稿ID */
  postId: string
  /** ジャンルID */
  genreId: string
  /** ジャンル情報 */
  genre: {
    id: string
    name: string
    category: string
  }
}

/**
 * 投稿データの型定義
 */
interface Post {
  /** 投稿ID */
  id: string
  /** 投稿内容（テキスト） */
  content: string | null
  /** 作成日時 */
  createdAt: string | Date
  /** 投稿者情報 */
  user: PostUser
  /** 添付メディアのリスト */
  media: PostMedia[]
  /** ジャンルのリスト */
  genres: PostGenre[]
  /** 統計情報（いいね数・コメント数） */
  _count: {
    likes: number
    comments: number
  }
}

/**
 * タイムラインアイテムの型定義（成長記録または投稿）
 */
type TimelineItem =
  | { type: 'record'; data: BonsaiRecord; date: Date }
  | { type: 'post'; data: Post; date: Date }

/**
 * BonsaiTimelineコンポーネントのProps型定義
 */
interface BonsaiTimelineProps {
  /** 成長記録のリスト */
  records: BonsaiRecord[]
  /** 関連投稿のリスト */
  posts: Post[]
  /** 現在のユーザーが盆栽の所有者かどうか */
  isOwner: boolean
  /** 現在のユーザーID（オプション） */
  currentUserId?: string
}

/**
 * 盆栽タイムラインコンポーネント
 *
 * 成長記録と投稿を統合してタイムライン形式で表示します。
 * 日付の新しい順にソートされ、それぞれのタイプに応じた
 * 表示形式で描画されます。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.records - 成長記録のリスト
 * @param props.posts - 関連投稿のリスト
 * @param props.isOwner - 所有者かどうか（削除ボタンの表示制御）
 */
export function BonsaiTimeline({ records, posts, isOwner }: BonsaiTimelineProps) {
  // ルーターインスタンス: データリフレッシュに使用
  const router = useRouter()
  const { toast } = useToast()

  /**
   * 削除処理中の記録ID
   * null: 削除処理なし、string: 削除中の記録ID
   */
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /**
   * 拡大表示中の画像URL
   * null: モーダル非表示、string: 表示中の画像URL
   */
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  /**
   * 成長記録と投稿を統合し、日付順でソート
   * 新しいものが上に来るように降順ソート
   */
  const timelineItems: TimelineItem[] = [
    // 成長記録をTimelineItem形式に変換
    ...records.map((record) => ({
      type: 'record' as const,
      data: record,
      date: new Date(record.recordAt || record.createdAt),
    })),
    // 投稿をTimelineItem形式に変換
    ...posts.map((post) => ({
      type: 'post' as const,
      data: post,
      date: new Date(post.createdAt),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  /**
   * 成長記録削除のイベントハンドラ
   *
   * 確認ダイアログを表示し、承認された場合に
   * Server Actionで記録を削除
   *
   * @param recordId - 削除する記録のID
   */
  const handleDeleteRecord = async (recordId: string) => {
    // 削除確認ダイアログ
    if (!confirm('この記録を削除しますか？')) return

    // 削除処理開始
    setDeletingId(recordId)
    try {
      const result = await deleteBonsaiRecord(recordId)
      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' })
      } else {
        // 成功時はページをリフレッシュ
        router.refresh()
      }
    } catch {
      toast({ title: MSG_BONSAI_DELETE_FAILED, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  // タイムラインが空の場合の表示
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
      {/* タイムラインリスト */}
      <div className="divide-y">
        {timelineItems.map((item) => {
          if (item.type === 'record') {
            // 成長記録の表示
            const record = item.data
            return (
              <div key={`record-${record.id}`} className="p-4">
                <div className="flex items-start gap-3">
                  {/* 成長記録アイコン（緑の葉） */}
                  <div className="flex-shrink-0 w-10 h-10 bg-bonsai-green/10 rounded-full flex items-center justify-center">
                    <LeafIcon className="w-5 h-5 text-bonsai-green" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* ヘッダー: ラベルと日時、削除ボタン */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-bonsai-green">成長記録</span>
                      <span className="text-muted-foreground">
                        {/* 相対時間で表示（例: 2時間前） */}
                        {formatDistanceToNow(item.date, { addSuffix: true, locale: ja })}
                      </span>
                      {/* 所有者のみ削除ボタンを表示 */}
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

                    {/* 記録内容テキスト */}
                    {record.content && (
                      <p className="mt-1 text-sm whitespace-pre-wrap">{record.content}</p>
                    )}

                    {/* 添付画像のサムネイル */}
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
            // 投稿の表示
            const post = item.data
            return (
              <Link
                key={`post-${post.id}`}
                href={`/posts/${post.id}`}
                className="block p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex gap-3">
                  {/* 投稿者アバター */}
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
                      // アバターがない場合はイニシャルを表示
                      <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-muted-foreground text-sm">
                          {post.user.nickname.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* 投稿者名と日時 */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-bold truncate">{post.user.nickname}</span>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(item.date, { addSuffix: true, locale: ja })}
                      </span>
                    </div>

                    {/* 投稿内容（3行まで） */}
                    {post.content && (
                      <p className="mt-1 text-sm whitespace-pre-wrap break-words line-clamp-3">
                        {post.content}
                      </p>
                    )}

                    {/* 添付メディアのサムネイル（最大4枚） */}
                    {post.media.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {post.media.slice(0, MAX_POST_IMAGES_FREE).map((media, index) => (
                          <div key={media.id} className="relative w-16 h-16 bg-muted rounded overflow-hidden">
                            {media.type === 'video' ? (
                              <video src={media.url} className="w-full h-full object-cover" />
                            ) : (
                              <Image src={media.url} alt={`投稿画像 ${index + 1}`} fill sizes="64px" className="object-cover" />
                            )}
                            {/* 4枚以上ある場合は残り枚数を表示 */}
                            {index === MAX_POST_IMAGES_FREE - 1 && post.media.length > MAX_POST_IMAGES_FREE && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold">
                                +{post.media.length - MAX_POST_IMAGES_FREE}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ジャンルタグ */}
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

                    {/* いいね・コメント数 */}
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

      {/* 画像拡大モーダル */}
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
