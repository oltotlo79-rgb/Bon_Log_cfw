/**
 * @module lib/services/post-read-service
 * 投稿詳細取得のクエリ・整形ロジック。
 *
 * lib/actions/post.ts の getPost と app/api/v1/posts/[id] の双方から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { canViewPostByAuthor, getVisiblePostIds } from '@/lib/services/post-visibility'
import {
  POST_REPOST_INCLUDE,
  buildPostPollInclude,
} from '@/lib/actions/post-include'

/** fetchPostDetail の内部クエリ形状（Prisma 推論型のエイリアス）。 */
type PostQueryResult = NonNullable<Awaited<ReturnType<typeof queryPostDetail>>>

async function queryPostDetail(postId: string, viewerId: string | undefined) {
  return prisma.post.findUnique({
    where: { id: postId, isHidden: false },
    include: {
      user: USER_MINIMAL_RELATION,
      media: { orderBy: { sortOrder: 'asc' } },
      genres: { include: { genre: true } },
      _count: {
        select: { likes: true, comments: { where: { deletedAt: null } }, repostedBy: true },
      },
      quotePost: { include: { user: USER_MINIMAL_RELATION } },
      repostPost: { include: POST_REPOST_INCLUDE },
      poll: { include: buildPostPollInclude(viewerId) },
    },
  })
}

export type PostDetailResult =
  | { found: false }
  | { found: true; post: PostDetailFormatted }

export type PostDetailFormatted = Omit<PostQueryResult, '_count' | 'genres' | 'quotePost' | 'repostPost'> & {
  likeCount: number
  commentCount: number
  repostCount: number
  genres: { id: string; name: string; category: string }[]
  quotePost: PostQueryResult['quotePost']
  repostPost: PostQueryResult['repostPost']
  isLiked: boolean
  isBookmarked: boolean
}

/**
 * 投稿詳細を取得し、表示権限チェックを行う。
 * 非表示・非公開著者・停止著者・ブロック関係は呼び出し元が別途制御する。
 * 不可視な投稿は found: false を返す（情報漏えい防止のため 404 相当）。
 */
export async function fetchPostDetail(
  postId: string,
  viewerId: string | undefined,
): Promise<PostDetailResult> {
  const post = await queryPostDetail(postId, viewerId)

  if (!post) return { found: false }

  if (!(await canViewPostByAuthor(viewerId, post.userId))) {
    return { found: false }
  }

  const nestedIds = [post.quotePost?.id, post.repostPost?.id].filter(
    (id): id is string => !!id,
  )
  const visibleNestedIds = await getVisiblePostIds(viewerId, nestedIds)

  const quotePost =
    post.quotePost && visibleNestedIds.has(post.quotePost.id) ? post.quotePost : null
  const repostPost =
    post.repostPost && visibleNestedIds.has(post.repostPost.id) ? post.repostPost : null

  let isLiked = false
  let isBookmarked = false

  if (viewerId) {
    const [like, bookmark] = await Promise.all([
      prisma.like.findFirst({
        where: { userId: viewerId, postId, commentId: null },
      }),
      prisma.bookmark.findUnique({
        where: { userId_postId: { userId: viewerId, postId } },
      }),
    ])
    isLiked = !!like
    isBookmarked = !!bookmark
  }

  return {
    found: true,
    post: {
      ...post,
      quotePost,
      repostPost,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      repostCount: post._count.repostedBy,
      genres: post.genres.map((pg) => pg.genre),
      isLiked,
      isBookmarked,
    },
  }
}
