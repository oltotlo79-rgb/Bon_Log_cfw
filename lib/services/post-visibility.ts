/**
 * @module lib/services/post-visibility
 *
 * 投稿・ユーザーの公開可否を判定する共通 predicate。
 *
 * Why: `generateMetadata()` の noindex はあくまで検索エンジン向けであり、アクセス制御の
 * 境界ではない。非公開アカウント・停止ユーザーの投稿/プロフィールは、実際にデータを返す
 * Server Function / Server Component 側で遮断する必要がある。投稿詳細・プロフィールで
 * 同じ判定を使えるよう 1 箇所に集約する（複数 page から呼ばれる再利用ロジックのため
 * `lib/services/` に置く）。
 */

import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

/**
 * 著者の公開状態。`isHidden` は投稿側の属性のため、ここには含めない
 * （呼び出し側の `where: { isHidden: false }` で除外する前提）。
 */
type AuthorVisibility = { isPublic: boolean; isSuspended: boolean }

/**
 * `viewerId` が `authorId` のフォロワーかどうか。
 */
async function isFollowing(viewerId: string, authorId: string): Promise<boolean> {
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: authorId } },
    select: { followerId: true },
  })
  return !!follow
}

/**
 * 既に取得済みの著者公開状態をもとに、viewer が著者のコンテンツを閲覧してよいかを判定する。
 *
 * - 本人は常に可
 * - 停止ユーザー（モデレーション）は本人以外不可
 * - 非公開アカウントは本人またはフォロワーのみ
 */
export async function canViewAuthorContent(
  viewerId: string | undefined,
  authorId: string,
  author: AuthorVisibility,
): Promise<boolean> {
  if (viewerId === authorId) return true
  if (author.isSuspended) return false
  if (author.isPublic) return true
  if (!viewerId) return false
  return isFollowing(viewerId, authorId)
}

/**
 * 著者IDから公開状態を引き、`canViewAuthorContent` を適用する。
 * 著者が存在しなければ不可。投稿詳細の visibility gate で使う。
 */
export async function canViewPostByAuthor(
  viewerId: string | undefined,
  authorId: string,
): Promise<boolean> {
  if (viewerId === authorId) return true
  const author = await prisma.user.findUnique({
    where: { id: authorId },
    select: { isPublic: true, isSuspended: true },
  })
  if (!author) return false
  return canViewAuthorContent(viewerId, authorId, author)
}

/**
 * viewer から見える著者（ユーザー）の Prisma relation 条件。
 * 公開面（検索・ゲスト feed・RSS・プロフィール子ページ）の `where` で共有する。
 * - 未ログイン: 公開 かつ 非停止 のみ
 * - ログイン: 加えて自分自身・フォロー中の非公開も含む
 */
export function visibleAuthorFilter(viewerId?: string): Prisma.UserWhereInput {
  return {
    isSuspended: false,
    OR: [
      { isPublic: true },
      ...(viewerId
        ? [{ id: viewerId }, { followers: { some: { followerId: viewerId } } }]
        : []),
    ],
  }
}

/**
 * viewer から見える投稿の Prisma `where` 断片（非表示除外 + 著者公開条件）。
 */
export function visiblePostWhere(viewerId?: string): Prisma.PostWhereInput {
  return { isHidden: false, user: visibleAuthorFilter(viewerId) }
}

/**
 * viewer から見えるユーザーの Prisma `where` 断片（ユーザー検索用）。
 */
export function visibleUserWhere(viewerId?: string): Prisma.UserWhereInput {
  return visibleAuthorFilter(viewerId)
}

/**
 * `postId` の投稿が viewer から閲覧可能かを判定する。engagement (comment/like/bookmark)
 * の対象リソース認可に使う。非表示・非公開著者・停止著者・存在しない投稿はすべて不可。
 */
export async function assertCanViewPost(
  viewerId: string | undefined,
  postId: string,
): Promise<boolean> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { isHidden: true, userId: true },
  })
  if (!post || post.isHidden) return false
  return canViewPostByAuthor(viewerId, post.userId)
}

/**
 * 与えた投稿 ID のうち viewer から閲覧可能なものの Set を 1 クエリで返す。
 *
 * Why: 引用元・リポスト元のようなネストした to-one relation は Prisma の `include`
 * では `where` で絞れない（親投稿の条件しか書けない）。そのため取得後にネスト元 ID を
 * 集約し、`visiblePostWhere(viewerId)` で別途バッチ取得して可視 ID を確定する
 * （N+1 を避けつつ監査しやすい形にする）。
 */
export async function getVisiblePostIds(
  viewerId: string | undefined,
  postIds: string[],
): Promise<Set<string>> {
  if (postIds.length === 0) return new Set()
  const rows = await prisma.post.findMany({
    where: { id: { in: postIds }, ...visiblePostWhere(viewerId) },
    select: { id: true },
  })
  return new Set(rows.map((r) => r.id))
}

/** ネスト元（引用元/リポスト元）を持ち得る投稿の最小形状。 */
type WithNestedPosts = {
  repostPostId?: string | null
  quotePost?: { id: string } | null
  repostPost?: { id: string } | null
}

/**
 * 投稿一覧のネスト元（引用元/リポスト元）を viewer ごとの可視性で再フィルタする。
 *
 * - 閲覧不可なネスト元は `null` に落とす（カードに本文/メディアを残さない）。
 * - 純粋リポスト（本文を持たない repost 行）で対象が不可視化した場合は、空カードを
 *   描画しないよう一覧自体から除外する。
 *
 * 外側投稿の可視性は呼び出し側の `where` 句で別途担保している前提。
 */
export async function redactNonVisibleNestedPosts<T extends WithNestedPosts>(
  viewerId: string | undefined,
  posts: T[],
): Promise<T[]> {
  const nestedIds = [
    ...new Set(
      posts
        .flatMap((p) => [p.quotePost?.id, p.repostPost?.id])
        .filter((id): id is string => !!id),
    ),
  ]
  const visible = await getVisiblePostIds(viewerId, nestedIds)

  const result: T[] = []
  for (const post of posts) {
    const quotePost = post.quotePost && visible.has(post.quotePost.id) ? post.quotePost : null
    const repostPost = post.repostPost && visible.has(post.repostPost.id) ? post.repostPost : null
    if (post.repostPostId && !repostPost) continue
    result.push({ ...post, quotePost, repostPost })
  }
  return result
}
