/**
 * ハッシュタグ バックフィルスクリプト
 *
 * ## 目的
 * 投稿作成時の `attachHashtagsToPost` は fire-and-forget のため、
 * 一時的な DB エラー等で `PostHashtag` 行が欠落している投稿が存在しうる。
 * このスクリプトは全投稿を走査して欠落を補完する。
 *
 * ## 冪等性
 * `hashtag.upsert` / `postHashtag.upsert` はいずれも複合キーで upsert するため、
 * 何度実行しても既存行を重複挿入しない（再実行安全）。
 * Hashtag.count は最後に `recalculateHashtagCounts()` で権威的に再計算するため、
 * バックフィル中の count 加算は行わない。
 *
 * ## 本番運用手順
 * 1. 本番の DATABASE_URL を環境変数に設定（fly.io secret または .env.local）
 * 2. 乾燥実行（DRY_RUN=true）で対象件数を確認:
 *      DATABASE_URL="..." DRY_RUN=true node --import tsx scripts/backfill-hashtags.ts
 * 3. 本番実行（バックフィル）:
 *      DATABASE_URL="..." node --import tsx scripts/backfill-hashtags.ts
 *    - 実行中も本番トラフィックは継続可能（upsert は冪等）
 *    - バッチサイズ 100 件で全投稿を処理し、最後に count を再計算する
 * 4. 完了後に管理画面の「ハッシュタグカウント再計算」ボタンで count を確認する
 *
 * @module scripts/backfill-hashtags
 */

try {
  // dotenv がインストールされている場合のみ読み込む（必須ではない）
  require('dotenv').config({ path: '.env.local' })
  require('dotenv').config({ path: '.env' })
} catch {
  // dotenv 未インストールの場合は process.env から直接取得
}

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { extractHashtags } from '../lib/utils/hashtag-extract'

const BATCH_SIZE = 100
const DRY_RUN = process.env.DRY_RUN === 'true'

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL が設定されていません')
    process.exit(1)
  }

  let isLocal = false
  try {
    const { hostname } = new URL(connectionString)
    isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    // URL parse 失敗時はリモート扱い
  }

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  })

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

async function main() {
  const prisma = createPrismaClient()

  console.log('=== ハッシュタグ バックフィル ===')
  console.log(`モード: ${DRY_RUN ? 'DRY RUN (書き込みなし)' : 'COMMIT (書き込みあり)'}`)
  console.log(`バッチサイズ: ${BATCH_SIZE}`)
  console.log('')

  let cursor: string | undefined
  let totalPosts = 0
  let postsWithTags = 0
  let tagsUpserted = 0
  let linkagesUpserted = 0

  try {
    while (true) {
      const posts = await prisma.post.findMany({
        select: { id: true, content: true },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
      })

      if (posts.length === 0) break

      for (const post of posts) {
        totalPosts++

        if (!post.content) continue

        const tagNames = extractHashtags(post.content)
        if (tagNames.length === 0) continue

        postsWithTags++

        if (DRY_RUN) {
          tagsUpserted += tagNames.length
          linkagesUpserted += tagNames.length
          continue
        }

        // Hashtag 行を upsert（count は変更しない — 最後に recalculate で上書き）
        const hashtags = await prisma.$transaction(
          tagNames.map((name) =>
            prisma.hashtag.upsert({
              where: { name },
              update: {},
              create: { name, count: 0 },
              select: { id: true },
            }),
          ),
        )

        tagsUpserted += hashtags.length

        // PostHashtag 関連付けを upsert（冪等）
        await prisma.$transaction(
          hashtags.map((hashtag: { id: string }) =>
            prisma.postHashtag.upsert({
              where: { postId_hashtagId: { postId: post.id, hashtagId: hashtag.id } },
              update: {},
              create: { postId: post.id, hashtagId: hashtag.id },
            }),
          ),
        )

        linkagesUpserted += hashtags.length
      }

      cursor = posts[posts.length - 1]?.id
      console.log(`  処理済み: ${totalPosts} 件 (ハッシュタグあり: ${postsWithTags} 件)`)

      if (posts.length < BATCH_SIZE) break
    }

    console.log('')
    console.log('--- バックフィル結果 ---')
    console.log(`  総投稿数       : ${totalPosts}`)
    console.log(`  タグあり投稿   : ${postsWithTags}`)
    console.log(`  Hashtag upsert : ${tagsUpserted}`)
    console.log(`  PostHashtag upsert: ${linkagesUpserted}`)

    if (!DRY_RUN) {
      console.log('')
      console.log('Hashtag.count を PostHashtag 実数で再計算中...')

      // hashtag-recount.ts の recalculateHashtagCountsCore と同等のクエリ
      await prisma.$executeRaw`
        UPDATE hashtags h SET count = (
          SELECT COUNT(*) FROM post_hashtags ph WHERE ph.hashtag_id = h.id
        )
      `

      console.log('  再計算完了')
    }

    console.log('')
    console.log(`=== バックフィル${DRY_RUN ? '（DRY RUN）' : ''}完了 ===`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err: unknown) => {
  console.error('ERROR:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
