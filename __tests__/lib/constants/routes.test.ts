// @vitest-environment node

/**
 * ルート定数のテスト
 *
 * `lib/constants/routes.ts` はアプリ全体のルートパスを一元管理する。
 *
 * テスト観点:
 * - 各 `ROUTE_*` はスラッシュ始まりの文字列である
 * - 同じパスへのエイリアスが 2 つ定義されていない（重複検知）
 * - `PROTECTED_PATHS` / `AUTH_ONLY_PATHS` / `WEBHOOK_PATHS` /
 *   `MAINTENANCE_ALLOWED_PATHS` の invariant が満たされている
 *   （proxy.ts の振る舞いに直結するため、壊れるとセキュリティ事故になる）
 * - 階層整合: `ROUTE_SETTINGS_PROFILE` は `ROUTE_SETTINGS` 配下、など
 */

import { describe, it, expect } from 'vitest'
import * as routes from '@/lib/constants/routes'

describe('lib/constants/routes', () => {
  describe('ROUTE_* 定数の基本 invariant', () => {
    // ROUTE_ で始まる全定数（文字列のみ）を抽出
    const routeEntries = Object.entries(routes).filter(
      ([key, value]) => key.startsWith('ROUTE_') && typeof value === 'string',
    ) as [string, string][]

    it('ROUTE_* 定数が 20 件以上 export されている', () => {
      expect(routeEntries.length).toBeGreaterThanOrEqual(20)
    })

    it.each(routeEntries)('%s は "/" で始まる', (_name, value) => {
      expect(value.startsWith('/')).toBe(true)
    })

    it.each(routeEntries)('%s は空白文字を含まない', (_name, value) => {
      expect(value).not.toMatch(/\s/)
    })

    it.each(routeEntries)('%s は絶対 URL ではない（スキームを含まない）', (_name, value) => {
      expect(value).not.toMatch(/^https?:/)
    })

    it.each(routeEntries)('%s は末尾スラッシュを持たない（ROUTE_HOME を除く）', (name, value) => {
      if (name === 'ROUTE_HOME') {
        expect(value).toBe('/')
      } else {
        expect(value.endsWith('/')).toBe(false)
      }
    })

    it('ROUTE_* に重複値がない', () => {
      // 同じパスを 2 つの名前で export すると DRY が崩れ、
      // 将来のリファクタで片方だけ直すリスクが生じる。
      const valueToNames = new Map<string, string[]>()
      for (const [name, value] of routeEntries) {
        const list = valueToNames.get(value) ?? []
        list.push(name)
        valueToNames.set(value, list)
      }
      const duplicates = Array.from(valueToNames.entries()).filter(([, names]) => names.length > 1)
      expect(duplicates).toEqual([])
    })
  })

  describe('階層整合性', () => {
    it('設定系はすべて /settings 配下', () => {
      const settingsRoutes = [
        routes.ROUTE_SETTINGS_PROFILE,
        routes.ROUTE_SETTINGS_ACCOUNT,
        routes.ROUTE_SETTINGS_SECURITY,
        routes.ROUTE_SETTINGS_NOTIFICATIONS,
        routes.ROUTE_SETTINGS_SUBSCRIPTION,
        routes.ROUTE_SETTINGS_FOLLOW_REQUESTS,
        routes.ROUTE_SETTINGS_BLOCKED,
        routes.ROUTE_SETTINGS_MUTED,
      ]
      for (const p of settingsRoutes) {
        expect(p.startsWith(routes.ROUTE_SETTINGS + '/')).toBe(true)
      }
    })

    it('管理画面はすべて /admin 配下', () => {
      const adminRoutes = [
        routes.ROUTE_ADMIN_USERS,
        routes.ROUTE_ADMIN_REPORTS,
        routes.ROUTE_ADMIN_CONTACTS,
        routes.ROUTE_ADMIN_CONTACT,
        routes.ROUTE_ADMIN_PESTICIDE_DATA,
        routes.ROUTE_ADMIN_PESTICIDE_DATA_NEW,
        routes.ROUTE_ADMIN_PREMIUM,
        routes.ROUTE_ADMIN_EVENTS,
        routes.ROUTE_ADMIN_EVENTS_IMPORT,
        routes.ROUTE_ADMIN_SHOPS,
        routes.ROUTE_ADMIN_SHOP_REQUESTS,
        routes.ROUTE_ADMIN_POSTS,
        routes.ROUTE_ADMIN_LOGS,
        routes.ROUTE_ADMIN_REVIEWS,
        routes.ROUTE_ADMIN_HIDDEN,
        routes.ROUTE_ADMIN_MAINTENANCE,
        routes.ROUTE_ADMIN_MONITORING,
        routes.ROUTE_ADMIN_USAGE,
        routes.ROUTE_ADMIN_NG_WORDS,
        routes.ROUTE_ADMIN_SEGMENTS,
        routes.ROUTE_ADMIN_IP_MANAGEMENT,
        routes.ROUTE_ADMIN_BLACKLIST,
        routes.ROUTE_ADMIN_CONTENT_MANAGEMENT,
      ]
      for (const p of adminRoutes) {
        expect(p.startsWith(routes.ROUTE_ADMIN + '/')).toBe(true)
      }
    })

    it('農薬・肥料・ホルモン系は各親ルート配下', () => {
      const pesticideRoutes = [
        routes.ROUTE_PESTICIDES_COLUMNS,
        routes.ROUTE_PESTICIDES_DISEASES_PESTS,
        routes.ROUTE_PESTICIDES_FORMULATIONS,
        routes.ROUTE_PESTICIDES_INGREDIENTS,
        routes.ROUTE_PESTICIDES_SPREADERS,
        routes.ROUTE_PESTICIDES_SPRAY_GUIDE,
        routes.ROUTE_PESTICIDES_DILUTION,
        routes.ROUTE_PESTICIDES_MIXING,
      ]
      for (const p of pesticideRoutes) {
        expect(p.startsWith(routes.ROUTE_PESTICIDES + '/')).toBe(true)
      }

      const fertilizerRoutes = [
        routes.ROUTE_FERTILIZERS_ABSORPTION,
        routes.ROUTE_FERTILIZERS_CATEGORIES,
        routes.ROUTE_FERTILIZERS_COLUMNS,
        routes.ROUTE_FERTILIZERS_NUTRIENTS,
        routes.ROUTE_FERTILIZERS_PRODUCTS,
        routes.ROUTE_FERTILIZERS_SCHEDULES,
        routes.ROUTE_FERTILIZERS_SOIL,
        routes.ROUTE_FERTILIZERS_SYMPTOMS,
        routes.ROUTE_FERTILIZERS_TROUBLES,
        routes.ROUTE_FERTILIZERS_WATERING,
      ]
      for (const p of fertilizerRoutes) {
        expect(p.startsWith(routes.ROUTE_FERTILIZERS + '/')).toBe(true)
      }

      const hormoneRoutes = [
        routes.ROUTE_HORMONE_TECHNIQUES,
        routes.ROUTE_HORMONE_DIAGRAM,
        routes.ROUTE_HORMONE_CALENDAR,
        routes.ROUTE_HORMONE_SIMULATOR,
        routes.ROUTE_HORMONE_INTERACTIONS,
        routes.ROUTE_HORMONE_COLUMNS,
      ]
      for (const p of hormoneRoutes) {
        expect(p.startsWith(routes.ROUTE_HORMONES + '/')).toBe(true)
      }
    })

    it('盆栽園・イベント・投稿の /new パスは親配下', () => {
      expect(routes.ROUTE_SHOPS_NEW.startsWith(routes.ROUTE_SHOPS + '/')).toBe(true)
      expect(routes.ROUTE_EVENTS_NEW.startsWith(routes.ROUTE_EVENTS + '/')).toBe(true)
      expect(routes.ROUTE_SCHEDULED_POSTS.startsWith(routes.ROUTE_POSTS + '/')).toBe(true)
      expect(routes.ROUTE_SCHEDULED_POSTS_NEW.startsWith(routes.ROUTE_SCHEDULED_POSTS + '/')).toBe(true)
      expect(routes.ROUTE_BONSAI_NEW.startsWith(routes.ROUTE_BONSAI + '/')).toBe(true)
    })
  })

  describe('PROTECTED_PATHS（認証必須）', () => {
    it('配列である', () => {
      expect(Array.isArray(routes.PROTECTED_PATHS)).toBe(true)
      expect(routes.PROTECTED_PATHS.length).toBeGreaterThan(0)
    })

    it('全エントリが / で始まる', () => {
      for (const p of routes.PROTECTED_PATHS) {
        expect(p.startsWith('/')).toBe(true)
      }
    })

    it('代表的な保護ルートを含む', () => {
      expect(routes.PROTECTED_PATHS).toContain('/feed')
      expect(routes.PROTECTED_PATHS).toContain('/settings')
      expect(routes.PROTECTED_PATHS).toContain('/admin')
      expect(routes.PROTECTED_PATHS).toContain('/notifications')
      expect(routes.PROTECTED_PATHS).toContain('/bookmarks')
      expect(routes.PROTECTED_PATHS).toContain('/messages')
      expect(routes.PROTECTED_PATHS).toContain('/drafts')
      expect(routes.PROTECTED_PATHS).toContain('/bonsai')
      expect(routes.PROTECTED_PATHS).toContain('/analytics')
    })

    it('公開ページ（/, /login, /register）を含まない', () => {
      // もし含めてしまうと 未認証ユーザーがどのページもアクセスできなくなる
      expect(routes.PROTECTED_PATHS).not.toContain('/')
      expect(routes.PROTECTED_PATHS).not.toContain('/login')
      expect(routes.PROTECTED_PATHS).not.toContain('/register')
    })
  })

  describe('AUTH_ONLY_PATHS（未認証専用）', () => {
    it('ログイン・登録・パスワードリセットが含まれる', () => {
      expect(routes.AUTH_ONLY_PATHS).toContain(routes.ROUTE_LOGIN)
      expect(routes.AUTH_ONLY_PATHS).toContain(routes.ROUTE_REGISTER)
      expect(routes.AUTH_ONLY_PATHS).toContain(routes.ROUTE_PASSWORD_RESET)
    })

    it('保護ルートを含まない（相互排他）', () => {
      // AUTH_ONLY_PATHS と PROTECTED_PATHS は本質的に互いに補集合。
      // 両方に含まれるとログイン済みユーザーが宙ぶらりんになる。
      for (const p of routes.AUTH_ONLY_PATHS) {
        expect(routes.PROTECTED_PATHS).not.toContain(p)
      }
    })
  })

  describe('MAINTENANCE_ALLOWED_PATHS（メンテ中もアクセス可）', () => {
    it('メンテナンスページそのものを含む', () => {
      expect(routes.MAINTENANCE_ALLOWED_PATHS).toContain(routes.ROUTE_MAINTENANCE)
    })

    it('認証 API を含む（ログイン/ログアウトはメンテ中も必要）', () => {
      expect(routes.MAINTENANCE_ALLOWED_PATHS).toContain('/api/auth')
    })

    it('一般ユーザー向けページは含まない（フィード等）', () => {
      expect(routes.MAINTENANCE_ALLOWED_PATHS).not.toContain(routes.ROUTE_FEED)
      expect(routes.MAINTENANCE_ALLOWED_PATHS).not.toContain(routes.ROUTE_NOTIFICATIONS)
    })
  })

  describe('WEBHOOK_PATHS（Origin 検証スキップ）', () => {
    it('webhook と cron のプレフィックスを持つ', () => {
      expect(routes.WEBHOOK_PATHS).toContain('/api/webhooks/')
      expect(routes.WEBHOOK_PATHS).toContain('/api/cron/')
    })

    it('各エントリは末尾 "/" で終わる（プレフィックスマッチ用）', () => {
      // startsWith で判定されるため、誤って '/api/webhooks' と書くと
      // '/api/webhooksX' のような URL もマッチしてしまう。
      for (const p of routes.WEBHOOK_PATHS) {
        expect(p.endsWith('/')).toBe(true)
      }
    })
  })

  describe('BASE_URL', () => {
    it('文字列である', () => {
      expect(typeof routes.BASE_URL).toBe('string')
      expect(routes.BASE_URL.length).toBeGreaterThan(0)
    })

    it('絶対 URL（http:// または https://）である', () => {
      expect(routes.BASE_URL).toMatch(/^https?:\/\//)
    })

    it('末尾スラッシュを持たない（パス連結時の二重 / 回避）', () => {
      expect(routes.BASE_URL.endsWith('/')).toBe(false)
    })
  })
})
