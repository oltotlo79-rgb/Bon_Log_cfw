/**
 * @fileoverview ユーザープロフィールページ
 *
 * このファイルは特定のユーザーのプロフィール情報と最近の投稿を表示するページコンポーネントです。
 *
 * 主な機能:
 * - ユーザーの基本情報（ニックネーム、自己紹介、アバター等）の表示
 * - フォロー数、フォロワー数、投稿数のカウント表示
 * - フォロー/ブロック/ミュート状態の管理
 * - 最近の投稿一覧の表示（最大10件）
 * - いいね/ブックマーク状態の表示
 * - SEO用のメタデータ生成（OGP対応）
 * - プロフィール閲覧のアナリティクス記録
 *
 * @route /users/[id]
 * @param {string} id - 表示対象ユーザーのID
 */

// Next.jsのナビゲーションユーティリティ（404ページへのリダイレクト用）
import { notFound } from 'next/navigation'

// React cache: リクエスト単位でのメモ化（generateMetadata と Page で同じクエリを共有）
import { cache, Suspense } from 'react'

// Next.jsのメタデータ型定義（SEO設定用）
import { Metadata } from 'next'

// NextAuth.jsの認証ヘルパー（現在のセッション取得用）
import { auth } from '@/lib/auth'

// Prismaデータベースクライアント（ユーザー情報取得用）
import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'

// プレミアム会員判定ユーティリティ
import { isPremiumUser } from '@/lib/premium'

import { ViewBeacon } from '@/components/analytics/ViewBeacon'

// フォローリクエスト状態取得用のServer Action
import { getFollowRequestStatus } from '@/lib/actions/follow-request'

// SEO用のJSON-LD構造化データコンポーネント
import { PersonJsonLd } from '@/components/seo/JsonLd'
// パンくずリストUIコンポーネント
import { Breadcrumb } from '@/components/common/Breadcrumb'

// ユーザープロフィールヘッダーコンポーネント（アバター、フォローボタン等）
import { ProfileHeader } from '@/components/user/ProfileHeader'

// プロフィールタブコンポーネント（投稿・コメント切り替え用）
import { ProfileTabs } from '@/components/user/ProfileTabs'
// 制限値定数
import { PROFILE_RECENT_POSTS_LIMIT, DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
// ルート定数
import { BASE_URL } from '@/lib/constants/routes'

/**
 * ページコンポーネントのProps型定義
 * Next.js 15以降ではparamsがPromiseとして渡される
 */
type Props = {
  params: Promise<{ id: string }>
}

/**
 * メタデータ用ユーザー情報のキャッシュ取得。
 * React cache() によりリクエスト単位でメモ化され、
 * generateMetadata と Page で同一ユーザーへの DB クエリが1回に集約される。
 */
const getUserForMetadata = cache(async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: { nickname: true, bio: true, avatarUrl: true },
  })
})

/**
 * ページのメタデータを動的に生成する関数
 *
 * SEOとソーシャルシェアのためのメタデータを生成します。
 * - ページタイトル: 「{ユーザー名}さんのプロフィール」
 * - OGP（Open Graph Protocol）設定
 * - Twitterカード設定
 *
 * @param {Props} props - ページのプロパティ（ユーザーID含む）
 * @returns {Promise<Metadata>} Next.jsのMetadataオブジェクト
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // パラメータからユーザーIDを取得
  const { id } = await params

  // データベースからユーザーの基本情報を取得（キャッシュ済み、Pageコンポーネントと共有）
  const user = await getUserForMetadata(id)

  // ユーザーが存在しない場合のフォールバック
  if (!user) {
    return { title: 'ユーザーが見つかりません' }
  }

  // メタデータ用の値を準備
  const title = `${user.nickname}さんのプロフィール`
  const description = user.bio || `${user.nickname}さんのBON-LOGプロフィールページ`
  const ogImage = user.avatarUrl || '/api/og'

  // OGP・Twitterカードを含むメタデータオブジェクトを返す
  return {
    title,
    description,
    openGraph: {
      type: 'profile',
      title,
      description,
      url: `${BASE_URL}/users/${id}`,
      images: [
        {
          url: ogImage,
          width: 400,
          height: 400,
          alt: `${user.nickname}のアバター`,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [ogImage],
    },
    // 正規URLを指定（重複コンテンツ対策）
    alternates: {
      canonical: `${BASE_URL}/users/${id}`,
    },
  }
}

/**
 * ユーザープロフィールページのメインコンポーネント
 *
 * Server Componentとして動作し、以下の処理を行います:
 * 1. ユーザー情報の取得とフォロー/ブロック状態の確認
 * 2. ブロック関係のチェックと適切なUI表示
 * 3. 最近の投稿取得といいね/ブックマーク状態の反映
 * 4. プロフィール閲覧のアナリティクス記録
 *
 * @param {Props} props - ページのプロパティ
 * @returns {Promise<JSX.Element>} レンダリングするJSX要素
 */
