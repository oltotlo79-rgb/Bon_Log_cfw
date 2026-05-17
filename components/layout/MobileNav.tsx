'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home as HomeIcon,
  Search as SearchIcon,
  Bell as BellIcon,
  MessageCircle as MessageIcon,
  MoreVertical as MoreIcon,
  User as UserIcon,
  MapPin as MapPinIcon,
  Calendar as CalendarIcon,
  Bookmark as BookmarkIcon,
  Settings as SettingsIcon,
  FileText as FileTextIcon,
  Shield as ShieldIcon,
  HelpCircle as HelpCircleIcon,
  TreePine as BonsaiIcon,
  BookOpen as BookOpenIcon,
  Bug as BugIcon,
  Sprout as SproutIcon,
  FlaskConical as FlaskConicalIcon,
  CalendarPlus as CalendarPlusIcon,
  BarChart3 as BarChartIcon,
  Crown as CrownIcon,
  Leaf as LeafIcon,
  Info as InfoIcon,
  ChevronDown as ChevronDownIcon,
} from 'lucide-react'
import {
  ROUTE_FEED,
  ROUTE_SEARCH,
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
  ROUTE_TERMS,
  ROUTE_PRIVACY,
  ROUTE_TOKUSHOHO,
  ROUTE_HELP,
} from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'
import { NotificationBadge } from '@/components/notification/NotificationBadge'
import { MessageBadge } from '@/components/message/MessageBadge'

type NavItem = {
  href: string
  icon: React.FC<{ className?: string }>
  label: string
  testId: string
  premium?: boolean
}

const baseNavItems: NavItem[] = [
  { href: ROUTE_FEED, icon: HomeIcon, label: 'ホーム', testId: 'mobile-nav-home' },
  { href: ROUTE_SEARCH, icon: SearchIcon, label: '検索', testId: 'mobile-nav-search' },
  { href: ROUTE_NOTIFICATIONS, icon: BellIcon, label: '通知', testId: 'mobile-nav-notifications' },
  { href: ROUTE_MESSAGES, icon: MessageIcon, label: 'メッセージ', testId: 'mobile-nav-messages' },
]

const mainMenuItems: NavItem[] = [
  { href: ROUTE_BONSAI, icon: BonsaiIcon, label: 'マイ盆栽', testId: 'mobile-nav-bonsai' },
  { href: ROUTE_SHOPS, icon: MapPinIcon, label: '盆栽園マップ', testId: 'mobile-nav-shops' },
  { href: ROUTE_EVENTS, icon: CalendarIcon, label: 'イベント', testId: 'mobile-nav-events' },
  { href: ROUTE_BOOKMARKS, icon: BookmarkIcon, label: 'ブックマーク', testId: 'mobile-nav-bookmarks' },
]

const guidesMenuItems: NavItem[] = [
  { href: ROUTE_PESTICIDES, icon: BugIcon, label: '農薬・病害虫', testId: 'mobile-nav-pesticides' },
  { href: ROUTE_FERTILIZERS, icon: SproutIcon, label: '施肥ガイド', testId: 'mobile-nav-fertilizers' },
  { href: ROUTE_HORMONES, icon: FlaskConicalIcon, label: '植物ホルモン', testId: 'mobile-nav-hormones' },
  { href: ROUTE_DICTIONARY, icon: BookOpenIcon, label: '盆栽用語辞典', testId: 'mobile-nav-dictionary' },
]

const settingsNavItem: NavItem = {
  href: ROUTE_SETTINGS,
  icon: SettingsIcon,
  label: '設定',
  testId: 'mobile-nav-settings',
}

const premiumMenuItems: NavItem[] = [
  { href: ROUTE_SCHEDULED_POSTS, icon: CalendarPlusIcon, label: '予約投稿', testId: 'mobile-nav-scheduled', premium: true },
  { href: ROUTE_ANALYTICS, icon: BarChartIcon, label: '投稿分析', testId: 'mobile-nav-analytics', premium: true },
]

const otherMenuItems: NavItem[] = [
  { href: ROUTE_TERMS, icon: FileTextIcon, label: '利用規約', testId: 'mobile-nav-terms' },
  { href: ROUTE_PRIVACY, icon: ShieldIcon, label: 'プライバシー', testId: 'mobile-nav-privacy' },
  { href: ROUTE_TOKUSHOHO, icon: FileTextIcon, label: '特商法表記', testId: 'mobile-nav-tokushoho' },
  { href: ROUTE_HELP, icon: HelpCircleIcon, label: 'ヘルプ', testId: 'mobile-nav-help' },
]

type ExpandableSection = 'guides' | 'others'

