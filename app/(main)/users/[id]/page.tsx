import { notFound } from 'next/navigation'
import { cache, Suspense } from 'react'
import { Metadata } from 'next'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { isPremiumUser } from '@/lib/premium'
import { ViewBeacon } from '@/components/analytics/ViewBeacon'
import { getFollowRequestStatus } from '@/lib/actions/follow-request'
import { PersonJsonLd } from '@/components/seo/JsonLd'
import { Breadcrumb } from '@/components/common/Breadcrumb'
import { ProfileHeader } from '@/components/user/ProfileHeader'
import { ProfileTabs } from '@/components/user/ProfileTabs'
import { PROFILE_RECENT_POSTS_LIMIT, DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { ROUTE_HOME } from '@/lib/constants/routes'
import { pageCanonical, pageTitle } from '@/lib/utils/seo'
import { buildUserPath } from '@/lib/constants/path-builders'
import { visiblePostWhere, redactNonVisibleNestedPosts } from '@/lib/services/post-visibility'

type Props = {
  params: Promise<{ id: string }>
}

// generateMetadata と Page で同一ユーザーの DB クエリを1回に集約する
const getUserForMetadata = cache(async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: { nickname: true, bio: true, avatarUrl: true, isPublic: true, isSuspended: true },
  })
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  const user = await getUserForMetadata(id)

  if (!user) {
    return { title: 'ユーザーが見つかりません' }
  }

  const title = `${user.nickname}さんのプロフィール`
  const description = user.bio || `${user.nickname}さんのBON-LOGプロフィールページ`
  const ogImage = user.avatarUrl || '/api/og'

  return {
    title: pageTitle(title),
    description,
    openGraph: {
      type: 'profile',
      title,
      description,
      url: pageCanonical(buildUserPath(id)),
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
    alternates: {
      canonical: pageCanonical(buildUserPath(id)),
    },
    // 過去公開 → 非公開 / 停止に変更した URL がインデックスに残るのを防ぐ。
    // 公開アカウントはルートレイアウト側の robots 設定を継承する。
    ...((user.isPublic === false || user.isSuspended) && {
      robots: { index: false, follow: false },
    }),
  }
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params

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
      isSuspended: true,
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

  if (!user) {
    notFound()
  }

  // 停止ユーザーのプロフィールは本人以外には表示しない。
  // metadata の noindex は検索向けに過ぎないため、実描画側でも遮断する。
  if (user.isSuspended && session?.user?.id !== user.id) {
    notFound()
  }

  const userWithCounts = {
    ...user,
    postsCount: user._count.posts,
    followersCount: user._count.followers,
    followingCount: user._count.following,
  }

  const isOwner = session?.user?.id === user.id

  let isFollowing = false
  let isBlocked = false
  let isMuted = false
  let isBlockedByUser = false
  let hasFollowRequest = false

  const premiumPromise = isPremiumUser(id)

  const relationPromise = (session?.user?.id && !isOwner)
    ? Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: id,
          },
        },
      }),
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: session.user.id,
            blockedId: id,
          },
        },
      }),
      prisma.mute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: session.user.id,
            mutedId: id,
          },
        },
      }),
      prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: id,
            blockedId: session.user.id,
          },
        },
      }),
      getFollowRequestStatus(id),
    ])
    : null

  const [isPremium, relationResult] = await Promise.all([premiumPromise, relationPromise])

  if (relationResult) {
    const [follow, block, mute, blockedBy, followRequestStatus] = relationResult
    isFollowing = !!follow
    isBlocked = !!block
    isMuted = !!mute
    isBlockedByUser = !!blockedBy
    hasFollowRequest = followRequestStatus.hasRequest && followRequestStatus.status === 'pending'
  }

  const isPrivateAndRestricted = !user.isPublic && !isOwner && !isFollowing

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

  // 非公開アカウントは本人・フォロワー以外には投稿を出さず制限表示に切り替える
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

  // ブロック / 非公開制限を通過した分岐でのみ beacon を描画する。
  // 計測の write 副作用は render から切り離し client beacon に移譲する。
  const shouldRecordView = !isOwner && !!currentUserId && user.isPublic

  return (
    <>
      {shouldRecordView && <ViewBeacon type="profile" targetUserId={id} />}
      <Breadcrumb
        items={[
          { name: 'ホーム', href: ROUTE_HOME },
          { name: `${user.nickname}さんのプロフィール` },
        ]}
      />
      <PersonJsonLd
        name={user.nickname}
        url={pageCanonical(buildUserPath(user.id))}
        image={user.avatarUrl || undefined}
        description={user.bio || undefined}
        location={user.location || undefined}
      />
    <div className="max-w-2xl mx-auto space-y-6">
      <ProfileHeader
        user={userWithCounts}
        isOwner={isOwner}
        isFollowing={isFollowing}
        isBlocked={isBlocked}
        isMuted={isMuted}
        isPremium={isPremium}
        hasFollowRequest={hasFollowRequest}
      />

      <Suspense fallback={<ProfileTabsSkeleton />}>
        <ProfileTabsSection userId={id} currentUserId={currentUserId} />
      </Suspense>
    </div>
    </>
  )
}

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

