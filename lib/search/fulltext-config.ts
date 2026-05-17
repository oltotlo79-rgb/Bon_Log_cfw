/**
 * @module lib/search/fulltext-config
 * 全文検索の mode 判定 / 拡張機能 (pg_bigm, pg_trgm) 操作 / GIN index 作成 / 状態取得。
 * 検索クエリの実行は `./fulltext-search` に分離。
 */

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'

/**
 * 'bigm': pg_bigm (日本語の 2-gram に強い)
 * 'trgm': pg_trgm (3-gram、英語も含めて汎用)
 * 'like': 拡張機能不要、SQL LIKE フォールバック
 */
export type SearchMode = 'bigm' | 'trgm' | 'like'

/** SEARCH_MODE 環境変数から検索モードを取得。未設定や無効値は 'like' にフォールバック。 */
export function getSearchMode(): SearchMode {
  const mode = process.env.SEARCH_MODE?.toLowerCase()
  if (mode === 'bigm' || mode === 'trgm') return mode
  return 'like'
}

/** pg_bigm / pg_trgm が DB にインストール済みか確認する。 */
export async function checkExtensionAvailable(
  extension: 'pg_bigm' | 'pg_trgm',
): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<{ available: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = ${extension}
      ) as available
    `
    return result[0]?.available ?? false
  } catch {
    return false
  }
}

/**
 * PostgreSQL の `CREATE EXTENSION` は識別子をパラメータ化できないため、
 * `$executeRawUnsafe` ではなく switch で静的 SQL を分岐して SQL インジェクション
 * 経路を構造的に排除する。CREATE EXTENSION には基本 SUPERUSER 権限が必要なため、
 * Supabase / RDS では失敗することがある (その場合は false を返す)。
 */
export async function enableExtension(extension: 'pg_bigm' | 'pg_trgm'): Promise<boolean> {
  try {
    switch (extension) {
      case 'pg_bigm':
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "pg_bigm"`
        return true
      case 'pg_trgm':
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`
        return true
      default: {
        const exhaustive: never = extension
        logger.error(`Invalid extension name: ${String(exhaustive)}`)
        return false
      }
    }
  } catch (error) {
    logger.error(`Failed to enable ${extension}:`, error)
    return false
  }
}

/**
 * 現在の SEARCH_MODE に応じた GIN index を作成する。like モードでは index 不要。
 * 既存 index は IF NOT EXISTS でスキップされる。
 */
export async function createSearchIndexes(): Promise<{
  success: boolean
  message: string
  details?: string[]
}> {
  const mode = getSearchMode()
  const createdIndexes: string[] = []

  try {
    if (mode === 'bigm') {
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS posts_content_bigm_idx ON posts USING gin (content gin_bigm_ops)`
      createdIndexes.push('posts_content_bigm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS users_nickname_bigm_idx ON users USING gin (nickname gin_bigm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS users_bio_bigm_idx ON users USING gin (bio gin_bigm_ops)`
      createdIndexes.push('users_nickname_bigm_idx', 'users_bio_bigm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsai_shops_name_bigm_idx ON bonsai_shops USING gin (name gin_bigm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsai_shops_address_bigm_idx ON bonsai_shops USING gin (address gin_bigm_ops)`
      createdIndexes.push('bonsai_shops_name_bigm_idx', 'bonsai_shops_address_bigm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS events_title_bigm_idx ON events USING gin (title gin_bigm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS events_description_bigm_idx ON events USING gin (description gin_bigm_ops)`
      createdIndexes.push('events_title_bigm_idx', 'events_description_bigm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsais_name_bigm_idx ON bonsais USING gin (name gin_bigm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsais_species_bigm_idx ON bonsais USING gin (species gin_bigm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsais_description_bigm_idx ON bonsais USING gin (description gin_bigm_ops)`
      createdIndexes.push(
        'bonsais_name_bigm_idx',
        'bonsais_species_bigm_idx',
        'bonsais_description_bigm_idx',
      )
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS hashtags_name_bigm_idx ON hashtags USING gin (name gin_bigm_ops)`
      createdIndexes.push('hashtags_name_bigm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS comments_content_bigm_idx ON comments USING gin (content gin_bigm_ops)`
      createdIndexes.push('comments_content_bigm_idx')

      return {
        success: true,
        message: 'pg_bigmインデックスを作成しました',
        details: createdIndexes,
      }
    } else if (mode === 'trgm') {
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS posts_content_trgm_idx ON posts USING gin (content gin_trgm_ops)`
      createdIndexes.push('posts_content_trgm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS users_nickname_trgm_idx ON users USING gin (nickname gin_trgm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS users_bio_trgm_idx ON users USING gin (bio gin_trgm_ops)`
      createdIndexes.push('users_nickname_trgm_idx', 'users_bio_trgm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsai_shops_name_trgm_idx ON bonsai_shops USING gin (name gin_trgm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsai_shops_address_trgm_idx ON bonsai_shops USING gin (address gin_trgm_ops)`
      createdIndexes.push('bonsai_shops_name_trgm_idx', 'bonsai_shops_address_trgm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS events_title_trgm_idx ON events USING gin (title gin_trgm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS events_description_trgm_idx ON events USING gin (description gin_trgm_ops)`
      createdIndexes.push('events_title_trgm_idx', 'events_description_trgm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsais_name_trgm_idx ON bonsais USING gin (name gin_trgm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsais_species_trgm_idx ON bonsais USING gin (species gin_trgm_ops)`
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS bonsais_description_trgm_idx ON bonsais USING gin (description gin_trgm_ops)`
      createdIndexes.push(
        'bonsais_name_trgm_idx',
        'bonsais_species_trgm_idx',
        'bonsais_description_trgm_idx',
      )
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS hashtags_name_trgm_idx ON hashtags USING gin (name gin_trgm_ops)`
      createdIndexes.push('hashtags_name_trgm_idx')
      await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS comments_content_trgm_idx ON comments USING gin (content gin_trgm_ops)`
      createdIndexes.push('comments_content_trgm_idx')

      return {
        success: true,
        message: 'pg_trgmインデックスを作成しました',
        details: createdIndexes,
      }
    }

    return { success: true, message: 'LIKE検索モード（GINインデックス不要）' }
  } catch (error) {
    logger.error('Failed to create search indexes:', error)
    return { success: false, message: `インデックス作成に失敗: ${error}`, details: createdIndexes }
  }
}

/** pg_trgm 拡張の有効化 → GIN index 作成を一括実行する。 */
export async function setupFulltextSearch(): Promise<{
  success: boolean
  steps: { step: string; success: boolean; message: string }[]
}> {
  const steps: { step: string; success: boolean; message: string }[] = []

  const trgmEnabled = await enableExtension('pg_trgm')
  steps.push({
    step: 'pg_trgm拡張の有効化',
    success: trgmEnabled,
    message: trgmEnabled ? 'pg_trgm拡張を有効化しました' : 'pg_trgm拡張の有効化に失敗しました',
  })

  if (!trgmEnabled) {
    return { success: false, steps }
  }

  const indexResult = await createSearchIndexes()
  steps.push({
    step: 'GINインデックスの作成',
    success: indexResult.success,
    message: indexResult.message,
  })

  return {
    success: steps.every((s) => s.success),
    steps,
  }
}

const TARGET_TRGM_INDEXES = [
  { name: 'posts_content_trgm_idx', table: 'posts' },
  { name: 'users_nickname_trgm_idx', table: 'users' },
  { name: 'users_bio_trgm_idx', table: 'users' },
  { name: 'bonsai_shops_name_trgm_idx', table: 'bonsai_shops' },
  { name: 'bonsai_shops_address_trgm_idx', table: 'bonsai_shops' },
  { name: 'events_title_trgm_idx', table: 'events' },
  { name: 'events_description_trgm_idx', table: 'events' },
  { name: 'bonsais_name_trgm_idx', table: 'bonsais' },
  { name: 'bonsais_species_trgm_idx', table: 'bonsais' },
  { name: 'bonsais_description_trgm_idx', table: 'bonsais' },
  { name: 'hashtags_name_trgm_idx', table: 'hashtags' },
  { name: 'comments_content_trgm_idx', table: 'comments' },
] as const

/** 既存の pg_trgm GIN index を public schema から拾い、名前と table を返す。 */
export async function getSearchIndexes(): Promise<
  { name: string; table: string; definition: string }[]
> {
  const existingIndexes: { name: string; table: string; definition: string }[] = []

  try {
    for (const idx of TARGET_TRGM_INDEXES) {
      try {
        const result = await prisma.$queryRaw<{ exists: boolean }[]>`
          SELECT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = ${idx.name}
            AND n.nspname = 'public'
            AND c.relkind = 'i'
          ) as exists
        `
        if (result[0]?.exists) {
          existingIndexes.push({
            name: idx.name,
            table: idx.table,
            definition: `GIN index on ${idx.table}`,
          })
        }
      } catch {
        // 個別 index のエラーは無視して他の検査を続ける
      }
    }

    return existingIndexes
  } catch (error) {
    logger.error('Failed to get search indexes:', error)
    return []
  }
}

/** 検索モードと両拡張機能の利用可能性を並列で取得する。 */
export async function getSearchStatus(): Promise<{
  mode: SearchMode
  bigmAvailable: boolean
  trgmAvailable: boolean
}> {
  const mode = getSearchMode()
  const [bigmAvailable, trgmAvailable] = await Promise.all([
    checkExtensionAvailable('pg_bigm'),
    checkExtensionAvailable('pg_trgm'),
  ])
  return { mode, bigmAvailable, trgmAvailable }
}