const GUIDES_PANEL_ID = 'mobile-nav-guides-panel'
const OTHERS_PANEL_ID = 'mobile-nav-others-panel'

const MENU_ITEM_BASE = 'flex items-center gap-3 transition-colors'
const MENU_ITEM_ACTIVE = 'text-sumi dark:text-washi bg-sumi/[0.04] dark:bg-washi/[0.04]'
const MENU_ITEM_INACTIVE = 'text-sumi/70 dark:text-washi/70 hover:text-sumi dark:hover:text-washi hover:bg-sumi/[0.03] dark:hover:bg-washi/[0.03]'
const SUB_MENU_ITEM_INACTIVE = 'text-sumi/40 dark:text-washi/40 hover:text-sumi/60 dark:hover:text-washi/60 hover:bg-sumi/[0.02] dark:hover:bg-washi/[0.02]'

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

/** 墨筆装飾の上部・下部境界 SVG */
function InkStrokeBorder({ className, variant }: { className?: string; variant: 'top' | 'bottom' }) {
  const path = variant === 'top'
    ? 'M0,3 C20,1 40,5 80,2.5 C120,0 160,4.5 200,3 C240,1.5 280,5 320,2 C360,0.5 380,4 400,3'
    : 'M0,1.5 C30,0.5 60,2.5 100,1.5 C140,0.5 170,2.5 200,1.5'
  return (
    <svg
      className={className}
      viewBox={variant === 'top' ? '0 0 400 6' : '0 0 200 3'}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={variant === 'top' ? '2.5' : '1.5'} strokeLinecap="round" />
    </svg>
  )
}

