import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth, signOut } from '@/lib/auth'
import { isAdmin } from '@/lib/actions/admin'
import { prisma } from '@/lib/db'
import {
  ROUTE_ADMIN,
  ROUTE_ADMIN_ANALYTICS_COHORT,
  ROUTE_ADMIN_ANALYTICS_CONTENT,
  ROUTE_ADMIN_ANNOUNCEMENTS,
  ROUTE_ADMIN_BACKUPS,
  ROUTE_ADMIN_BLACKLIST,
  ROUTE_ADMIN_CONTACT,
  ROUTE_ADMIN_CONTENT_MANAGEMENT,
  ROUTE_ADMIN_EVENTS,
  ROUTE_ADMIN_HIDDEN,
  ROUTE_ADMIN_IP_MANAGEMENT,
  ROUTE_ADMIN_LOGS,
  ROUTE_ADMIN_MAINTENANCE,
  ROUTE_ADMIN_MODERATION_QUEUE,
  ROUTE_ADMIN_MONITORING,
  ROUTE_ADMIN_NG_WORDS,
  ROUTE_ADMIN_PESTICIDE_DATA,
  ROUTE_ADMIN_POSTS,
  ROUTE_ADMIN_PREMIUM,
  ROUTE_ADMIN_REPORTS,
  ROUTE_ADMIN_ROLES,
  ROUTE_ADMIN_SECURITY,
  ROUTE_ADMIN_SEGMENTS,
  ROUTE_ADMIN_SHOP_REQUESTS,
  ROUTE_ADMIN_SHOPS,
  ROUTE_ADMIN_STATS,
  ROUTE_ADMIN_USAGE,
  ROUTE_ADMIN_USERS,
  ROUTE_ADMIN_WARNINGS,
  ROUTE_FEED,
  ROUTE_HOME,
  ROUTE_LOGIN,
} from '@/lib/constants/routes'
import {
  Home as HomeIcon,
  Users as UsersIcon,
  FileText as FileTextIcon,
  AlertTriangle as AlertTriangleIcon,
  Calendar as CalendarIcon,
  MapPin as MapPinIcon,
  ScrollText as ScrollTextIcon,
  ShieldBan as ShieldBanIcon,
  TrendingUp as TrendUpIcon,
  Gauge as GaugeIcon,
  Wrench as WrenchIcon,
  EyeOff as EyeOffIcon,
  MessageSquare as MessageSquareIcon,
  ArrowLeft as ArrowLeftIcon,
  Shield as ShieldIcon,
  Megaphone as MegaphoneIcon,
  BookOpen as BookOpenIcon,
  UserCog as UserCogIcon,
  Lock as LockIcon,
  Database as DatabaseIcon,
  Bug as BugIcon,
  BarChart3 as BarChartIcon,
  Network as NetworkIcon,
  Filter as FilterIcon,
  Sprout as SproutIcon,
  Activity as ActivityIcon,
} from 'lucide-react'

// DB 接続を伴う認可チェックを毎リクエスト実行するため静的生成を無効化する
export const dynamic = 'force-dynamic'

type NavSection = {
  title: string
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[]
}

