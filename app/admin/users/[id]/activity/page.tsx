/**
 * @file 管理者用ユーザーアクティビティタイムラインページ
 * @description 特定ユーザーの全アクティビティ（投稿、コメント、いいね、フォロー、ログイン）を
 *              時系列で表示する管理者ページ。不審行動の検知結果も合わせて表示する。
 * @route /admin/users/[id]/activity
 */

import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  FileText,
  MessageSquare,
  Heart,
  UserPlus,
  Monitor,
  AlertTriangle,
  User,
} from 'lucide-react'
import { getUserActivity, detectSuspiciousBehavior } from '@/lib/actions/admin/activity'
import { getAdminUserDetail } from '@/lib/actions/admin/users'

/**
 * ページコンポーネントのProps型定義
 */
type Props = {
  params: Promise<{ id: string }>
}

/**
 * 動的メタデータ生成関数
 */
export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const result = await getAdminUserDetail(id)

  // 管理画面は検索エンジンに公開しない
  const robots = { index: false, follow: false } as const

  if ('error' in result || !result.user) {
    return { title: 'ユーザーが見つかりません - BON-LOG 管理', robots }
  }

  return {
    title: `${result.user.nickname} - アクティビティ - BON-LOG 管理`,
    robots,
  }
}

/** アクティビティタイプに対応するアイコンを返す */
function ActivityIcon({ type }: { type: string }) {
  const iconClass = 'w-4 h-4'
  switch (type) {
    case 'post':
      return <FileText className={iconClass} />
    case 'comment':
      return <MessageSquare className={iconClass} />
    case 'like':
      return <Heart className={iconClass} />
    case 'follow':
      return <UserPlus className={iconClass} />
    case 'login':
      return <Monitor className={iconClass} />
    default:
      return <FileText className={iconClass} />
  }
}

/** アクティビティタイプに対応する背景色を返す */
function getActivityColor(type: string): string {
  switch (type) {
    case 'post':
      return 'bg-blue-100 text-blue-600'
    case 'comment':
      return 'bg-green-100 text-green-600'
    case 'like':
      return 'bg-pink-100 text-pink-600'
    case 'follow':
      return 'bg-purple-100 text-purple-600'
    case 'login':
      return 'bg-gray-100 text-gray-600'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

/** 不審行動フラグのラベル */
function getSuspiciousLabel(type: string): string {
  switch (type) {
    case 'mass_likes':
      return '大量いいね'
    case 'mass_posts':
      return '大量投稿'
    case 'many_reports':
      return '多数の通報'
    case 'mass_follows':
      return '大量フォロー'
    default:
      return '不審行動'
  }
}

/**
 * 管理者用ユーザーアクティビティタイムラインページ
 */
export default async function AdminUserActivityPage({ params }: Props) {
  const { id } = await params

  const [userResult, activityResult, suspiciousResult] = await Promise.all([
    getAdminUserDetail(id),
    getUserActivity(id, { limit: 50 }),
    detectSuspiciousBehavior(id),
  ])

  if ('error' in userResult || !userResult.user) {
    notFound()
  }

  const { user } = userResult
  const activities = 'activities' in activityResult ? activityResult.activities : []
  const flags = 'flags' in suspiciousResult ? suspiciousResult.flags : []
  const isSuspicious = 'isSuspicious' in suspiciousResult ? suspiciousResult.isSuspicious : false

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/users/${id}`}
          className="p-2 hover:bg-muted rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">アクティビティタイムライン</h1>
      </div>

      {/* ユーザー情報ヘッダー */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.nickname}
              width={56}
              height={56}
              className="rounded-full"
            />
          ) : (
            <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center">
              <User className="w-7 h-7 text-muted-foreground" />
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold">{user.nickname}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          {user.isSuspended && (
            <span className="ml-auto px-3 py-1 text-xs bg-destructive/10 text-destructive rounded-full font-medium">
              停止中
            </span>
          )}
        </div>
      </div>

      {/* 不審行動フラグ */}
      {isSuspicious && flags.length > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="font-semibold text-destructive">不審行動を検知</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {flags.map((flag: { type: string; value: number; threshold: number }, index: number) => (
              <span
                key={index}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-destructive/10 text-destructive rounded-full font-medium"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {getSuspiciousLabel(flag.type)}: {flag.value} (閾値: {flag.threshold})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* アクティビティタイムライン */}
      <div className="bg-card rounded-lg border">
        <h3 className="px-4 py-3 font-semibold border-b">
          アクティビティ ({activities.length}件)
        </h3>

        {activities.length > 0 ? (
          <div className="relative">
            {/* タイムラインの線 */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border" />

            <div className="divide-y">
              {activities.map((activity: { type: string; id: string; description: string; createdAt: Date }) => (
                <div key={`${activity.type}-${activity.id}`} className="relative flex items-start gap-4 p-4 pl-4">
                  {/* アイコン */}
                  <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${getActivityColor(activity.type)}`}>
                    <ActivityIcon type={activity.type} />
                  </div>

                  {/* コンテンツ */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.createdAt).toLocaleString('ja-JP')}
                    </p>
                  </div>

                  {/* タイプラベル */}
                  <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full ${getActivityColor(activity.type)}`}>
                    {activity.type === 'post' ? '投稿' :
                     activity.type === 'comment' ? 'コメント' :
                     activity.type === 'like' ? 'いいね' :
                     activity.type === 'follow' ? 'フォロー' :
                     'ログイン'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            アクティビティがありません
          </p>
        )}
      </div>
    </div>
  )
}
