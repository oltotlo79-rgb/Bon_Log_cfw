import { notFound } from 'next/navigation'

import { Metadata } from 'next'

import { cache, Suspense } from 'react'

import { auth } from '@/lib/auth'

import { getPost as _getPost } from '@/lib/actions/post'

// generateMetadata と Page で同一投稿への呼び出しをリクエスト内 1 回に集約する
const getPost = cache((id: string) => _getPost(id))

import { prisma } from '@/lib/db'

import { CommentSection, CommentSectionSkeleton } from './CommentSection'

import { ViewBeacon } from '@/components/analytics/ViewBeacon'

import { PostCard } from '@/components/post/PostCard'

import { ShareButtons } from '@/components/post/ShareButtons'

import { PostDetailAdUnit } from '@/components/ads'

import Link from 'next/link'

import { ArticleJsonLd } from '@/components/seo/JsonLd'
import { Breadcrumb } from '@/components/common/Breadcrumb'
import { CONTENT_PREVIEW_LENGTH, POST_PREVIEW_LENGTH } from '@/lib/constants/limits'
import { ROUTE_FEED, ROUTE_HOME } from '@/lib/constants/routes'
import { pageCanonical, pageTitle } from '@/lib/utils/seo'
import { buildPostPath, buildUserPath } from '@/lib/constants/path-builders'

/**
 * メタデータ専用の著者公開状態取得。USER_MINIMAL_RELATION は機密の isPublic/isSuspended を
 * 含めない方針のため、noindex 判定はここで別途取得する。React cache() でリクエスト内 1 回に集約。
 */
const getPostAuthorVisibility = cache((userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { isPublic: true, isSuspended: true },
  })
)

type Props = {
  params: Promise<{ id: string }>
}

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
  const mediaUrl = post.media?.[0]?.url
  // 実メディアは縦横比が不定（アバター等のポートレートを 1.91:1 と偽らない）。
  // 寸法を宣言するのは固定サイズの /api/og フォールバックのときだけにする。
  const ogImages = mediaUrl
    ? [{ url: mediaUrl, alt: title }]
    : [{ url: '/api/og', width: 1200, height: 630, alt: title }]
  const canonical = pageCanonical(buildPostPath(id))

  // 非公開 / 停止ユーザーの投稿は sitemap から除外済み。detail page もインデックスさせず整合させる。
  const author = await getPostAuthorVisibility(post.user.id)
  const shouldNoindex = !author || author.isPublic === false || author.isSuspended

  return {
    title: pageTitle(title),
    description: truncated,
    openGraph: {
      type: 'article',
      title,
      description: truncated,
      url: canonical,
      images: ogImages,
      publishedTime: post.createdAt?.toString(),
      authors: [post.user.nickname],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: truncated,
      images: ogImages,
    },
    alternates: {
      canonical,
    },
    ...(shouldNoindex && {
      robots: { index: false, follow: false },
    }),
  }
}

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params
  const [session, postResult] = await Promise.all([auth(), getPost(id)])

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
      )}
      <Breadcrumb
        items={[
          { name: 'ホーム', href: ROUTE_HOME },
          { name: `${post.user.nickname}さんの投稿` },
        ]}
      />
      <ArticleJsonLd
        headline={post.content ? (post.content.length > CONTENT_PREVIEW_LENGTH ? post.content.slice(0, CONTENT_PREVIEW_LENGTH) + '...' : post.content) : '投稿'}
        datePublished={post.createdAt ? new Date(post.createdAt).toISOString() : new Date().toISOString()}
        author={{
          name: post.user.nickname,
          url: pageCanonical(buildUserPath(post.user.id)),
        }}
        url={pageCanonical(buildPostPath(id))}
        image={post.media?.[0]?.url}
        description={post.content ? (post.content.length > POST_PREVIEW_LENGTH ? post.content.slice(0, POST_PREVIEW_LENGTH) + '...' : post.content) : undefined}
      />
    <div className="max-w-2xl mx-auto">
      {/* ページの主題を示す見出し。視覚デザインは PostCard が担うため sr-only にする
          （スクリーンリーダーの起点 + 検索エンジンのトピックシグナル用）。 */}
      <h1 className="sr-only">{post.user.nickname}さんの投稿</h1>
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <Link href={ROUTE_FEED} className="text-sm text-muted-foreground hover:underline">
            &larr; タイムラインに戻る
          </Link>
        </div>
        <PostCard post={post} currentUserId={session?.user?.id} disableNavigation={true} />
        <div className="border-t px-4 py-3">
          <ShareButtons
            url={pageCanonical(buildPostPath(id))}
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
