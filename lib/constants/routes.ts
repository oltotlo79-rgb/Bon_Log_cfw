/**
 * アプリケーションルート定数
 *
 * 内部リンクの href / redirect / router.push 等で使用するパスを一元管理する。
 * 動的パス (ID / slug を含むもの) は path-builders として関数を用意。
 *
 * @module lib/constants/routes
 */

import { getAppUrl } from '@/lib/env'

// 基本ルート
export const ROUTE_HOME = '/'
// ログアウト直後に auth ページの「トップへ戻る」で使う home URL。
// クエリ値はログイン中に訪問され得ないため、proxy がキャッシュした `/`→`/feed` 認証依存
// リダイレクトの再生を構造的に回避できる。詳細は app/(auth)/layout.tsx を参照。
export const HOME_RETURN_PARAM = 'from'
export const HOME_RETURN_VALUE_AUTH = 'auth'
export const ROUTE_HOME_FROM_AUTH = `${ROUTE_HOME}?${HOME_RETURN_PARAM}=${HOME_RETURN_VALUE_AUTH}`
export const ROUTE_LOGIN = '/login'
export const ROUTE_REGISTER = '/register'
export const ROUTE_PASSWORD_RESET = '/password-reset'
export const ROUTE_VERIFY_EMAIL = '/verify-email'
export const ROUTE_VERIFY_EMAIL_SENT = '/register/verify-email-sent'
/**
 * メールアドレス変更確認ページ。password-reset と同様に意図的に /settings 配下に置かない
 * （PROTECTED_PATHS 対象外にし、未ログイン状態でもメールリンクから確認できるようにするため）。
 */
export const ROUTE_EMAIL_CHANGE_CONFIRM = '/email-change/confirm'
export const ROUTE_FEED = '/feed'
export const ROUTE_ONBOARDING = '/onboarding'
export const ROUTE_SEARCH = '/search'
export const ROUTE_EXPLORE = '/explore'
export const ROUTE_MAINTENANCE = '/maintenance'

// 公開ページ（ログイン不要）
export const ROUTE_ABOUT = '/about'
export const ROUTE_HELP = '/help'
export const ROUTE_CONTACT = '/contact'
export const ROUTE_PRIVACY = '/privacy'
export const ROUTE_TERMS = '/terms'
export const ROUTE_TOKUSHOHO = '/tokushoho'
export const ROUTE_ACCESSIBILITY = '/accessibility'
export const ROUTE_ACCOUNT_DELETION = '/account-deletion'

// ユーザー系
export const ROUTE_NOTIFICATIONS = '/notifications'
export const ROUTE_MESSAGES = '/messages'
export const ROUTE_BOOKMARKS = '/bookmarks'
export const ROUTE_DRAFTS = '/drafts'
export const ROUTE_ANALYTICS = '/analytics'

// 設定
export const ROUTE_SETTINGS = '/settings'
export const ROUTE_SETTINGS_PROFILE = '/settings/profile'
export const ROUTE_SETTINGS_ACCOUNT = '/settings/account'
export const ROUTE_SETTINGS_SECURITY = '/settings/security'
export const ROUTE_SETTINGS_NOTIFICATIONS = '/settings/notifications'
export const ROUTE_SETTINGS_SUBSCRIPTION = '/settings/subscription'
export const ROUTE_SETTINGS_FOLLOW_REQUESTS = '/settings/follow-requests'
export const ROUTE_SETTINGS_BLOCKED = '/settings/blocked'
export const ROUTE_SETTINGS_MUTED = '/settings/muted'

// 盆栽
export const ROUTE_BONSAI = '/bonsai'
export const ROUTE_BONSAI_NEW = '/bonsai/new'
/** カレンダービュー（既存 /bonsai ページの view 切替） */
export const ROUTE_BONSAI_CALENDAR = '/bonsai?view=calendar'

