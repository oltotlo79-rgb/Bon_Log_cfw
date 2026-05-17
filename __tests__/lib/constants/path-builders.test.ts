// @vitest-environment node

/**
 * 動的パスビルダーのテスト
 *
 * `lib/constants/path-builders.ts` は ID / slug / クエリパラメータを含む
 * URL を型安全に生成する関数群。
 *
 * テスト観点:
 * - 出力は常に `/` で始まるパス（相対パス / 絶対 URL を混在させない）
 * - query 系は `encodeURIComponent` で適切にエスケープされる
 * - 任意文字列（日本語・記号）を入れても例外を投げない
 * - 返り値はその `ROUTE_*` プレフィックスと整合する（例: `/users/...` は ROUTE_USERS 配下）
 */

import { describe, it, expect } from 'vitest'
import * as builders from '@/lib/constants/path-builders'
import {
  ROUTE_POSTS,
  ROUTE_BONSAI,
  ROUTE_DRAFTS,
  ROUTE_SHOPS,
  ROUTE_EVENTS,
  ROUTE_MESSAGES,
  ROUTE_DICTIONARY,
  ROUTE_PESTICIDES,
  ROUTE_PESTICIDES_INGREDIENTS,
  ROUTE_PESTICIDES_COLUMNS,
  ROUTE_PESTICIDES_SPREADERS,
  ROUTE_PESTICIDES_FORMULATIONS,
  ROUTE_FERTILIZERS_NUTRIENTS,
  ROUTE_FERTILIZERS_SCHEDULES,
  ROUTE_FERTILIZERS_COLUMNS,
  ROUTE_HORMONES,
  ROUTE_HORMONE_COLUMNS,
  ROUTE_SEARCH,
  ROUTE_ADMIN_USERS,
  ROUTE_ADMIN_PESTICIDE_DATA,
  ROUTE_ADMIN_CONTACT,
  ROUTE_ADMIN_CONTENT_MANAGEMENT,
  ROUTE_SCHEDULED_POSTS,
} from '@/lib/constants/routes'

