/**
 * プロフィールタブコンポーネント
 *
 * @module components/user/ProfileTabs
 */

'use client'

import { Fragment } from 'react'

/**
 * Next.js Linkコンポーネント
 * コメント元の投稿へのリンクに使用
 */
import Link from 'next/link'
import { COMMENT_PREVIEW_LENGTH, PROFILE_POSTS_AD_INTERVAL } from '@/lib/constants/limits'

/**
 * 投稿リスト内のフィード広告スロット
 */
import { InFeedAdSlot } from '@/components/ads'

/**
 * Next.js Imageコンポーネント
 * コメントに添付された画像の最適化表示に使用
 */
import Image from 'next/image'

/**
 * shadcn/ui Tabsコンポーネント群
 * タブ切り替えUIを提供
 *
 * - Tabs: タブのコンテナ
 * - TabsList: タブボタンのリスト
 * - TabsTrigger: 個々のタブボタン
 * - TabsContent: タブの内容エリア
 */
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

/**
 * PostCardコンポーネント
 * 投稿を表示するカードコンポーネント
 */
import { PostCard } from '@/components/post/PostCard'

/**
 * date-fns formatDistanceToNow関数
 * 相対時間（例: 5分前）を表示するために使用
 */
import { formatDistanceToNow } from 'date-fns'

/**
 * date-fns 日本語ロケール
 * 日本語での時間表示に使用
 */
import { ja } from 'date-fns/locale'

import type { Post } from '@/components/post/PostCard.types'

/**
 * ユーザーコメントの型
 *
 * @property id - コメントの一意識別子
 * @property content - コメント本文
 * @property createdAt - コメント作成日時
 * @property post - コメント元の投稿情報
 * @property post.id - 投稿ID
 * @property post.content - 投稿本文（nullの場合はメディアのみ投稿）
 * @property media - コメントに添付されたメディア（画像・動画）
 * @property media.id - メディアの一意識別子
 * @property media.url - メディアのURL
 * @property media.type - メディアタイプ（image or video）
 * @property media.sortOrder - メディアの表示順序
 */
type UserComment = {
  id: string
  content: string
  createdAt: Date
  post: { id: string; content: string | null }
  media: { id: string; url: string; type: string; sortOrder: number }[]
}

/**
 * ProfileTabsコンポーネントのprops型
 *
 * @property posts - ユーザーの投稿一覧
 * @property comments - ユーザーのコメント一覧
 * @property currentUserId - 現在ログイン中のユーザーID（任意）
 */
type ProfileTabsProps = {
  posts: Post[]
  comments: UserComment[]
  currentUserId?: string
}

/**
 * プロフィールタブコンポーネント
 *
 * ## 機能
 * - 「投稿」「コメント」の2つのタブを提供
 * - 投稿タブ: PostCardコンポーネントで投稿を表示
 * - コメントタブ: コメント本文、添付メディア、コメント元投稿へのリンクを表示
 * - デフォルトで投稿タブを表示
 *
 * ## UI構成
 * - 上部: タブボタン（投稿/コメント）
 * - 下部: 選択されたタブのコンテンツ
 *
 * @param posts - 投稿一覧
 * @param comments - コメント一覧
 * @param currentUserId - ログイン中のユーザーID
 *
 * @example
 * ```tsx
 * <ProfileTabs
 *   posts={userPosts}
 *   comments={userComments}
 *   currentUserId={session?.user?.id}
 * />
 * ```
 */
export function ProfileTabs({ posts, comments, currentUserId }: ProfileTabsProps) {
  return (
    <div className="bg-card rounded-lg border">
      {/* タブコンテナ（デフォルトで投稿タブを表示） */}
      <Tabs defaultValue="posts">
        {/* タブボタンのリスト */}
        <TabsList className="w-full rounded-none rounded-t-lg border-b bg-transparent p-0 h-auto">
          {/* 投稿タブボタン */}
          <TabsTrigger
            value="posts"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            投稿
          </TabsTrigger>
          {/* コメントタブボタン */}
          <TabsTrigger
            value="comments"
            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
          >
            コメント
          </TabsTrigger>
        </TabsList>

        {/* 投稿タブのコンテンツ */}
        <TabsContent value="posts">
          {posts.length > 0 ? (
            // 投稿がある場合: PostCardコンポーネントで各投稿を表示
            <div className="divide-y">
              {posts.map((post, index) => (
                <Fragment key={post.id}>
                  <PostCard
                    post={post}
                    currentUserId={currentUserId}
                  />
                  <InFeedAdSlot
                    index={index}
                    total={posts.length}
                    interval={PROFILE_POSTS_AD_INTERVAL}
                  />
                </Fragment>
              ))}
            </div>
          ) : (
            // 投稿がない場合: 空メッセージを表示
            <p className="p-8 text-center text-muted-foreground">
              まだ投稿がありません
            </p>
          )}
        </TabsContent>

        {/* コメントタブのコンテンツ */}
        <TabsContent value="comments">
          {comments.length > 0 ? (
            // コメントがある場合: 各コメントを表示
            <div className="divide-y">
              {comments.map((comment) => (
                <div key={comment.id} className="p-4 space-y-2">
                  {/* コメント本文（改行を保持） */}
                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>

                  {/* 添付メディア（画像・動画）の表示 */}
                  {comment.media.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {comment.media.map((m) => (
                        <div key={m.id} className="relative w-20 h-20 rounded overflow-hidden">
                          {m.type === 'image' ? (
                            // 画像の場合: Next.js Imageで最適化表示
                            <Image
                              src={m.url}
                              alt="投稿画像"
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          ) : (
                            // 動画の場合: videoタグで表示
                            <video src={m.url} className="w-full h-full object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* コメントのメタ情報（投稿日時とコメント元投稿へのリンク） */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {/* 相対時間表示（例: 5分前） */}
                    <time>
                      {formatDistanceToNow(new Date(comment.createdAt), {
                        addSuffix: true, // 「〜前」を追加
                        locale: ja, // 日本語表示
                      })}
                    </time>
                    <span>·</span>
                    {/* コメント元の投稿へのリンク */}
                    <Link
                      href={`/posts/${comment.post.id}`}
                      className="hover:underline truncate max-w-[300px]"
                    >
                      {/* 投稿本文がある場合は先頭50文字を表示、ない場合は「投稿への返信」 */}
                      {comment.post.content
                        ? `「${comment.post.content.slice(0, COMMENT_PREVIEW_LENGTH)}${comment.post.content.length > COMMENT_PREVIEW_LENGTH ? '...' : ''}」への返信`
                        : '投稿への返信'}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // コメントがない場合: 空メッセージを表示
            <p className="p-8 text-center text-muted-foreground">
              まだコメントがありません
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
