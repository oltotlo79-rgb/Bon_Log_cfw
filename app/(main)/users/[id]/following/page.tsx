import { notFound } from 'next/navigation'
import Link from 'next/link'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { buildUserPath } from '@/lib/constants/path-builders'
import { canViewAuthorContent, visibleUserWhere } from '@/lib/services/post-visibility'

import { UserList } from '@/components/user/UserList'

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
    title: `${user.nickname}がフォロー中`,
    // プロフィール本体 /users/[id] と内容が重複するサブページ。canonical は本体が持つ。
    robots: { index: false, follow: true },
    ...((user.isPublic === false || user.isSuspended) && {
      robots: { index: false, follow: false },
    }),
  }
}

export default async function FollowingPage({ params }: Props) {
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

  const following = await prisma.follow.findMany({
    where: { followerId: id, following: visibleUserWhere(session?.user?.id) },
    include: {
      following: {
        select: USER_MINIMAL_WITH_BIO_SELECT,
      },
    },
    orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
    take: DEFAULT_PAGE_LIMIT,
  })

  const users = following.map((f: typeof following[number]) => ({
    ...f.following,
    avatar_url: f.following.avatarUrl,
  }))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={buildUserPath(id)} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">フォロー中</h1>
        </div>

        <UserList
          users={users}
          emptyMessage="フォロー中のユーザーはいません"
        />
      </div>
    </div>
  )
}