describe('lib/constants/path-builders', () => {
  describe('ユーザー系', () => {
    it('buildUserPath は /users/{id}', () => {
      expect(builders.buildUserPath('abc')).toBe('/users/abc')
      expect(builders.buildUserPath('cuid-xxx')).toMatch(/^\/users\//)
    })

    it('buildUserPostsPath / Following / Followers / Likes', () => {
      const id = 'u1'
      expect(builders.buildUserPostsPath(id)).toBe('/users/u1/posts')
      expect(builders.buildUserFollowingPath(id)).toBe('/users/u1/following')
      expect(builders.buildUserFollowersPath(id)).toBe('/users/u1/followers')
      expect(builders.buildUserLikesPath(id)).toBe('/users/u1/likes')
    })

    it('空文字 id でも例外を投げない（呼び出し側の責務）', () => {
      expect(() => builders.buildUserPath('')).not.toThrow()
      expect(builders.buildUserPath('')).toBe('/users/')
    })
  })

  describe('投稿系', () => {
    it('buildPostPath は ROUTE_POSTS 配下', () => {
      const path = builders.buildPostPath('post-1')
      expect(path).toBe('/posts/post-1')
      expect(path.startsWith(ROUTE_POSTS)).toBe(true)
    })

    it('buildScheduledPostEditPath は ROUTE_SCHEDULED_POSTS 配下', () => {
      const path = builders.buildScheduledPostEditPath('sp-1')
      expect(path).toBe('/posts/scheduled/sp-1/edit')
      expect(path.startsWith(ROUTE_SCHEDULED_POSTS)).toBe(true)
    })
  })

  describe('盆栽 / 下書き / 店舗 / イベント', () => {
    it('buildBonsaiPath / buildBonsaiEditPath', () => {
      expect(builders.buildBonsaiPath('b1')).toBe('/bonsai/b1')
      expect(builders.buildBonsaiEditPath('b1')).toBe('/bonsai/b1/edit')
      expect(builders.buildBonsaiPath('b1').startsWith(ROUTE_BONSAI)).toBe(true)
    })

    it('buildDraftEditPath', () => {
      expect(builders.buildDraftEditPath('d1')).toBe('/drafts/d1/edit')
      expect(builders.buildDraftEditPath('d1').startsWith(ROUTE_DRAFTS)).toBe(true)
    })

    it('buildShopPath / buildShopEditPath', () => {
      expect(builders.buildShopPath('s1')).toBe('/shops/s1')
      expect(builders.buildShopEditPath('s1')).toBe('/shops/s1/edit')
      expect(builders.buildShopPath('s1').startsWith(ROUTE_SHOPS)).toBe(true)
    })

    it('buildEventPath / buildEventEditPath', () => {
      expect(builders.buildEventPath('e1')).toBe('/events/e1')
      expect(builders.buildEventEditPath('e1')).toBe('/events/e1/edit')
      expect(builders.buildEventPath('e1').startsWith(ROUTE_EVENTS)).toBe(true)
    })

    it('buildMessageConversationPath', () => {
      expect(builders.buildMessageConversationPath('c1')).toBe('/messages/c1')
      expect(builders.buildMessageConversationPath('c1').startsWith(ROUTE_MESSAGES)).toBe(true)
    })
  })

  describe('辞書・農薬・肥料・ホルモン', () => {
    it('buildDictionaryPath / buildDictionaryFilterPath', () => {
      expect(builders.buildDictionaryPath('matsuhaku-rui')).toBe('/dictionary/matsuhaku-rui')
      expect(builders.buildDictionaryPath('x').startsWith(ROUTE_DICTIONARY)).toBe(true)

      // フィルタは encodeURIComponent でエスケープする
      expect(builders.buildDictionaryFilterPath('松柏類')).toBe(
        `/dictionary?category=${encodeURIComponent('松柏類')}`,
      )
      // 記号もエスケープされる
      expect(builders.buildDictionaryFilterPath('A & B')).toBe(
        `/dictionary?category=${encodeURIComponent('A & B')}`,
      )
    })

    it('buildPesticideIngredientPath / ColumnPath / SpreaderPath', () => {
      expect(builders.buildPesticideIngredientPath('ing').startsWith(ROUTE_PESTICIDES_INGREDIENTS)).toBe(true)
      expect(builders.buildPesticideColumnPath('col').startsWith(ROUTE_PESTICIDES_COLUMNS)).toBe(true)
      expect(builders.buildPesticideSpreaderPath('sp').startsWith(ROUTE_PESTICIDES_SPREADERS)).toBe(true)
    })

    it('buildPesticideFormulationsPath は formulation クエリに encode する', () => {
      expect(builders.buildPesticideFormulationsPath('液剤')).toBe(
        `${ROUTE_PESTICIDES_FORMULATIONS}?formulation=${encodeURIComponent('液剤')}`,
      )
      // ASCII 特殊文字も encode
      expect(builders.buildPesticideFormulationsPath('a=b&c')).toContain('formulation=a%3Db%26c')
    })

    it('buildPesticideFilterPath は ID をクエリに入れる', () => {
      // disease-pest ID は内部 ID なので encode は不要だが、プレフィックスと値は保つ
      expect(builders.buildPesticideFilterPath('dp-1')).toBe(`${ROUTE_PESTICIDES}?diseasePest=dp-1`)
    })

    it('buildFertilizer* は各ルートの配下', () => {
      expect(builders.buildFertilizerNutrientPath('n').startsWith(ROUTE_FERTILIZERS_NUTRIENTS)).toBe(true)
      expect(builders.buildFertilizerSchedulePath('s').startsWith(ROUTE_FERTILIZERS_SCHEDULES)).toBe(true)
      expect(builders.buildFertilizerColumnPath('c').startsWith(ROUTE_FERTILIZERS_COLUMNS)).toBe(true)
    })

    it('buildHormonePath / buildHormoneColumnPath', () => {
      expect(builders.buildHormonePath('auxin')).toBe('/hormones/auxin')
      expect(builders.buildHormonePath('auxin').startsWith(ROUTE_HORMONES)).toBe(true)
      expect(builders.buildHormoneColumnPath('c').startsWith(ROUTE_HORMONE_COLUMNS)).toBe(true)
    })
  })

  describe('検索', () => {
    it('buildSearchPath はクエリを encodeURIComponent でエスケープする', () => {
      expect(builders.buildSearchPath('盆栽')).toBe(`${ROUTE_SEARCH}?q=${encodeURIComponent('盆栽')}`)
      // 空白と記号も encode
      expect(builders.buildSearchPath('松 と 杉')).toContain('q=%E6%9D%BE%20%E3%81%A8%20%E6%9D%89')
      expect(builders.buildSearchPath('a&b=c')).toContain('q=a%26b%3Dc')
    })

    it('空文字クエリでも例外を投げず q= を返す', () => {
      expect(builders.buildSearchPath('')).toBe('/search?q=')
    })

    it('buildSearchByGenrePath は ID をそのまま入れる', () => {
      // ジャンル ID は内部生成 (cuid) なので encode しないが、
      // プレフィックスの整合性は保つ
      expect(builders.buildSearchByGenrePath('g1')).toBe('/search?genre=g1')
    })
  })

  describe('管理画面', () => {
    it('buildAdminUserPath / ActivityPath', () => {
      expect(builders.buildAdminUserPath('u1')).toBe('/admin/users/u1')
      expect(builders.buildAdminUserPath('u1').startsWith(ROUTE_ADMIN_USERS)).toBe(true)
      expect(builders.buildAdminUserActivityPath('u1')).toBe('/admin/users/u1/activity')
    })

    it('buildAdminPesticideDataPath', () => {
      expect(builders.buildAdminPesticideDataPath('p1')).toBe('/admin/pesticide-data/p1')
      expect(builders.buildAdminPesticideDataPath('p1').startsWith(ROUTE_ADMIN_PESTICIDE_DATA)).toBe(true)
    })

    it('buildAdminContactPath', () => {
      expect(builders.buildAdminContactPath('c1')).toBe('/admin/contact/c1')
      expect(builders.buildAdminContactPath('c1').startsWith(ROUTE_ADMIN_CONTACT)).toBe(true)
    })

    it('buildAdminContentManagementPath', () => {
      const p = builders.buildAdminContentManagementPath('pesticides')
      expect(p).toBe('/admin/content-management/pesticides')
      expect(p.startsWith(ROUTE_ADMIN_CONTENT_MANAGEMENT)).toBe(true)
    })
  })

  describe('不変条件（全ビルダーを対象）', () => {
    // path-builders に export されている全ての関数を対象に、
    // 出力が常に `/` で始まることを確認する（絶対 URL と混在させない invariant）
    const builderEntries = Object.entries(builders).filter(
      ([, value]) => typeof value === 'function',
    ) as [string, (...args: string[]) => string][]

    it('path-builders は 1 件以上の関数を export している', () => {
      expect(builderEntries.length).toBeGreaterThan(0)
    })

    it.each(builderEntries)('%s の戻り値は "/" で始まる', (_name, fn) => {
      // 多くのビルダーは 1 引数。2 引数は全て (slug: string) 系なので同じ値で埋めても型上問題ない。
      const arity = fn.length
      const args = Array.from({ length: arity }, () => 'test-id')
      const result = fn(...args)
      expect(result).toBeTypeOf('string')
      expect(result.startsWith('/')).toBe(true)
      // フルURL（http...）を返さないこと
      expect(result).not.toMatch(/^https?:/)
    })

    it.each(builderEntries)('%s は引数が日本語でも throw しない', (_name, fn) => {
      const arity = fn.length
      const args = Array.from({ length: arity }, () => '日本語 & 記号')
      expect(() => fn(...args)).not.toThrow()
    })
  })
})
