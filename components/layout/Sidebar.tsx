'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Home as HomeIcon,
  Search as SearchIcon,
  Compass as CompassIcon,
  Bell as BellIcon,
  Bookmark as BookmarkIcon,
  MapPin as MapPinIcon,
  Calendar as CalendarIcon,
  User as UserIcon,
  Settings as SettingsIcon,
  MessageCircle as MessageIcon,
  CalendarPlus as CalendarPlusIcon,
  BarChart3 as BarChartIcon,
  Crown as CrownIcon,
  TreePine as BonsaiIcon,
  Bug as BugIcon,
  Sprout as SproutIcon,
  FlaskConical as FlaskConicalIcon,
  BookOpen as BookOpenIcon,
  LogOut as LogOutIcon,
} from 'lucide-react'
import {
  ROUTE_FEED,
  ROUTE_HOME,
  ROUTE_LOGIN,
  ROUTE_SEARCH,
  ROUTE_EXPLORE,
  ROUTE_SETTINGS,
  ROUTE_SCHEDULED_POSTS,
  ROUTE_PESTICIDES,
  ROUTE_FERTILIZERS,
  ROUTE_HORMONES,
  ROUTE_DICTIONARY,
  ROUTE_NOTIFICATIONS,
  ROUTE_MESSAGES,
  ROUTE_BOOKMARKS,
  ROUTE_BONSAI,
  ROUTE_SHOPS,
  ROUTE_EVENTS,
  ROUTE_ANALYTICS,
} from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'
import { NotificationBadge } from '@/components/notification/NotificationBadge'
import { MessageBadge } from '@/components/message/MessageBadge'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

type NavItem = {
  href: string
  icon: React.FC<{ className?: string }>
  label: string
  testId: string
  premium?: boolean
}

const navItems: NavItem[] = [
  { href: ROUTE_FEED, icon: HomeIcon, label: 'ホーム', testId: 'nav-home' },
  { href: ROUTE_SEARCH, icon: SearchIcon, label: '検索', testId: 'nav-search' },
  { href: ROUTE_EXPLORE, icon: CompassIcon, label: '発見', testId: 'nav-explore' },
  { href: ROUTE_NOTIFICATIONS, icon: BellIcon, label: '通知', testId: 'nav-notifications' },
  { href: ROUTE_MESSAGES, icon: MessageIcon, label: 'メッセージ', testId: 'nav-messages' },
  { href: ROUTE_BOOKMARKS, icon: BookmarkIcon, label: 'ブックマーク', testId: 'nav-bookmarks' },
  { href: ROUTE_BONSAI, icon: BonsaiIcon, label: 'マイ盆栽', testId: 'nav-bonsai' },
  { href: ROUTE_SHOPS, icon: MapPinIcon, label: '盆栽園マップ', testId: 'nav-shops' },
  { href: ROUTE_EVENTS, icon: CalendarIcon, label: 'イベント', testId: 'nav-events' },
]

const premiumNavItems: NavItem[] = [
  { href: ROUTE_SCHEDULED_POSTS, icon: CalendarPlusIcon, label: '予約投稿', testId: 'nav-scheduled', premium: true },
  { href: ROUTE_ANALYTICS, icon: BarChartIcon, label: '投稿分析', testId: 'nav-analytics', premium: true },
]

type SidebarProps = {
  userId?: string
  isPremium?: boolean
  isAdmin?: boolean
  /** ゲストでログインしている場合は「トップページへ」表示・ログアウト後にトップへ遷移 */
  isGuest?: boolean
}

export function Sidebar({ userId, isPremium, isAdmin: _isAdmin, isGuest = false }: SidebarProps) {
  const pathname = usePathname()

  const [home, ...restNav] = navItems
  const allNavItems: NavItem[] = [
    ...(home ? [home] : []),
    ...(userId ? [{ href: buildUserPath(userId), icon: UserIcon, label: 'プロフィール', testId: 'nav-profile' }] : []),
    ...restNav,
    { href: ROUTE_PESTICIDES, icon: BugIcon, label: '農薬・病害虫', testId: 'nav-pesticides' },
    { href: ROUTE_FERTILIZERS, icon: SproutIcon, label: '施肥ガイド', testId: 'nav-fertilizers' },
    { href: ROUTE_HORMONES, icon: FlaskConicalIcon, label: '植物ホルモン', testId: 'nav-hormones' },
    { href: ROUTE_DICTIONARY, icon: BookOpenIcon, label: '盆栽用語辞典', testId: 'nav-dictionary' },
    ...(isPremium ? premiumNavItems : []),
    { href: ROUTE_SETTINGS, icon: SettingsIcon, label: '設定', testId: 'nav-settings' },
  ]

  return (
    <aside aria-label="メインナビゲーション" className="sticky top-0 h-screen w-[260px] hidden lg:flex flex-col border-r border-border/30 bg-gradient-to-b from-card via-card to-muted/30">
      <div className="px-6 pt-7 pb-6">
        <Link href={ROUTE_FEED} className="block">
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={80}
            height={80}
            className="h-16 w-auto dark:invert"
            priority
            unoptimized
          />
        </Link>
      </div>

      <div className="mx-5 brush-divider" />

      <nav aria-label="メインメニュー" className="flex-1 px-3 py-3 overflow-y-auto">
        <ul className="space-y-0.5">
          {allNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-testid={item.testId}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/70 hover:text-foreground hover:bg-muted/60'
                    }`}
                >
                  <div className="relative flex-shrink-0" aria-hidden="true">
                    <Icon className={`w-[19px] h-[19px] transition-transform duration-200 ${!isActive ? 'group-hover:scale-110' : ''
                      }`} />
                    {item.href === ROUTE_NOTIFICATIONS && (
                      <NotificationBadge className="absolute -top-1.5 -right-1.5" />
                    )}
                    {item.href === ROUTE_MESSAGES && (
                      <MessageBadge className="absolute -top-1.5 -right-1.5" />
                    )}
                  </div>
                  <span className={`text-[13px] tracking-wide ${isActive ? 'font-medium' : ''}`}>
                    {item.label}
                  </span>
                  {item.premium && (
                    <CrownIcon className="w-3 h-3 text-muted-foreground ml-auto" aria-hidden="true" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-3 pb-4 space-y-1">
        <div className="mx-2 mb-2 brush-divider" />

        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-[11px] text-muted-foreground tracking-wider">テーマ</span>
          <ThemeToggle />
        </div>

        <button
          onClick={() => signOut({ callbackUrl: isGuest ? ROUTE_HOME : ROUTE_LOGIN })}
          aria-label={isGuest ? 'トップページへ' : 'ログアウト'}
          className="group flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
        >
          <LogOutIcon className="w-[19px] h-[19px] group-hover:scale-110 transition-transform duration-200" />
          <span className="text-[13px] tracking-wide">{isGuest ? 'トップページへ' : 'ログアウト'}</span>
        </button>
      </div>
    </aside>
  )
}
