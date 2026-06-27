/**
 * ハッシュタグ機能のServer Actions
 *
 * クライアントから呼ばれる RPC エンドポイント層。
 * 投稿作成・削除時に呼ばれる内部 helper は `lib/services/hashtag-sync.ts` に分離されている。
 *
 * ## 提供機能
 * - トレンドハッシュタグの取得
 * - ハッシュタグで投稿を検索
 * - ハッシュタグ候補の検索（オートコンプリート）
 * - 全ハッシュタグカウントの再計算（管理者専用）
 *
 * @module lib/actions/hashtag
 */

'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { shouldSkipBuildTimeDbAccess } from '@/lib/build/db-availability'
import { requireAdmin, actionError, actionSuccess } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'
import { GENRE_MINIMAL_SELECT, USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { recalculateHashtagCountsCore } from '@/lib/services/hashtag-recount'
import { visibleAuthorFilter } from '@/lib/services/post-visibility'
import { normalizeCursorPagination, clampLimit } from './pagination'
import logger from '@/lib/logger'
import { DEFAULT_HASHTAG_LIMIT, MAX_HASHTAG_LIMIT, MAX_HASHTAG_QUERY_LENGTH } from '@/lib/constants/limits'

/**
 * トレンドハッシュタグを取得する。
 *
 * サイドバーの「トレンド」セクションや検索ページのおすすめタグ表示で使用する。
 */
export async function getTrendingHashtags(limit: number = DEFAULT_HASHTAG_LIMIT) {
  if (shouldSkipBuildTimeDbAccess()) return []
  try {
    const hashtags = await prisma.hashtag.findMany({
      where: { count: { gt: 0 } },
      orderBy: { count: 'desc' },
      take: clampLimit(limit, MAX_HASHTAG_LIMIT),
    })
    return hashtags
  } catch (error) {
    logger.error('Get trending hashtags error:', error)
    return []
  }
}

/**
 * 指定ハッシュタグを含む投稿をカーソルベースで検索する。
 *
 * `hashtag.count` は `Hashtag` テーブルに保持された総投稿数を返す（今回のページ件数ではない）。
 */
export async function getPostsByHashtag(
  hashtagName: string,
  options: { cursor?: string; limit?: number } = {},
) {
  // クライアント境界から渡される cursor/limit を MAX_PAGE_LIMIT で clamp し DB 過負荷を防ぐ
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination(options)

  try {
    const session = await auth()
    const currentUserId = session?.user?.id

    // 投稿一覧と総投稿数は独立クエリなので Promise.all で並列化する。
    // findUnique は @unique 検索なのでテーブル全体への影響は限定的。
    const [posts, hashtag] = await Promise.all([
      prisma.post.findMany({
        where: {
          isHidden: false,
          // 著者の公開可否を適用（非表示/非公開/停止著者の投稿を露出させない）
          user: visibleAuthorFilter(currentUserId),
          // PostHashtag JOIN: content ILIKE より hashtagId インデックス経由で効率的に絞り込む。
          // Hashtag.name は extractHashtags() により lowercase 正規化済みのため .toLowerCase() が前提。
          hashtags: { some: { hashtag: { name: hashtagName.toLowerCase() } } },
        },
        include: {
          user: USER_MINIMAL_RELATION,
          media: { orderBy: { sortOrder: 'asc' } },
          genres: { select: { genre: { select: GENRE_MINIMAL_SELECT } } },
          _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: safeLimit,
        ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
      }),
      prisma.hashtag.findUnique({
        where: { name: hashtagName.toLowerCase() },
        select: { count: true },
      }),
    ])

    const hasMore = posts.length === safeLimit
    const nextCursor = hasMore ? posts[posts.length - 1]?.id : undefined

    return {
      posts,
      // Hashtag テーブルに見つからない場合 (誤入力タグ / 未集計) は 0 を返す。
      // 今回返した posts.length をフォールバックにしてしまうと、ページネーション中の
      // 累計件数と乖離して UI バッジが矛盾するため、あえて 0 を返す。
      hashtag: { name: hashtagName, count: hashtag?.count ?? 0 },
      nextCursor,
    }
  } catch (error) {
    logger.error('Get posts by hashtag error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { posts: [], nextCursor: undefined }
  }
}

/**
 * 全ハッシュタグのカウントを実際の PostHashtag 行数に基づいて再計算する。
 *
 * 管理者専用（全ハッシュタグに対する UPDATE でコスト大）。
 * 用途: ユーザー削除後のカウント修正、カウントドリフト疑い時のリカバリ。
 */
export async function recalculateHashtagCounts(): Promise<ActionResult> {
  const admin = await requireAdmin('hashtags:recalculate')
  if ('error' in admin) return actionError(admin.error)

  await recalculateHashtagCountsCore()
  return actionSuccess()
}

/**
 * 入力中テキストに部分一致するハッシュタグを人気順で返す（オートコンプリート）。
 */
export async function searchHashtags(query: string, limit: number = DEFAULT_HASHTAG_LIMIT) {
  if (!query || query.length < 1) return []

  // 過大入力による LIKE 走査コスト増を防ぐためクエリ長を上限で切り詰める
  const safeQuery = query.slice(0, MAX_HASHTAG_QUERY_LENGTH)

  try {
    const hashtags = await prisma.hashtag.findMany({
      where: {
        name: {
          contains: safeQuery.toLowerCase(),
          mode: 'insensitive',
        },
        count: { gt: 0 },
      },
      orderBy: { count: 'desc' },
      take: clampLimit(limit, MAX_HASHTAG_LIMIT),
    })
    return hashtags
  } catch (error) {
    logger.error('Search hashtags error:', error)
    return []
  }
}
