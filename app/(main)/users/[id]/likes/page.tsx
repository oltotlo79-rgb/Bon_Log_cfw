import { notFound } from 'next/navigation'
import Link from 'next/link'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { buildUserLikesPath, buildUserPath } from '@/lib/constants/path-builders'
import { pageCanonical } from '@/lib/utils/seo'
import { canViewAuthorContent, visiblePostWhere } from '@/lib/services/post-visibility'

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: { nickname: true, isPublic: true, isSuspended: true },
  })

  if (!user) {
    return { title: 'ユーザーが見つかりません' }
  }

  return {
    title: `${user.nickname}のいいね`,
    alternates: { canonical: pageCanonical(buildUserLikesPath(id)) },
    ...((user.isPublic === false || user.isSuspended) && {
      robots: { index: false, follow: false },
    }),
  }
}

export default async function UserLikesPage({ params }: Props) {
  const { id } = await params

  const [session, user] = await Promise.all([
    auth(),
    prisma.user.findUnique({
      where: { id },
      select: { id: true, nickname: true, isPublic: true, isSuspended: true },
    }),
  ])

  if (!user) {
    notFound()
  }

  if (!(await canViewAuthorContent(session?.user?.id, id, user))) {
    notFound()
  }

  // いいね先の投稿は他ユーザー作のため、閲覧者から見える投稿（非表示/非公開/停止を除外）のみに絞る。
  const likes = await prisma.like.findMany({
    where: {
      userId: id,
      postId: { not: null },
      post: visiblePostWhere(session?.user?.id),
    },
    include: {
      post: {
        include: {
          user: {
            select: USER_MINIMAL_SELECT,
          },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: DEFAULT_PAGE_LIMIT,
  })

  type PostType = typeof likes[number]['post']
  const posts = likes
    .map((l: typeof likes[number]) => l.post)
    .filter((p: PostType): p is NonNullable<PostType> => Boolean(p))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={buildUserPath(id)} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">いいねした投稿</h1>
        </div>

        {posts.length > 0 ? (
          <div className="divide-y">
            {posts.map((post: typeof posts[number]) => (
              <div key={post.id} className="p-4">
                <p className="text-sm text-muted-foreground mb-1">
                  {post.user.nickname}
                </p>
                <p className="whitespace-pre-wrap">{post.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(post.createdAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            いいねした投稿がありません
          </p>
        )}
      </div>
    </div>
  )
}
