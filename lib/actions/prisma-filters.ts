/**
 * Prisma クエリ構築用の汎用フィルタヘルパー。
 *
 * `mode: 'insensitive' as const` など、型を保ったまま繰り返される小片を
 * 1 箇所に集約する。`satisfies` で Prisma の型と乖離しないことを保証する。
 *
 * @module lib/actions/prisma-filters
 */

import type { Prisma } from '@prisma/client'

/**
 * 大文字小文字を無視して部分一致する `StringFilter` を生成する。
 *
 * `{ contains: search, mode: 'insensitive' as const }` の繰り返しを排除し、
 * 検索 where 句の可読性を上げる。
 */
export const containsInsensitive = (search: string) =>
  ({ contains: search, mode: 'insensitive' } as const) satisfies Prisma.StringFilter

/**
 * 大文字小文字を無視して前方一致する `StringFilter` を生成する。
 */
export const startsWithInsensitive = (prefix: string) =>
  ({ startsWith: prefix, mode: 'insensitive' } as const) satisfies Prisma.StringFilter
