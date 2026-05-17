/**
 * @file 投稿詳細ページ
 * @description 個別の投稿とそのコメントを表示するページ
 *
 * このファイルは[id]動的ルートパラメータを使用して、
 * 特定の投稿の詳細情報を表示します。
 *
 * @features
 * - 投稿内容の詳細表示（テキスト、画像、動画）
 * - 動的OGP/メタデータ生成（SNSシェア対応）
 * - コメントスレッド表示
 * - ソーシャルシェアボタン
 * - 広告バナー表示
 * - 投稿閲覧の分析記録
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes
 */

import { notFound } from 'next/navigation'

import { Metadata } from 'next'

// React cache: リクエスト単位でのメモ化（generateMetadata と Page で同じクエリを共有）
import { cache, Suspense } from 'react'

import { auth } from '@/lib/auth'

import { getPost as _getPost } from '@/lib/actions/post'

/**
 * リクエスト単位でメモ化された投稿取得。
 * React cache() により generateMetadata と Page で同一投稿への呼び出しが1回に集約される。
 */
const getPost = cache((id: string) => _getPost(id))

import { getComments, getCommentCount } from '@/lib/actions/comment'
import { prisma } from '@/lib/db'

import { ViewBeacon } from '@/components/analytics/ViewBeacon'

import { PostCard } from '@/components/post/PostCard'

import { ShareButtons } from '@/components/post/ShareButtons'

import { CommentThread } from '@/components/comment'

import { PostDetailAdUnit } from '@/components/ads'

import Link from 'next/link'

import { ArticleJsonLd } from '@/components/seo/JsonLd'
import { Breadcrumb } from '@/components/common/Breadcrumb'
import { CONTENT_PREVIEW_LENGTH, POST_PREVIEW_LENGTH } from '@/lib/constants/limits'
import { BASE_URL, ROUTE_FEED } from '@/lib/constants/routes'

/**
 * ページパラメータの型定義
 * Next.js 15以降ではparamsはPromiseとして渡される
 */
type Props = {
  params: Promise<{ id: string }>
}

/**
 * 動的メタデータ生成関数
 *
 * 投稿内容に基づいてOGP（Open Graph Protocol）メタデータを動的に生成します。
 * これによりSNSでシェアされた際に、投稿内容のプレビューが正しく表示されます。
 *
 * 生成されるメタデータ:
 * - title: 投稿者名を含むタイトル
 * - description: 投稿内容の先頭100文字
 * - OpenGraph: 記事タイプ、画像、公開日時
 * - Twitter Card: 大きな画像付きカード形式
 *
 * @param params - 動的ルートパラメータ（投稿ID）
 * @returns メタデータオブジェクト
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const result = await getPost(id)

  if (!result.success || !result.data) {
    return { title: '投稿が見つかりません' }
  }

  const post = result.data.post
  const content = post.content || '投稿'
  const truncated = content.length > CONTENT_PREVIEW_LENGTH ? content.slice(0, CONTENT_PREVIEW_LENGTH) + '...' : content
  const title = `${post.user.nickname}さんの投稿`
  const ogImage = post.media?.[0]?.url || '/api/og'

  return {
    title,
    description: truncated,
    openGraph: {
      type: 'article',
      title,
      description: truncated,
      url: `${BASE_URL}/posts/${id}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      publishedTime: post.createdAt?.toString(),  // 投稿日時
      authors: [post.user.nickname],              // 投稿者名
    },
    twitter: {
      card: 'summary_large_image',  // 大きな画像付きカード形式
      title,
      description: truncated,
      images: [ogImage],
    },    alternates: {
      canonical: `${BASE_URL}/posts/${id}`,
    },
  }
}

/**
 * コメントセクションコンポーネント
 * Suspenseでラップして非同期に読み込むことで、投稿本体を先に表示する
 */
