import { notFound } from 'next/navigation'
import { cache } from 'react'
import Link from 'next/link'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { buildUserPath } from '@/lib/constants/path-builders'
import { canViewAuthorContent, visibleUserWhere } from '@/lib/services/post-visibility'

import { UserList } from '@/components/user/UserList'

const getUser = cache(async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, nickname: true, isPublic: true, isSuspended: true },
  })
})

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params

  const user = await getUser(id)

  if (!user) {
    return { title: 'ユーザーが見つかりません' }
  }

  return {
    title: `${user.nickname}のフォロワー`,
    // プロフィール本体 /users/[id] と内容が重複するサブページ。canonical は本体が持つ。
    robots: { index: false, follow: true },
    ...((user.isPublic === false || user.isSuspended) && {
      robots: { index: false, follow: false },
    }),
  }
}

export default async function FollowersPage({ params }: Props) {
  const { id } = await params

  const [session, user] = await Promise.all([auth(), getUser(id)])

  if (!user) {
    notFound()
  }

  if (!(await canViewAuthorContent(session?.user?.id, id, user))) {
    notFound()
  }

  const followers = await prisma.follow.findMany({
    where: { followingId: id, follower: visibleUserWhere(session?.user?.id) },
    include: {
      follower: {
        select: USER_MINIMAL_WITH_BIO_SELECT,
      },
    },
    orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
    take: DEFAULT_PAGE_LIMIT,
  })

  const users = followers.map((f: typeof followers[number]) => ({
    ...f.follower,
    avatar_url: f.follower.avatarUrl,
  }))

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b">
          <Link href={buildUserPath(id)} className="text-sm text-muted-foreground hover:underline">
            &larr; {user.nickname}のプロフィール
          </Link>
          <h1 className="font-bold text-lg mt-1">フォロワー</h1>
        </div>

        <UserList
          users={users}
          emptyMessage="フォロワーはいません"
        />
      </div>
    </div>
  )
}