export default async function UserProfilePage({ params }: Props) {
  // URLパラメータからユーザーIDを取得
  const { id } = await params

  // 現在のセッションとユーザー情報を並列取得
  const [session, user] = await Promise.all([
    auth(),
    prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      nickname: true,
      avatarUrl: true,
      headerUrl: true,
      bio: true,
      location: true,
      bonsaiStartYear: true,
      bonsaiStartMonth: true,
      birthDate: true,
      isPublic: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  }),
  ])

  // ユーザーが存在しない場合は404ページを表示
  if (!user) {
    notFound()
  }

  // コンポーネントに渡すためにカウント情報を整形
  const userWithCounts = {
    ...user,
    postsCount: user._count.posts,
    followersCount: user._count.followers,
    followingCount: user._count.following,
  }

  // プロフィールの所有者かどうかを判定
  const isOwner = session?.user?.id === user.id

  // プロフィール閲覧計測は render 中の write 副作用を避けて client beacon に移譲する。
  // ブロック / 非公開判定は Route Handler 側でも再確認するため、ここでは
  // ブロック / 制限解除後に beacon を描画する。

  // フォロー/ブロック/ミュート/フォローリクエスト状態の初期値を設定
  let isFollowing = false      // フォロー中か
  let isBlocked = false        // ブロック中か
  let isMuted = false          // ミュート中か
  let isBlockedByUser = false  // 相手からブロックされているか
  let hasFollowRequest = false // フォローリクエスト送信済みか

  // プレミアム会員状態と関係性チェックを並列取得
  const premiumPromise = isPremiumUser(id)

  // ログイン中かつ他ユーザーのプロフィールを閲覧している場合、関係性を確認
  const relationPromise = (session?.user?.id && !isOwner)
    ? Promise.all([
      // フォロー関係をチェック
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: id,
          },
        },
      }),
      // ブロック関係をチェック（自分が相手をブロックしているか）
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: session.user.id,
            blockedId: id,
          },
        },
      }),
      // ミュート関係をチェック
      prisma.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: session.user.id,
            mutedId: id,
          },
        },
      }),
      // 相手からブロックされているかチェック
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: id,
            blockedId: session.user.id,
          },
        },
      }),
      // 非公開アカウントへのフォローリクエスト状態をチェック
      getFollowRequestStatus(id),
    ])
    : null

  const [isPremium, relationResult] = await Promise.all([premiumPromise, relationPromise])

  if (relationResult) {
    const [follow, block, mute, blockedBy, followRequestStatus] = relationResult
    // クエリ結果をboolean値に変換
    isFollowing = !!follow
    isBlocked = !!block
    isMuted = !!mute
    isBlockedByUser = !!blockedBy
    hasFollowRequest = followRequestStatus.hasRequest && followRequestStatus.status === 'pending'
  }

  // 非公開アカウントの場合、本人またはフォロワー以外には制限されたプロフィールを表示
  const isPrivateAndRestricted = !user.isPublic && !isOwner && !isFollowing

  // ブロック関係にある場合はプロフィールを表示しない
  // セキュリティとプライバシー保護のため、相互にアクセスを制限
  if (isBlocked || isBlockedByUser) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-lg border p-8 text-center">
          <h1 className="text-xl font-bold mb-2">このページは表示できません</h1>
          <p className="text-muted-foreground">
            {isBlocked
              ? 'このユーザーをブロックしています'
              : 'このユーザーからブロックされています'}
          </p>
        </div>
      </div>
    )
  }

  // 非公開アカウントでアクセス制限がある場合、投稿を取得せず制限表示
  if (isPrivateAndRestricted) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <ProfileHeader
          user={{
            ...userWithCounts,
            bio: null,
            location: null,
            bonsaiStartYear: null,
            bonsaiStartMonth: null,
            birthDate: null,
          }}
          isOwner={false}
          isFollowing={false}
          isBlocked={false}
          isMuted={isMuted}
          isPremium={isPremium}
          hasFollowRequest={hasFollowRequest}
        />
        <div className="bg-card rounded-lg border p-8 text-center">
          <h2 className="text-lg font-bold mb-2">このアカウントは非公開です</h2>
          <p className="text-muted-foreground">
            フォローリクエストが承認されると、投稿を閲覧できるようになります。
          </p>
        </div>
      </div>
    )
  }

  const currentUserId = session?.user?.id

  // beacon は ブロック / 非公開制限を通過した分岐でのみ描画する。
  // ここに到達した時点で「公開プロフィール / フォロー済みの非公開」が閲覧可能。
  // Route Handler 側で isSuspended / isPublic を再確認するため、二重に守る。
  const shouldRecordView = !isOwner && !!currentUserId && user.isPublic

  return (
    <>
      {shouldRecordView && <ViewBeacon type="profile" targetUserId={id} />}
      {/* パンくずリスト（UI + JSON-LD） */}
      <Breadcrumb
        items={[
          { name: 'ホーム', href: '/feed' },
          { name: `${user.nickname}さんのプロフィール` },
        ]}
      />
      {/* SEO用のJSON-LD構造化データ（Person） */}
      <PersonJsonLd
        name={user.nickname}
        url={`${BASE_URL}/users/${user.id}`}
        image={user.avatarUrl || undefined}
        description={user.bio || undefined}
        location={user.location || undefined}
      />
    <div className="max-w-2xl mx-auto space-y-6">
      {/* プロフィールヘッダー（アバター、カバー画像、フォローボタン等） */}
      <ProfileHeader
        user={userWithCounts}
        isOwner={isOwner}
        isFollowing={isFollowing}
        isBlocked={isBlocked}
        isMuted={isMuted}
        isPremium={isPremium}
        hasFollowRequest={hasFollowRequest}
      />

      {/* 投稿・コメントタブ（ストリーミング） */}
      <Suspense fallback={<ProfileTabsSkeleton />}>
        <ProfileTabsSection userId={id} currentUserId={currentUserId} />
      </Suspense>
    </div>
    </>
  )
}

