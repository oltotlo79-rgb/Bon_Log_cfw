/**
 * 引用投稿コンポーネント
 *
 * @module components/post/QuotedPost
 */

/**
 * Next.js Imageコンポーネント
 * アバター画像の最適化と遅延読み込みを提供
 */
import { memo } from 'react'
import Image from 'next/image'

/**
 * Next.js Linkコンポーネント
 * 元の投稿詳細ページへのクライアントサイドナビゲーション
 */
import Link from 'next/link'

/**
 * date-fns: 日付操作ライブラリ
 * formatDistanceToNow: 現在時刻からの経過時間を計算
 */
import { formatDistanceToNow } from 'date-fns'

/**
 * date-fns 日本語ロケール
 * 「3 hours ago」→「3時間前」のように日本語化
 */
import { ja } from 'date-fns/locale'

/**
 * QuotedPostコンポーネントのProps型
 *
 * @property post - 引用元の投稿情報
 */
type QuotedPostProps = {
  post: {
    /** 投稿ID */
    id: string
    /** 投稿本文（nullの場合もある） */
    content: string | null
    /** 投稿日時（ISO文字列またはDateオブジェクト） */
    createdAt: string | Date
    /** 投稿者情報 */
    user: {
      /** ユーザーID */
      id: string
      /** 表示名（ニックネーム） */
      nickname: string
      /** アバター画像URL（未設定の場合null） */
      avatarUrl: string | null
    }
  }
}

/**
 * 引用投稿コンポーネント
 *
 * ## 機能
 * - 引用元投稿のコンパクトな表示
 * - ユーザー情報と投稿時間の表示
 * - 本文の3行省略表示
 * - クリックで元の投稿に遷移
 *
 * ## 表示内容
 * - ユーザーアバター（20x20px）
 * - ニックネーム
 * - 相対時間表示
 * - 投稿本文（最大3行、超過分は省略）
 *
 * @param post - 引用元の投稿データ
 *
 * @example
 * ```tsx
 * <QuotedPost
 *   post={{
 *     id: 'post123',
 *     content: '引用元の投稿本文',
 *     createdAt: '2024-01-15T10:00:00Z',
 *     user: {
 *       id: 'user456',
 *       nickname: '盆栽太郎',
 *       avatarUrl: '/avatar.jpg',
 *     },
 *   }}
 * />
 * ```
 */
export const QuotedPost = memo(function QuotedPost({ post }: QuotedPostProps) {

  /**
   * 相対時間表示
   *
   * formatDistanceToNow: 現在時刻からの経過時間を計算
   * - addSuffix: 「前」を付加（「3時間前」のように）
   * - locale: ja を指定して日本語化
   */
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  return (
    <Link
      href={`/posts/${post.id}`}
      className="block border rounded-lg p-3 hover:bg-muted/50 transition-colors"
    >
      {/* ユーザー情報 */}
      <div className="flex items-center gap-2">
        {/* アバター */}
        <div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex-shrink-0">
          {post.user.avatarUrl ? (
            /**
             * アバター画像がある場合
             * Next.js Imageで最適化
             */
            <Image
              src={post.user.avatarUrl}
              alt={post.user.nickname}
              width={20}
              height={20}
              sizes="20px"
              className="object-cover w-full h-full"
            />
          ) : (
            /**
             * アバター画像がない場合
             * ニックネームの頭文字を表示
             */
            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
              {post.user.nickname.charAt(0)}
            </div>
          )}
        </div>

        {/* ニックネーム */}
        <span className="text-sm font-medium truncate">{post.user.nickname}</span>

        {/* 投稿時間 */}
        <span className="text-xs text-muted-foreground">{timeAgo}</span>
      </div>

      {/* 投稿本文 */}
      {post.content && (
        /**
         * line-clamp-3: 3行で省略
         * whitespace-pre-wrap: 改行を保持
         */
        <p className="text-sm mt-2 line-clamp-3 whitespace-pre-wrap">{post.content}</p>
      )}
    </Link>
  )
})