// 投稿
export const ROUTE_POSTS = '/posts'
export const ROUTE_SCHEDULED_POSTS = '/posts/scheduled'
export const ROUTE_SCHEDULED_POSTS_NEW = '/posts/scheduled/new'

// 盆栽園 / イベント
export const ROUTE_SHOPS = '/shops'
export const ROUTE_SHOPS_NEW = '/shops/new'
export const ROUTE_EVENTS = '/events'
export const ROUTE_EVENTS_NEW = '/events/new'

// 辞書・農薬・肥料・ホルモン
export const ROUTE_DICTIONARY = '/dictionary'

export const ROUTE_PESTICIDES = '/pesticides'
export const ROUTE_PESTICIDES_COLUMNS = '/pesticides/columns'
export const ROUTE_PESTICIDES_DISEASES_PESTS = '/pesticides/diseases-pests'
export const ROUTE_PESTICIDES_FORMULATIONS = '/pesticides/formulations'
export const ROUTE_PESTICIDES_INGREDIENTS = '/pesticides/ingredients'
export const ROUTE_PESTICIDES_SPREADERS = '/pesticides/spreaders'
export const ROUTE_PESTICIDES_SPRAY_GUIDE = '/pesticides/spray-guide'
export const ROUTE_PESTICIDES_DILUTION = '/pesticides/dilution-calculator'
export const ROUTE_PESTICIDES_MIXING = '/pesticides/mixing-checker'

export const ROUTE_FERTILIZERS = '/fertilizers'
export const ROUTE_FERTILIZERS_ABSORPTION = '/fertilizers/absorption'
export const ROUTE_FERTILIZERS_CATEGORIES = '/fertilizers/categories'
export const ROUTE_FERTILIZERS_COLUMNS = '/fertilizers/columns'
export const ROUTE_FERTILIZERS_NUTRIENTS = '/fertilizers/nutrients'
export const ROUTE_FERTILIZERS_PRODUCTS = '/fertilizers/products'
export const ROUTE_FERTILIZERS_SCHEDULES = '/fertilizers/schedules'
export const ROUTE_FERTILIZERS_SOIL = '/fertilizers/soil'
export const ROUTE_FERTILIZERS_SYMPTOMS = '/fertilizers/symptoms'
export const ROUTE_FERTILIZERS_TROUBLES = '/fertilizers/troubles'
export const ROUTE_FERTILIZERS_WATERING = '/fertilizers/watering'

export const ROUTE_HORMONES = '/hormones'
export const ROUTE_HORMONE_TECHNIQUES = '/hormones/techniques'
export const ROUTE_HORMONE_DIAGRAM = '/hormones/diagram'
export const ROUTE_HORMONE_CALENDAR = '/hormones/calendar'
export const ROUTE_HORMONE_SIMULATOR = '/hormones/simulator'
export const ROUTE_HORMONE_INTERACTIONS = '/hormones/interactions'
export const ROUTE_HORMONE_COLUMNS = '/hormones/columns'