async function CommentSection({ postId, currentUserId }: { postId: string; currentUserId?: string }) {
  const [commentsResult, countResult] = await Promise.all([
    getComments(postId),
    getCommentCount(postId),
  ])

  let mutedThreadIds: string[] = []
  if (currentUserId && commentsResult.comments && commentsResult.comments.length > 0) {
    const commentIds = commentsResult.comments.map((c: { id: string }) => c.id)
    const mutes = await prisma.commentThreadMute.findMany({
      where: {
        userId: currentUserId,
        commentId: { in: commentIds },
      },
      select: { commentId: true },
    })
    mutedThreadIds = mutes.map((m: { commentId: string }) => m.commentId)
  }

  return (
    <CommentThread
      postId={postId}
      comments={commentsResult.comments || []}
      nextCursor={commentsResult.nextCursor}
      currentUserId={currentUserId}
      commentCount={countResult.count}
      mutedThreadIds={mutedThreadIds}
    />
  )
}

/**
 * コメントセクションのローディングフォールバック
 */
function CommentSectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 w-32 bg-muted rounded" />
      <div className="h-20 bg-muted rounded" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * 投稿詳細ページコンポーネント
 *
 * 個別の投稿とそのコメントを表示するServer Componentです。
 * 投稿本体を先に表示し、コメントセクションはSuspenseで非同期に読み込みます。
 *
 * @param params - 動的ルートパラメータ（投稿ID）
 * @returns 投稿詳細ページのJSX要素
 */
export default async function PostDetailPage({ params }: Props) {  const { id } = await params  const session = await auth()  const postResult = await getPost(id)

  if (!postResult.success || !postResult.data) {
    notFound()
  }

  const post = postResult.data.post

  // 投稿閲覧の計測は render の write 副作用を避けるため client beacon に切り出している。
  // 集計は Route Handler 側で auth / 閲覧権限 / dedupe を再確認した上で行う。
  const isSelfView = session?.user?.id === post.user.id

  return (
    <>
      {!isSelfView && session?.user?.id && (
        <ViewBeacon type="post" postId={post.id} targetUserId={post.user.id} />
      )}      <Breadcrumb
        items={[
          { name: 'ホーム', href: ROUTE_FEED },
          { name: 'タイムライン', href: ROUTE_FEED },
          { name: `${post.user.nickname}さんの投稿` },
        ]}
      />      <ArticleJsonLd
        headline={post.content ? (post.content.length > CONTENT_PREVIEW_LENGTH ? post.content.slice(0, CONTENT_PREVIEW_LENGTH) + '...' : post.content) : '投稿'}
        datePublished={post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString()}
        author={{
          name: post.user.nickname,
          url: `${BASE_URL}/users/${post.user.id}`,
        }}
        url={`${BASE_URL}/posts/${id}`}
        image={post.media?.[0]?.url}
        description={post.content ? (post.content.length > POST_PREVIEW_LENGTH ? post.content.slice(0, POST_PREVIEW_LENGTH) + '...' : post.content) : undefined}
      />
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <Link href={ROUTE_FEED} className="text-sm text-muted-foreground hover:underline">
            &larr; タイムラインに戻る
          </Link>
        </div>
        <PostCard post={post} currentUserId={session?.user?.id} disableNavigation={true} />
        <div className="border-t px-4 py-3">
          <ShareButtons
            url={`${BASE_URL}/posts/${id}`}
            title={`${post.user.nickname}さんの投稿 | BON-LOG`}
            text={post.content ? (post.content.length > CONTENT_PREVIEW_LENGTH ? post.content.slice(0, CONTENT_PREVIEW_LENGTH) + '...' : post.content) : ''}
          />
        </div>
        <div className="border-t p-4 flex justify-center">
          <PostDetailAdUnit />
        </div>
        <div className="border-t p-4">
          <Suspense fallback={<CommentSectionSkeleton />}>
            <CommentSection postId={id} currentUserId={session?.user?.id} />
          </Suspense>
        </div>
      </div>
    </div>
    </>
  )
}