const navSections: NavSection[] = [
  {
    title: '概要',
    items: [
      { href: ROUTE_ADMIN, label: 'ダッシュボード', icon: HomeIcon },
      { href: ROUTE_ADMIN_STATS, label: '統計情報', icon: TrendUpIcon },
    ],
  },
  {
    title: 'モデレーション',
    items: [
      { href: ROUTE_ADMIN_MODERATION_QUEUE, label: 'モデレーションキュー', icon: ShieldIcon },
      { href: ROUTE_ADMIN_NG_WORDS, label: 'NGワード管理', icon: BugIcon },
      { href: ROUTE_ADMIN_WARNINGS, label: '警告管理', icon: AlertTriangleIcon },
      { href: ROUTE_ADMIN_REPORTS, label: '通報管理', icon: AlertTriangleIcon },
      { href: ROUTE_ADMIN_HIDDEN, label: '非表示コンテンツ', icon: EyeOffIcon },
    ],
  },
  {
    title: 'ユーザー管理',
    items: [
      { href: ROUTE_ADMIN_USERS, label: 'ユーザー管理', icon: UsersIcon },
      { href: ROUTE_ADMIN_IP_MANAGEMENT, label: 'IP管理', icon: NetworkIcon },
      { href: ROUTE_ADMIN_SEGMENTS, label: 'セグメント', icon: FilterIcon },
      { href: ROUTE_ADMIN_BLACKLIST, label: 'ブラックリスト', icon: ShieldBanIcon },
      { href: ROUTE_ADMIN_ROLES, label: 'ロール管理', icon: UserCogIcon },
    ],
  },
  {
    title: 'コンテンツ管理',
    items: [
      { href: ROUTE_ADMIN_POSTS, label: '投稿管理', icon: FileTextIcon },
      { href: ROUTE_ADMIN_EVENTS, label: 'イベント管理', icon: CalendarIcon },
      { href: ROUTE_ADMIN_SHOPS, label: '盆栽園管理', icon: MapPinIcon },
      { href: ROUTE_ADMIN_SHOP_REQUESTS, label: '変更リクエスト', icon: MessageSquareIcon },
      { href: ROUTE_ADMIN_PESTICIDE_DATA, label: '農薬データ管理', icon: SproutIcon },
    ],
  },
  {
    title: '分析・レポート',
    items: [
      { href: ROUTE_ADMIN_ANALYTICS_COHORT, label: 'コホート分析', icon: BarChartIcon },
      { href: ROUTE_ADMIN_ANALYTICS_CONTENT, label: 'コンテンツ分析', icon: BarChartIcon },
    ],
  },
  {
    title: '運用',
    items: [
      { href: ROUTE_ADMIN_ANNOUNCEMENTS, label: 'お知らせ管理', icon: MegaphoneIcon },
      { href: ROUTE_ADMIN_CONTENT_MANAGEMENT, label: 'CMS管理', icon: BookOpenIcon },
      { href: ROUTE_ADMIN_CONTACT, label: 'お問い合わせ', icon: MessageSquareIcon },
      { href: ROUTE_ADMIN_PREMIUM, label: 'プレミアム管理', icon: TrendUpIcon },
    ],
  },
  {
    title: 'システム',
    items: [
      { href: ROUTE_ADMIN_SECURITY, label: 'セキュリティ', icon: LockIcon },
      { href: ROUTE_ADMIN_BACKUPS, label: 'バックアップ', icon: DatabaseIcon },
      { href: ROUTE_ADMIN_USAGE, label: 'サービス使用量', icon: GaugeIcon },
      { href: ROUTE_ADMIN_MONITORING, label: 'システム監視', icon: ActivityIcon },
      { href: ROUTE_ADMIN_MAINTENANCE, label: 'メンテナンス', icon: WrenchIcon },
      { href: ROUTE_ADMIN_LOGS, label: '操作ログ', icon: ScrollTextIcon },
    ],
  },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // users が空＝初期化前/データ消失。誤って管理画面に入れないようサインアウトしてトップへ。
  const userCount = await prisma.user.count()
  if (userCount === 0) {
    await signOut({ redirect: false })
    redirect(ROUTE_HOME)
  }

  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  // isAdmin は毎回 DB を引き直す fresh check。権限剥奪が既存セッションにも即時反映される。
  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    redirect(ROUTE_FEED)
  }

  return (
    <div className="admin-theme min-h-screen bg-muted/30">
      <aside className="fixed top-0 left-0 w-64 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-50 flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <h1 className="text-xl font-bold">BON-LOG 管理</h1>
          <p className="text-sm text-sidebar-foreground/60">管理者ダッシュボード</p>
        </div>

        <nav className="p-4 overflow-y-auto flex-1">
          {navSections.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-auto p-4 border-t border-sidebar-border">
          <Link
            href={ROUTE_FEED}
            className="flex items-center gap-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>サイトに戻る</span>
          </Link>
        </div>
      </aside>

      <main id="main-content" className="ml-64 min-h-screen" tabIndex={-1}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
