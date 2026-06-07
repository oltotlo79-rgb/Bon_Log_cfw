import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Calendar, ChevronRight, Mail, User } from 'lucide-react'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getAdminUserDetail } from '@/lib/actions/admin/users'
import { prisma } from '@/lib/db'
import { UserDetailActions } from './UserDetailActions'
import { ADMIN_USER_RECENT_POSTS_LIMIT, ADMIN_USER_RECENT_ACTIVITY_LIMIT } from '@/lib/constants/limits'
import { buildPostPath, buildUserPath } from '@/lib/constants/path-builders'

type Props = {
  /** URLパラメータ（ユーザーID） */
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const result = await getAdminUserDetail(id)

  // 管理画面は検索エンジンに公開しない
  const robots = { index: false, follow: false } as const

  if ('error' in result || !result.user) {
    return { title: 'ユーザーが見つかりません - BON-LOG 管理', robots }
  }

  return {
    title: `${result.user.nickname} - ユーザー詳細 - BON-LOG 管理`,
    robots,
  }
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params
  const result = await getAdminUserDetail(id)

  if ('error' in result || !result.user) {
    notFound()
  }

  const { user, reportCount } = result

  // 最近の投稿
  const recentPosts = await prisma.post.findMany({
    where: { userId: id },
    select: {
      id: true,
      content: true,
      createdAt: true,
      _count: {
        select: { likes: true, comments: { where: { deletedAt: null } } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_USER_RECENT_POSTS_LIMIT,
  })

  // このユーザーに対する通報
  const reportsAgainstUser = await prisma.report.findMany({
    where: {
      OR: [
        { targetType: 'user', targetId: id },
        {
          targetType: 'post',
          targetId: {
            in: (
              await prisma.post.findMany({
                where: { userId: id },
                select: { id: true },
              })
            ).map((p: { id: string }) => p.id),
          },
        },
      ],
    },
    include: {
      reporter: {
        select: { id: true, nickname: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_USER_RECENT_ACTIVITY_LIMIT,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/users"
          className="p-2 hover:bg-muted rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">ユーザー詳細</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-start gap-4">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.nickname}
                  width={80}
                  height={80}
                  className="rounded-full"
                />
              ) : (
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{user.nickname}</h2>
                  {user.isSuspended ? (
                    <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                      停止中
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                      アクティブ
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>{user.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>登録日: {new Date(user.createdAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                  {user.isSuspended && user.suspendedAt && (
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="w-4 h-4" />
                      <span>停止日: {new Date(user.suspendedAt).toLocaleDateString('ja-JP')}</span>
                    </div>
                  )}
                </div>

                {user.bio && (
                  <p className="mt-3 text-sm">{user.bio}</p>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-4 text-center border-t pt-4">
              <div>
                <p className="text-2xl font-bold">{user._count.posts}</p>
                <p className="text-xs text-muted-foreground">投稿</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{user._count.comments}</p>
                <p className="text-xs text-muted-foreground">コメント</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{user._count.followers}</p>
                <p className="text-xs text-muted-foreground">フォロワー</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{user._count.following}</p>
                <p className="text-xs text-muted-foreground">フォロー中</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border">
            <h3 className="px-4 py-3 font-semibold border-b">最近の投稿</h3>
            {recentPosts.length > 0 ? (
              <div className="divide-y">
                {recentPosts.map((post: typeof recentPosts[number]) => (
                  <div key={post.id} className="p-4">
                    <p className="text-sm line-clamp-2">{post.content || '（テキストなし）'}</p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{new Date(post.createdAt).toLocaleString('ja-JP')}</span>
                      <span>いいね: {post._count.likes}</span>
                      <span>コメント: {post._count.comments}</span>
                      <Link
                        href={buildPostPath(post.id)}
                        className="text-primary hover:underline"
                      >
                        詳細を見る
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 text-center text-muted-foreground">投稿がありません</p>
            )}
          </div>

          {reportsAgainstUser.length > 0 && (
            <div className="bg-card rounded-lg border">
              <h3 className="px-4 py-3 font-semibold border-b flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                このユーザーへの通報 ({reportCount}件)
              </h3>
              <div className="divide-y">
                {reportsAgainstUser.map((report: typeof reportsAgainstUser[number]) => (
                  <div key={report.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{report.reason}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({report.targetType === 'user' ? 'ユーザー' : '投稿'})
                        </span>
                      </div>
                      <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                        {report.status === 'pending' ? '未対応' :
                         report.status === 'reviewed' ? '確認済み' :
                         report.status === 'resolved' ? '対応完了' : '却下'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      通報者: {report.reporter.nickname} ・ {new Date(report.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                    {report.description && (
                      <p className="mt-2 text-sm text-muted-foreground">{report.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card rounded-lg border p-4">
            <h3 className="font-semibold mb-4">アクション</h3>
            <UserDetailActions
              userId={user.id}
              isSuspended={user.isSuspended || false}
              nickname={user.nickname}
            />
          </div>

          <div className="bg-card rounded-lg border p-4">
            <h3 className="font-semibold mb-4">クイックリンク</h3>
            <div className="space-y-2">
              <Link
                href={buildUserPath(user.id)}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted rounded-lg"
              >
                公開プロフィールを見る <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
              <Link
                href={`/admin/posts?search=${encodeURIComponent(user.nickname)}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted rounded-lg"
              >
                このユーザーの投稿を管理 <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
              <Link
                href={`/admin/reports?userId=${user.id}`}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted rounded-lg"
              >
                関連する通報を見る <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