// 管理画面
export const ROUTE_ADMIN = '/admin'
export const ROUTE_ADMIN_USERS = '/admin/users'
export const ROUTE_ADMIN_REPORTS = '/admin/reports'
export const ROUTE_ADMIN_CONTACT = '/admin/contact'
export const ROUTE_ADMIN_PESTICIDE_DATA = '/admin/pesticide-data'
export const ROUTE_ADMIN_PESTICIDE_DATA_NEW = '/admin/pesticide-data/new'
export const ROUTE_ADMIN_PREMIUM = '/admin/premium'
export const ROUTE_ADMIN_EVENTS = '/admin/events'
export const ROUTE_ADMIN_EVENTS_IMPORT = '/admin/events/import'
export const ROUTE_ADMIN_SHOPS = '/admin/shops'
export const ROUTE_ADMIN_SHOP_REQUESTS = '/admin/shop-requests'
export const ROUTE_ADMIN_POSTS = '/admin/posts'
export const ROUTE_ADMIN_LOGS = '/admin/logs'
export const ROUTE_ADMIN_REVIEWS = '/admin/reviews'
export const ROUTE_ADMIN_HIDDEN = '/admin/hidden'
export const ROUTE_ADMIN_MAINTENANCE = '/admin/maintenance'
export const ROUTE_ADMIN_MONITORING = '/admin/monitoring'
export const ROUTE_ADMIN_USAGE = '/admin/usage'
export const ROUTE_ADMIN_NG_WORDS = '/admin/ng-words'
export const ROUTE_ADMIN_SEGMENTS = '/admin/segments'
export const ROUTE_ADMIN_IP_MANAGEMENT = '/admin/ip-management'
export const ROUTE_ADMIN_BLACKLIST = '/admin/blacklist'
export const ROUTE_ADMIN_CONTENT_MANAGEMENT = '/admin/content-management'
export const ROUTE_ADMIN_WARNINGS = '/admin/warnings'
export const ROUTE_ADMIN_ROLES = '/admin/roles'
export const ROUTE_ADMIN_ANNOUNCEMENTS = '/admin/announcements'
export const ROUTE_ADMIN_MODERATION_QUEUE = '/admin/moderation-queue'
export const ROUTE_ADMIN_SECURITY = '/admin/security'
export const ROUTE_ADMIN_STATS = '/admin/stats'
export const ROUTE_ADMIN_BACKUPS = '/admin/backups'
export const ROUTE_ADMIN_ANALYTICS_COHORT = '/admin/analytics/cohort'
export const ROUTE_ADMIN_ANALYTICS_CONTENT = '/admin/analytics/content'

// アプリケーションベース URL
/** アプリケーションのベースURL（getAppUrl() で一元管理） */
export const BASE_URL = getAppUrl()

/** サイト（ブランド）名。ページタイトルのブランド付与等に使う。 */
export const SITE_NAME = 'BON-LOG'

// パスプレフィックス（フレームワーク / API 系）
/** Next.js 内部リソース（_next/static, _next/image 等）のプレフィックス */
export const NEXT_INTERNAL_PREFIX = '/_next'

/** すべての API ルートに共通するプレフィックス */
export const API_PREFIX = '/api/'

/** NextAuth 系 API パス（メンテナンス中もログインフローを通すために許可） */
export const API_AUTH_PREFIX = '/api/auth'

/** 広告 iframe 用 API パス（独自 CSP を適用するため proxy の CSP は外す） */
export const ROUTE_AD_FRAME_API = '/api/ad-frame'

/** Server Component render から切り離された閲覧計測 beacon の送信先 */
export const ROUTE_API_ANALYTICS_VIEW = '/api/analytics/view'

// Proxy / 認可系パス
/** 認証必須パス */
export const PROTECTED_PATHS = [
  ROUTE_FEED,
  ROUTE_ONBOARDING,
  ROUTE_EXPLORE,
  ROUTE_SETTINGS,
  ROUTE_NOTIFICATIONS,
  ROUTE_BOOKMARKS,
  ROUTE_MESSAGES,
  ROUTE_DRAFTS,
  ROUTE_BONSAI,
  ROUTE_ADMIN,
  ROUTE_ANALYTICS,
  ROUTE_SCHEDULED_POSTS,
] as const

/** メンテナンス中にアクセス可能なパス */
export const MAINTENANCE_ALLOWED_PATHS = [
  ROUTE_HOME,
  ROUTE_LOGIN,
  ROUTE_REGISTER,
  ROUTE_PASSWORD_RESET,
  ROUTE_MAINTENANCE,
  API_AUTH_PREFIX,
] as const

/** 未認証ユーザー専用パス（認証済みならフィードへリダイレクト） */
export const AUTH_ONLY_PATHS = [ROUTE_LOGIN, ROUTE_REGISTER, ROUTE_PASSWORD_RESET] as const

/** Webhook / Cron パス（Origin検証スキップ） */
export const WEBHOOK_PATHS = ['/api/webhooks/', '/api/cron/'] as const