/** メニュー内の墨セパレータ（薄い波線） */
function InkSeparator() {
  return (
    <div className="mx-4 h-[2px]">
      <svg className="w-full h-full text-sumi/15 dark:text-washi/10" viewBox="0 0 200 2" preserveAspectRatio="none" aria-hidden="true">
        <path d="M10,1 C50,0.3 100,1.7 150,0.8 C170,1.3 190,0.6 200,1" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/** メニュー上部・下部の装飾線（濃淡違いの波線） */
function InkOrnament({ position }: { position: 'top' | 'bottom' }) {
  const dPath = position === 'top'
    ? 'M0,1.5 C30,0.5 60,2.5 100,1.5 C140,0.5 170,2.5 200,1.5'
    : 'M0,1.5 C30,2.5 60,0.5 100,1.5 C140,2.5 170,0.5 200,1.5'
  const margin = position === 'top' ? 'mx-4 mt-2 mb-1' : 'mx-4 mt-1 mb-2'
  return (
    <div className={`h-[3px] ${margin}`}>
      <svg className="w-full h-full text-sumi/30 dark:text-washi/20" viewBox="0 0 200 3" preserveAspectRatio="none" aria-hidden="true">
        <path d={dPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/** ボトムバーに並ぶアクティブインジケータ（墨点 + アンダーライン） */
function ActiveBarIndicator() {
  return (
    <>
      <span className="absolute top-1 left-1/2 -translate-x-1/2">
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <circle cx="4" cy="4" r="3" fill="currentColor" opacity="0.7" />
          <circle cx="4" cy="4" r="3.5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        </svg>
      </span>
      <svg
        className="absolute bottom-1 left-1/2 -translate-x-1/2"
        width="28"
        height="3"
        viewBox="0 0 28 3"
        aria-hidden="true"
      >
        <path
          d="M2,1.5 C6,0.5 10,2 14,1.5 C18,1 22,2.5 26,1.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    </>
  )
}

type MenuLinkProps = {
  item: NavItem
  pathname: string
  /** インデント・サイズ違い用（アコーディオン内ではコンパクト表示） */
  variant?: 'normal' | 'sub' | 'others'
  trailingIcon?: React.ReactNode
}

/** ドロップアップメニュー内の Link 1 行（5 箇所の重複を集約） */
function MenuLink({ item, pathname, variant = 'normal', trailingIcon }: MenuLinkProps) {
  const Icon = item.icon
  const isActive = isPathActive(pathname, item.href)

  if (variant === 'sub') {
    return (
      <Link
        href={item.href}
        role="menuitem"
        data-testid={item.testId}
        className={`${MENU_ITEM_BASE} pl-10 pr-4 py-2.5 ${isActive ? MENU_ITEM_ACTIVE : MENU_ITEM_INACTIVE}`}
      >
        <Icon className="w-4 h-4" />
        <span className="text-sm tracking-[0.1em]">{item.label}</span>
      </Link>
    )
  }

  if (variant === 'others') {
    // 「その他」は常時グレーアウト表示（active 状態の強調なし、コンパクト）
    return (
      <Link
        href={item.href}
        role="menuitem"
        data-testid={item.testId}
        className={`${MENU_ITEM_BASE} pl-10 pr-4 py-2 ${SUB_MENU_ITEM_INACTIVE}`}
      >
        <Icon className="w-4 h-4" />
        <span className="text-xs tracking-[0.1em]">{item.label}</span>
      </Link>
    )
  }

  return (
    <Link
      href={item.href}
      role="menuitem"
      data-testid={item.testId}
      className={`${MENU_ITEM_BASE} px-4 py-3 ${isActive ? MENU_ITEM_ACTIVE : MENU_ITEM_INACTIVE}`}
    >
      <Icon className="w-[18px] h-[18px]" />
      <span className="text-sm tracking-[0.1em]">{item.label}</span>
      {trailingIcon}
    </Link>
  )
}

type AccordionToggleProps = {
  section: ExpandableSection
  expanded: boolean
  panelId: string
  testId: string
  icon: React.FC<{ className?: string }>
  label: string
  variant?: 'normal' | 'compact'
  onToggle: (section: ExpandableSection) => void
}

function AccordionToggle({ section, expanded, panelId, testId, icon: Icon, label, variant = 'normal', onToggle }: AccordionToggleProps) {
  const isCompact = variant === 'compact'
  const padding = isCompact ? 'px-4 py-2.5' : 'px-4 py-3'
  const labelClass = isCompact ? 'text-xs tracking-[0.1em]' : 'text-sm tracking-[0.1em]'
  const colorClass = isCompact ? SUB_MENU_ITEM_INACTIVE : MENU_ITEM_INACTIVE
  return (
    <button
      type="button"
      role="menuitem"
      aria-expanded={expanded}
      aria-controls={panelId}
      data-testid={testId}
      onClick={() => onToggle(section)}
      className={`${MENU_ITEM_BASE} w-full ${padding} ${colorClass}`}
    >
      <Icon className="w-[18px] h-[18px]" />
      <span className={labelClass}>{label}</span>
      <ChevronDownIcon
        className={`w-4 h-4 ml-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        aria-hidden="true"
      />
    </button>
  )
}

type MobileNavProps = {
  userId?: string
  isPremium?: boolean
  isAdmin?: boolean
}

export function MobileNav({ userId, isPremium, isAdmin: _isAdmin }: MobileNavProps) {
  const pathname = usePathname()
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [expandedSection, setExpandedSection] = useState<ExpandableSection | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function closeMoreMenu() {
    setShowMoreMenu(false)
    setExpandedSection(null)
  }

  function toggleMoreMenu() {
    if (showMoreMenu) {
      closeMoreMenu()
    } else {
      setShowMoreMenu(true)
    }
  }

  function toggleSection(section: ExpandableSection) {
    setExpandedSection((prev) => (prev === section ? null : section))
  }

  useEffect(() => {
    if (!showMoreMenu) return

    function handleClickOutside(event: MouseEvent) {
      if (!(event.target instanceof Node)) return
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMoreMenu()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMoreMenu])

  useEffect(() => {
    // ナビゲーション遷移時にメニューを閉じる（pathname 変化検知）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowMoreMenu((prev) => (prev ? false : prev))
    setExpandedSection((prev) => (prev !== null ? null : prev))
  }, [pathname])

  const allMoreMenuItems = [
    ...mainMenuItems,
    ...guidesMenuItems,
    settingsNavItem,
    ...premiumMenuItems,
    ...otherMenuItems,
  ]

  const isMoreMenuActive = allMoreMenuItems.some((item) => isPathActive(pathname, item.href))
    || (userId !== undefined && isPathActive(pathname, buildUserPath(userId)))

  const profileItem: NavItem = {
    href: userId ? buildUserPath(userId) : ROUTE_SETTINGS,
    icon: UserIcon,
    label: 'プロフィール',
    testId: 'mobile-nav-profile',
  }

  const isGuidesExpanded = expandedSection === 'guides'
  const isOthersExpanded = expandedSection === 'others'

  return (
    <nav aria-label="モバイルナビゲーション" className="fixed bottom-0 left-0 right-0 lg:hidden z-50">
      {/* 上部の墨筆ストローク境界 */}
      <div className="relative">
        <InkStrokeBorder variant="top" className="absolute bottom-full left-0 w-full h-[6px] text-sumi/60 dark:text-washi/20" />
      </div>

      {/* 和紙テクスチャ背景 */}
      <div className="relative bg-washi/90 dark:bg-sumi/90 backdrop-blur-xl backdrop-saturate-150">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.3'/%3E%3C/svg%3E")`,
        }} />

        <div className="relative flex items-center justify-around h-[60px]">
          {baseNavItems.map((item) => {
            const isActive = isPathActive(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testId}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center flex-1 h-full transition-all duration-300 group ${isActive
                    ? 'text-sumi dark:text-washi'
                    : 'text-sumi/40 dark:text-washi/40 hover:text-sumi/70 dark:hover:text-washi/70 active:scale-95'
                  }`}
              >
                {isActive && <ActiveBarIndicator />}
                <div className="relative mt-0.5" aria-hidden="true">
                  <Icon className={`w-[20px] h-[20px] transition-all duration-300 ${isActive ? 'scale-110 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]' : 'group-hover:scale-105'
                    }`} />
                  {item.href === ROUTE_NOTIFICATIONS && (
                    <NotificationBadge className="absolute -top-1 -right-1.5" />
                  )}
                  {item.href === ROUTE_MESSAGES && (
                    <MessageBadge className="absolute -top-1 -right-1.5" />
                  )}
                </div>
                <span className={`text-[10px] mt-1 tracking-[0.15em] transition-all duration-300 ${isActive ? 'font-bold' : 'font-normal'
                  }`}>{item.label}</span>
              </Link>
            )
          })}

          {/* もっと見るボタン + ドロップアップメニュー */}
          <div className="relative flex-1 h-full" ref={menuRef}>
            <button
              type="button"
              onClick={toggleMoreMenu}
              aria-label="その他のメニュー"
              aria-expanded={showMoreMenu}
              className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 group ${isMoreMenuActive || showMoreMenu
                  ? 'text-sumi dark:text-washi'
                  : 'text-sumi/40 dark:text-washi/40 hover:text-sumi/70 dark:hover:text-washi/70'
                }`}
            >
              {(isMoreMenuActive || showMoreMenu) && <ActiveBarIndicator />}
              <MoreIcon className={`w-[20px] h-[20px] mt-0.5 transition-all duration-300 ${showMoreMenu ? 'rotate-90 scale-110' : 'group-hover:scale-105'
                }`} />
              <span className={`text-[10px] mt-1 tracking-[0.15em] ${isMoreMenuActive || showMoreMenu ? 'font-bold' : ''}`}>もっと見る</span>
            </button>

            {showMoreMenu && (
              <div
                role="menu"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeMoreMenu()
                }}
                // max-h: 端末高が低い場合に画面上部にはみ出さないよう制限
                className="absolute bottom-full right-0 mb-3 w-56 max-h-[calc(100dvh-80px)] overflow-y-auto rounded-lg shadow-washi-lg animate-slide-up bg-washi/95 dark:bg-sumi/95 backdrop-blur-xl border border-sumi/10 dark:border-washi/10"
              >
                <InkOrnament position="top" />

                <MenuLink item={profileItem} pathname={pathname} />

                <InkSeparator />

                {mainMenuItems.map((item) => (
                  <MenuLink key={item.href} item={item} pathname={pathname} />
                ))}

                <AccordionToggle
                  section="guides"
                  expanded={isGuidesExpanded}
                  panelId={GUIDES_PANEL_ID}
                  testId="mobile-nav-guides-toggle"
                  icon={LeafIcon}
                  label="育成ガイド"
                  onToggle={toggleSection}
                />
                {isGuidesExpanded && (
                  <div id={GUIDES_PANEL_ID} role="group" aria-label="育成ガイド">
                    {guidesMenuItems.map((item) => (
                      <MenuLink key={item.href} item={item} pathname={pathname} variant="sub" />
                    ))}
                  </div>
                )}

                <InkSeparator />

                <MenuLink item={settingsNavItem} pathname={pathname} />

                {isPremium && (
                  <>
                    <InkSeparator />
                    <div className="px-4 py-2 text-xs text-sumi/50 dark:text-washi/50 flex items-center gap-1.5 tracking-[0.15em]">
                      <CrownIcon className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                      <span>プレミアム</span>
                    </div>
                    {premiumMenuItems.map((item) => (
                      <MenuLink
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        trailingIcon={<CrownIcon className="w-3 h-3 text-muted-foreground ml-auto" aria-hidden="true" />}
                      />
                    ))}
                  </>
                )}

                <InkSeparator />

                <AccordionToggle
                  section="others"
                  expanded={isOthersExpanded}
                  panelId={OTHERS_PANEL_ID}
                  testId="mobile-nav-others-toggle"
                  icon={InfoIcon}
                  label="その他"
                  variant="compact"
                  onToggle={toggleSection}
                />
                {isOthersExpanded && (
                  <div id={OTHERS_PANEL_ID} role="group" aria-label="その他">
                    {otherMenuItems.map((item) => (
                      <MenuLink key={item.href} item={item} pathname={pathname} variant="others" />
                    ))}
                  </div>
                )}

                <InkOrnament position="bottom" />
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
