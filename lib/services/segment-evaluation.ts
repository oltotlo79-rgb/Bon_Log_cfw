/**
 * ユーザーセグメント評価のクエリ構築。
 *
 * Why services 層: `'use server'` ファイル(`lib/actions/admin/segments.ts`)は async 関数しか
 * export できないため、同期の純粋関数（SQL ビルダー）をここに置いて単体テスト可能にする。
 *
 * postCount / followerCount の数値比較は Prisma のネイティブ where では表現できないため、
 * 相関サブクエリ付きのパラメータ化 raw SQL で正確な COUNT を返す。
 *
 * @module lib/services/segment-evaluation
 */

import { Prisma } from '@prisma/client'

export type SegmentRuleInput = {
  field: string
  operator: string
  value: string | number | boolean
}

export type SegmentConditionsInput = {
  rules: readonly SegmentRuleInput[]
  logic: 'AND' | 'OR'
}

/** 1 ユーザーの投稿数を数える相関サブクエリ。 */
const POST_COUNT_EXPR = Prisma.sql`(SELECT COUNT(*) FROM posts p WHERE p.user_id = u.id)`
/** 1 ユーザーのフォロワー数を数える相関サブクエリ。 */
const FOLLOWER_COUNT_EXPR = Prisma.sql`(SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id)`

function toNumber(value: string | number | boolean): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function toBoolean(value: string | number | boolean): boolean {
  return value === true || value === 'true'
}

/** 数値式に対する比較条件。未知の演算子は eq（=）として扱う。 */
function numericCondition(expr: Prisma.Sql, operator: string, value: number): Prisma.Sql {
  switch (operator) {
    case 'gt':
      return Prisma.sql`${expr} > ${value}`
    case 'lt':
      return Prisma.sql`${expr} < ${value}`
    case 'gte':
      return Prisma.sql`${expr} >= ${value}`
    case 'lte':
      return Prisma.sql`${expr} <= ${value}`
    default:
      return Prisma.sql`${expr} = ${value}`
  }
}

/** created_at に対する日付比較。未知の演算子は eq（=）として扱う。 */
function dateCondition(operator: string, value: Date): Prisma.Sql {
  switch (operator) {
    case 'gt':
      return Prisma.sql`u.created_at > ${value}`
    case 'lt':
      return Prisma.sql`u.created_at < ${value}`
    case 'gte':
      return Prisma.sql`u.created_at >= ${value}`
    case 'lte':
      return Prisma.sql`u.created_at <= ${value}`
    default:
      return Prisma.sql`u.created_at = ${value}`
  }
}

/** 単一ルールを WHERE 句の SQL 断片に変換する。変換不能なルールは null（スキップ）。 */
function ruleToSql(rule: SegmentRuleInput): Prisma.Sql | null {
  switch (rule.field) {
    case 'createdAt': {
      if (typeof rule.value !== 'string') return null
      const date = new Date(rule.value)
      if (Number.isNaN(date.getTime())) return null
      return dateCondition(rule.operator, date)
    }
    case 'isPremium':
      return Prisma.sql`u.is_premium = ${toBoolean(rule.value)}`
    case 'isSuspended':
      return Prisma.sql`u.is_suspended = ${toBoolean(rule.value)}`
    case 'location': {
      if (typeof rule.value !== 'string') return null
      return Prisma.sql`u.location ILIKE ${`%${rule.value}%`}`
    }
    case 'postCount': {
      const n = toNumber(rule.value)
      return n === null ? null : numericCondition(POST_COUNT_EXPR, rule.operator, n)
    }
    case 'followerCount': {
      const n = toNumber(rule.value)
      return n === null ? null : numericCondition(FOLLOWER_COUNT_EXPR, rule.operator, n)
    }
    default:
      return null
  }
}

/**
 * セグメント条件から、該当ユーザー数を数えるパラメータ化済み COUNT クエリを組み立てる。
 * 値はすべてバインドパラメータとして渡るため SQL インジェクション耐性がある。
 * 有効なルールが 0 件のときは全ユーザー数を返すクエリになる。
 */
export function buildSegmentCountQuery(conditions: SegmentConditionsInput): Prisma.Sql {
  const fragments = conditions.rules
    .map(ruleToSql)
    .filter((fragment): fragment is Prisma.Sql => fragment !== null)

  if (fragments.length === 0) {
    return Prisma.sql`SELECT COUNT(*)::int AS count FROM users u`
  }

  const where = Prisma.join(fragments, conditions.logic === 'OR' ? ' OR ' : ' AND ')
  return Prisma.sql`SELECT COUNT(*)::int AS count FROM users u WHERE ${where}`
}