/**
 * プロフィールタブのスケルトン表示
 */
function ProfileTabsSkeleton() {
  return (
    <div className="bg-card rounded-lg border p-4 space-y-4">
      <div className="flex gap-4 border-b pb-2">
        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
        <div className="h-8 w-20 bg-muted animate-pulse rounded" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted animate-pulse rounded-full" />
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-4 w-full bg-muted animate-pulse rounded" />
          <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  )
}

/**
 * 投稿・コメントデータを非同期で取得してProfileTabsに渡すServer Component
 */
async function ProfileTabsSection({
  userId,
  currentUserId,
}: {
  userId: string
  currentUserId?: string
}) {
  // 最近の投稿とコメントを並列取得
  const [posts, comments] = await Promise.all([
    prisma.post.findMany({
      where: { userId },
      include: {
        user: {
          select: USER_MINIMAL_SELECT,
        },
        media: {
          orderBy: { sortOrder: 'asc' },
        },
        genres: {
          include: {
            genre: true,
          },
        },
        _count: {
          select: { likes: true, comments: { where: { deletedAt: null } } },
        },
        quotePost: {
          include: {
            user: {
              select: USER_MINIMAL_SELECT,
            },
          },
        },
        repostPost: {
          include: {
            user: {
              select: USER_MINIMAL_SELECT,
            },
            media: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: PROFILE_RECENT_POSTS_LIMIT,
    }),
    prisma.comment.findMany({
      where: { userId, deletedAt: null, isHidden: false },
      include: {
        post: { select: { id: true, content: true } },
        media: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: DEFAULT_PAGE_LIMIT,
    }),
  ])

  // いいね/ブックマーク状態を取得
  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  if (currentUserId && posts.length > 0) {
    const postIds = posts.map((p: { id: string }) => p.id)
    const [userLikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
          commentId: null,
        },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: {
          userId: currentUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      }),
    ])
    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
  }

  const formattedPosts = posts.map((post: typeof posts[number]) => ({
    ...post,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    genres: post.genres.map((pg: { genre: typeof post.genres[number]['genre'] }) => pg.genre),
    isLiked: likedPostIds.has(post.id),
    isBookmarked: bookmarkedPostIds.has(post.id),
  }))

  return (
    <ProfileTabs
      posts={formattedPosts}
      comments={comments}
      currentUserId={currentUserId}
    />
  )
}