// 通常投稿・固定投稿で共有する投稿カードの include 形状
const PROFILE_POST_INCLUDE = {
  user: { select: USER_MINIMAL_SELECT },
  media: { orderBy: { sortOrder: 'asc' } },
  genres: { include: { genre: true } },
  _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
  quotePost: { include: { user: { select: USER_MINIMAL_SELECT } } },
  repostPost: {
    include: {
      user: { select: USER_MINIMAL_SELECT },
      media: { orderBy: { sortOrder: 'asc' } },
    },
  },
} satisfies Prisma.PostInclude

async function ProfileTabsSection({
  userId,
  currentUserId,
}: {
  userId: string
  currentUserId?: string
}) {
  const [rawPosts, comments, profileOwner] = await Promise.all([
    prisma.post.findMany({
      where: { userId, isHidden: false },
      include: PROFILE_POST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PROFILE_RECENT_POSTS_LIMIT,
    }),
    prisma.comment.findMany({
      // コメント先投稿が viewer から不可視（非表示/非公開/停止著者）なら、本文プレビューごと出さない
      where: { userId, deletedAt: null, isHidden: false, post: visiblePostWhere(currentUserId) },
      include: {
        post: { select: { id: true, content: true } },
        media: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: DEFAULT_PAGE_LIMIT,
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { pinnedPostId: true } }),
  ])

  // 引用元・リポスト元の可視性を viewer ごとに再適用する
  const posts = await redactNonVisibleNestedPosts(currentUserId, rawPosts)

  const pinnedPostId = profileOwner?.pinnedPostId ?? null
  // 固定投稿が最近の投稿に無ければ単発取得する（本人の・非表示でないもののみ）
  const pinnedInRecent = pinnedPostId ? posts.find((p: { id: string }) => p.id === pinnedPostId) : undefined
  const pinnedPostRaw = pinnedInRecent
    ?? (pinnedPostId
      ? await prisma.post.findFirst({
          where: { id: pinnedPostId, userId, isHidden: false },
          include: PROFILE_POST_INCLUDE,
        })
      : null)
  const pinnedPost = pinnedInRecent
    ? pinnedInRecent
    : pinnedPostRaw
      ? (await redactNonVisibleNestedPosts(currentUserId, [pinnedPostRaw]))[0] ?? null
      : null

  let likedPostIds: Set<string> = new Set()
  let bookmarkedPostIds: Set<string> = new Set()

  const statusPostIds = [
    ...posts.map((p: { id: string }) => p.id),
    ...(pinnedPost && !pinnedInRecent ? [pinnedPost.id] : []),
  ]

  if (currentUserId && statusPostIds.length > 0) {
    const [userLikes, userBookmarks] = await Promise.all([
      prisma.like.findMany({
        where: { userId: currentUserId, postId: { in: statusPostIds }, commentId: null },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: { userId: currentUserId, postId: { in: statusPostIds } },
        select: { postId: true },
      }),
    ])
    likedPostIds = new Set(userLikes.map((l: { postId: string | null }) => l.postId).filter((id: string | null): id is string => id !== null))
    bookmarkedPostIds = new Set(userBookmarks.map((b: { postId: string }) => b.postId))
  }

  const formatPost = (post: typeof posts[number]) => ({
    ...post,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    genres: post.genres.map((pg: { genre: typeof post.genres[number]['genre'] }) => pg.genre),
    isLiked: likedPostIds.has(post.id),
    isBookmarked: bookmarkedPostIds.has(post.id),
  })

  // 固定投稿を先頭に出し、通常リストからは重複除去する
  const regularFormatted = posts
    .filter((post: { id: string }) => post.id !== pinnedPostId)
    .map(formatPost)
  const formattedPosts = pinnedPost
    ? [{ ...formatPost(pinnedPost), isPinned: true }, ...regularFormatted]
    : regularFormatted

  return (
    <ProfileTabs
      posts={formattedPosts}
      comments={comments}
      currentUserId={currentUserId}
    />
  )
}
