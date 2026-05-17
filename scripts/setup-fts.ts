/**
 * PostgreSQL全文検索セットアップスクリプト
 *
 * @module scripts/setup-fts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('========================================')
  console.log('PostgreSQL全文検索セットアップ')
  console.log('========================================\n')

  // Step 1: 現在の状態を確認
  console.log('📋 Step 1: 現在の状態を確認中...\n')

  const [bigmResult, trgmResult] = await Promise.all([
    prisma.$queryRaw<{ available: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_bigm') as available
    `,
    prisma.$queryRaw<{ available: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') as available
    `,
  ])

  const bigmAvailable = bigmResult[0]?.available ?? false
  const trgmAvailable = trgmResult[0]?.available ?? false

  console.log(`  pg_bigm: ${bigmAvailable ? '✅ 有効' : '❌ 無効'}`)
  console.log(`  pg_trgm: ${trgmAvailable ? '✅ 有効' : '❌ 無効'}`)
  console.log('')

  // Step 2: pg_trgm拡張を有効化
  console.log('🔧 Step 2: pg_trgm拡張を有効化中...\n')

  if (!trgmAvailable) {
    try {
      await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_trgm`
      console.log('  ✅ pg_trgm拡張を有効化しました\n')
    } catch (error) {
      console.error('  ❌ pg_trgm拡張の有効化に失敗しました')
      console.error('  エラー:', error)
      console.log('\n  💡 ヒント: Supabaseダッシュボードから手動で有効化してください')
      console.log('     Database → Extensions → pg_trgm を有効化')
      process.exit(1)
    }
  } else {
    console.log('  ℹ️  pg_trgm拡張は既に有効です\n')
  }

  // Step 3: GINインデックスを作成
  console.log('📇 Step 3: GINインデックスを作成中...\n')

  const indexes = [
    // 投稿
    { name: 'posts_content_trgm_idx', table: 'posts', column: 'content' },
    // ユーザー
    { name: 'users_nickname_trgm_idx', table: 'users', column: 'nickname' },
    { name: 'users_bio_trgm_idx', table: 'users', column: 'bio' },
    // 盆栽園
    { name: 'bonsai_shops_name_trgm_idx', table: 'bonsai_shops', column: 'name' },
    { name: 'bonsai_shops_address_trgm_idx', table: 'bonsai_shops', column: 'address' },
    // イベント
    { name: 'events_title_trgm_idx', table: 'events', column: 'title' },
    { name: 'events_description_trgm_idx', table: 'events', column: 'description' },
    // 盆栽
    { name: 'bonsais_name_trgm_idx', table: 'bonsais', column: 'name' },
    { name: 'bonsais_species_trgm_idx', table: 'bonsais', column: 'species' },
    { name: 'bonsais_description_trgm_idx', table: 'bonsais', column: 'description' },
    // ハッシュタグ
    { name: 'hashtags_name_trgm_idx', table: 'hashtags', column: 'name' },
    // コメント
    { name: 'comments_content_trgm_idx', table: 'comments', column: 'content' },
  ]

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const idx of indexes) {
    try {
      // インデックスが既に存在するか確認
      const existingIndex = await prisma.$queryRaw<{ indexname: string }[]>`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname = ${idx.name}
      `

      if (existingIndex.length > 0) {
        console.log(`  ⏭️  ${idx.name} (既存)`)
        skipCount++
        continue
      }

      // インデックスを作成
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table} USING gin (${idx.column} gin_trgm_ops)`
      )
      console.log(`  ✅ ${idx.name}`)
      successCount++
    } catch (error) {
      console.error(`  ❌ ${idx.name}: ${error}`)
      errorCount++
    }
  }

  console.log('')
  console.log(`  作成: ${successCount}, スキップ: ${skipCount}, エラー: ${errorCount}`)
  console.log('')

  // Step 4: 環境変数の設定を案内
  console.log('⚙️  Step 4: 環境変数の設定\n')

  const currentMode = process.env.SEARCH_MODE?.toLowerCase() || 'like'

  if (currentMode !== 'trgm') {
    console.log('  ⚠️  環境変数 SEARCH_MODE が設定されていないか、trgm以外の値です')
    console.log('  以下を .env.local に追加してください:\n')
    console.log('  SEARCH_MODE=trgm\n')
  } else {
    console.log('  ✅ SEARCH_MODE=trgm が設定されています\n')
  }

  // Step 5: 完了
  console.log('========================================')
  console.log('🎉 セットアップ完了！')
  console.log('========================================\n')

  console.log('全文検索が有効になりました。')
  console.log('検索機能で以下のエンティティが高速に検索できます：')
  console.log('  - 投稿（content）')
  console.log('  - ユーザー（nickname, bio）')
  console.log('  - 盆栽園（name, address）')
  console.log('  - イベント（title, description）')
  console.log('  - 盆栽（name, species, description）')
  console.log('  - ハッシュタグ（name）')
  console.log('  - コメント（content）')
  console.log('')

  // 最終確認
  console.log('📊 最終確認: 作成されたインデックス一覧\n')

  const finalIndexes = await prisma.$queryRaw<{ indexname: string; tablename: string }[]>`
    SELECT indexname, tablename FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexdef LIKE '%gin_trgm_ops%'
    ORDER BY tablename, indexname
  `

  if (finalIndexes.length > 0) {
    for (const idx of finalIndexes) {
      console.log(`  ${idx.tablename}.${idx.indexname}`)
    }
  } else {
    console.log('  (インデックスが見つかりませんでした)')
  }

  console.log('')
}

main()
  .catch((error) => {
    console.error('セットアップ中にエラーが発生しました:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
