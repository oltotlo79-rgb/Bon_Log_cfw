import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import {
  Database,
  Download,
  ExternalLink,
  HardDrive,
  Info,
  Users,
  FileText,
  MessageSquare,
  Heart,
  Bookmark,
  Bell,
  MapPin,
  Calendar,
  Bug,
  FlaskConical,
} from 'lucide-react'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/actions/admin'
import { getSupabaseDashboardUrl } from '@/lib/env'

export const metadata = {
  title: 'バックアップ管理 - BON-LOG 管理',
}

/**
 * 静的生成を無効化
 */
export const dynamic = 'force-dynamic'

/**
 * バックアップ管理ページコンポーネント
 *
 * @returns バックアップ管理ページのJSX要素
 */
export default async function BackupsPage() {
  // 管理者権限チェック
  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    redirect(ROUTE_LOGIN)
  }

  const supabaseDashboardUrl = getSupabaseDashboardUrl()

  // データベース統計を並列取得
  const [
    userCount,
    postCount,
    commentCount,
    likeCount,
    bookmarkCount,
    notificationCount,
    shopCount,
    eventCount,
    diseasePestCount,
    pesticideCount,
    followCount,
    reportCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.like.count(),
    prisma.bookmark.count(),
    prisma.notification.count(),
    prisma.bonsaiShop.count(),
    prisma.event.count(),
    prisma.diseasePest.count(),
    prisma.pesticide.count(),
    prisma.follow.count(),
    prisma.report.count(),
  ])

  /** テーブル統計の定義 */
  const tableStats = [
    { label: 'ユーザー', count: userCount, icon: Users },
    { label: '投稿', count: postCount, icon: FileText },
    { label: 'コメント', count: commentCount, icon: MessageSquare },
    { label: 'いいね', count: likeCount, icon: Heart },
    { label: 'ブックマーク', count: bookmarkCount, icon: Bookmark },
    { label: '通知', count: notificationCount, icon: Bell },
    { label: 'フォロー', count: followCount, icon: Users },
    { label: '通報', count: reportCount, icon: FileText },
    { label: '盆栽園', count: shopCount, icon: MapPin },
    { label: 'イベント', count: eventCount, icon: Calendar },
    { label: '病害虫', count: diseasePestCount, icon: Bug },
    { label: '農薬', count: pesticideCount, icon: FlaskConical },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HardDrive className="w-7 h-7" />
          バックアップ管理
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          データベース統計とデータエクスポート
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-blue-900 dark:text-blue-100">
              バックアップについて
            </h2>
            <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
              データベースのバックアップはSupabaseダッシュボードで管理されています。
              自動バックアップは毎日実行され、Proプランでは最大7日間のPoint-in-Time Recoveryが利用可能です。
            </p>
            {supabaseDashboardUrl && (
              <a
                href={supabaseDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline mt-3"
              >
                Supabaseダッシュボードを開く
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          データベース統計
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tableStats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <stat.icon className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold">{stat.count.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Download className="w-5 h-5" />
          データエクスポート
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          主要テーブルのデータをCSV形式でエクスポートできます。大量データの場合は時間がかかることがあります。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <a
            href="/api/admin/export/users"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <Users className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">ユーザーデータ</p>
              <p className="text-xs text-muted-foreground">{userCount.toLocaleString()}件</p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground ml-auto" />
          </a>

          <a
            href="/api/admin/export/posts"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <FileText className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">投稿データ</p>
              <p className="text-xs text-muted-foreground">{postCount.toLocaleString()}件</p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground ml-auto" />
          </a>

          <a
            href="/api/admin/export/comments"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <MessageSquare className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">コメントデータ</p>
              <p className="text-xs text-muted-foreground">{commentCount.toLocaleString()}件</p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground ml-auto" />
          </a>

          <a
            href="/api/admin/export/shops"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <MapPin className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">盆栽園データ</p>
              <p className="text-xs text-muted-foreground">{shopCount.toLocaleString()}件</p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground ml-auto" />
          </a>

          <a
            href="/api/admin/export/events"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">イベントデータ</p>
              <p className="text-xs text-muted-foreground">{eventCount.toLocaleString()}件</p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground ml-auto" />
          </a>

          <a
            href="/api/admin/export/pesticides"
            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <FlaskConical className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">農薬データ</p>
              <p className="text-xs text-muted-foreground">{pesticideCount.toLocaleString()}件</p>
            </div>
            <Download className="w-4 h-4 text-muted-foreground ml-auto" />
          </a>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">バックアップ状況</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="text-sm font-medium">自動バックアップ</p>
              <p className="text-xs text-muted-foreground">Supabase管理（毎日実行）</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              有効
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="text-sm font-medium">Point-in-Time Recovery</p>
              <p className="text-xs text-muted-foreground">Supabase Proプラン以上で利用可能</p>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              プランに依存
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
