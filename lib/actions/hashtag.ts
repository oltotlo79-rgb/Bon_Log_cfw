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
import { requireAdmin, actionError, actionSuccess } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'
import { GENRE_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { recalculateHashtagCountsCore } from '@/lib/services/hashtag-recount'
import logger from '@/lib/logger'
import { DEFAULT_PAGE_LIMIT, DEFAULT_HASHTAG_LIMIT } from '@/lib/constants/limits'

/**
 * トレンドハッシュタグを取得する。
 *
 * サイドバーの「トレンド」セクションや検索ページのおすすめタグ表示で使用する。
 */
export async function getTrendingHashtags(limit: number = DEFAULT_HASHTAG_LIMIT) {
  try {
    const hashtags = await prisma.hashtag.findMany({
      where: { count: { gt: 0 } },
      orderBy: { count: 'desc' },
      take: limit,
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
 * `content` の `#hashtagName` 部分一致（大小文字無視）。
 */
export async function getPostsByHashtag(
  hashtagName: string,
  options: { cursor?: string; limit?: number } = {},
) {
  const { limit = DEFAULT_PAGE_LIMIT } = options

  try {
    const posts = await prisma.post.findMany({
      where: {
        isHidden: false,
        content: {
          contains: `#${hashtagName}`,
          mode: 'insensitive',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
          },
        },
        media: { orderBy: { sortOrder: 'asc' } },
        genres: { select: { genre: { select: GENRE_MINIMAL_SELECT } } },
        _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const hasMore = posts.length === limit
    const nextCursor = hasMore ? posts[posts.length - 1]?.id : undefined

    return {
      posts,
      hashtag: { name: hashtagName, count: posts.length },
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

  try {
    const hashtags = await prisma.hashtag.findMany({
      where: {
        name: {
          contains: query.toLowerCase(),
          mode: 'insensitive',
        },
        count: { gt: 0 },
      },
      orderBy: { count: 'desc' },
      take: limit,
    })
    return hashtags
  } catch (error) {
    logger.error('Search hashtags error:', error)
    return []
  }
}
