/**
 * 投稿取得時の共通 Prisma include/select 定義。
 * feed, search, like, bookmark 等で共通利用する。
 *
 * このファイルは定数と純粋関数のみを含むため 'use server' は不要。
 * Server Action ファイルからインポートして使用する。
 */

import { USER_MINIMAL_RELATION, POST_GENRE_RELATION } from '@/lib/prisma/shared-includes'

/** 投稿一覧取得用の共通 include */
export const POST_LIST_INCLUDE = {
  user: USER_MINIMAL_RELATION,
  media: {
    orderBy: { sortOrder: 'asc' as const },
  },
  genres: POST_GENRE_RELATION,
  _count: {
    select: { likes: true, comments: { where: { deletedAt: null } } },
  },
} as const

/**
 * 引用元投稿（quotePost）取得用の共通 include。
 * 引用カードの表示に必要な最小フィールド（投稿者情報・メディア）を含む。
 */
export const POST_QUOTE_INCLUDE = {
  user: USER_MINIMAL_RELATION,
  media: { orderBy: { sortOrder: 'asc' as const } },
} as const

/**
 * リポスト元投稿（repostPost）取得用の共通 include。
 * 形は {@link POST_QUOTE_INCLUDE} と同等だが、意図を区別するため別エクスポートにする
 * （将来どちらか片方だけフィールドが追加されても破壊的変更を局所化できる）。
 */
export const POST_REPOST_INCLUDE = {
  user: USER_MINIMAL_RELATION,
  media: { orderBy: { sortOrder: 'asc' as const } },
} as const

/**
 * アンケート（poll）取得用の include を生成する。
 *
 * `currentUserId` が渡されると、そのユーザーが投票したオプション情報も付与する
 * （未投票時は空配列）。未認証ユーザー向けにはこの relation を取得しない。
 *
 * @param currentUserId 現在ログイン中のユーザー ID。未指定なら投票履歴は取得しない
 */
export function buildPostPollInclude(currentUserId?: string) {
  return {
    options: {
      orderBy: { sortOrder: 'asc' as const },
      include: { _count: { select: { votes: true } } },
    },
    ...(currentUserId
      ? {
          votes: {
            where: { userId: currentUserId },
            take: 1,
          },
        }
      : {}),
    _count: { select: { votes: true } },
  } as const
}

/**
 * 投稿データをクライアント表示用にフォーマットする。
 * _count → likeCount/commentCount、genres のネスト解除、いいね/ブックマーク状態を付与。
 */
export function formatPostForClient<T extends {
  id: string
  _count: { likes: number; comments: number }
  genres: { genre: { id: string; name: string; category: string } }[]
}>(
  post: T,
  likedSet: Set<string>,
  bookmarkedSet: Set<string>,
) {
  return {
    ...post,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    genres: post.genres.map((pg) => pg.genre),
    isLiked: likedSet.has(post.id),
    isBookmarked: bookmarkedSet.has(post.id),
  }
}
