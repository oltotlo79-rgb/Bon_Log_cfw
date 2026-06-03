import { notFound } from 'next/navigation'
import Link from 'next/link'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { buildUserPostsPath, buildUserPath } from '@/lib/constants/path-builders'
import { pageCanonical } from '@/lib/utils/seo'
import { canViewAuthorContent } from '@/lib/services/post-visibility'

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
    title: `${user.nickname}の投稿`,
    alternates: { canonical: pageCanonical(buildUserPostsPath(id)) },
    ...((user.isPublic === false || user.isSuspended) && {
      robots: { index: false, follow: false },
    }),
  }
}

export default async function UserPostsPage({ params }: Props) {
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

  // プロフィール本体と同じ公開範囲を適用（停止は本人以外不可、非公開はフォロワー/本人のみ）
  if (!(await canViewAuthorContent(session?.user?.id, id, user))) {
    notFound()
  }

  const posts = await prisma.post.findMany({
    where: { userId: id, isHidden: false },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: DEFAULT_PAGE_LIMIT,
  })

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={buildUserPath(id)} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">投稿</h1>
        </div>

        {posts && posts.length > 0 ? (
          <div className="divide-y">
            {posts.map((post: typeof posts[number]) => (
              <div key={post.id} className="p-4">
                <p className="whitespace-pre-wrap">{post.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(post.createdAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            まだ投稿がありません
          </p>
        )}
      </div>
    </div>
  )
}
