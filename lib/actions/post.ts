/**
 * 投稿関連のServer Actions
 * 投稿の作成・削除・取得、引用投稿、リポスト、メディアアップロードを提供する。
 * @module lib/actions/post
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { getMembershipLimits } from '@/lib/premium'
import { sanitizePostContent } from '@/lib/sanitize'
import { checkUserRateLimit, checkDailyLimit } from '@/lib/rate-limit'
import {
  attachHashtagsToPost,
  detachHashtagsFromPost,
  extractHashtags,
} from '@/lib/services/hashtag-sync'
import { notifyMentionedUsers } from './mention'
import { createNotification } from '@/lib/services/notification-core'
import { requireActiveNonGuestUser, requireAuth, getPostInteractionSets, checkDailyPostLimit, getUserRelationSets, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { getExcludedUserIds } from '@/lib/actions/filter-helper'
import {
  getCachedGenres,
  revalidateTrendingGenresCache,
  revalidatePopularTagsCache,
} from '@/lib/cache'
import {
  POST_LIST_INCLUDE,
  POST_REPOST_INCLUDE,
  buildPostPollInclude,
} from './post-include'
import { parseCreatePostShape, applyCreatePostBusinessRules } from './post-validation'
import { validateImageFile, generateSafeFileName } from '@/lib/file-validation'
import logger from '@/lib/logger'
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  ONE_SECOND_MS,
} from '@/lib/constants/limits'
import {
  ERR_RATE_LIMIT_UPLOAD,
  ERR_FILE_NOT_SELECTED,
  ERR_IMAGE_SIZE_EXCEEDED,
  ERR_VIDEO_SIZE_EXCEEDED,
  ERR_IMAGE_VIDEO_SELECT,
  ERR_INVALID_INPUT,
  ERR_POST_CREATE_FAILED,
  ERR_POST_DELETE_FAILED,
  ERR_POST_NOT_FOUND,
  ERR_PERMISSION_DENIED,
  ERR_REPOST_FAILED,
  ERR_QUOTE_REQUIRED,
  ERR_UPLOAD_FAILED,
  ERR_POST_CONTENT_TOO_LONG,
  ERR_DAILY_UPLOAD_LIMIT,
  ERR_OPERATION_FAILED,
} from '@/lib/constants/errors'
import {
  STORAGE_FOLDER_POST_IMAGES,
  STORAGE_FOLDER_POST_VIDEOS,
} from '@/lib/constants/storage'
import { ROUTE_FEED } from '@/lib/constants/routes'

const postIdSchema = z.string().min(1)

/**
 * リスト系 Server Action の cursor / limit 共通スキーマ。
 *
 * Why: クライアントから任意の limit (例: 1e9) が指定されると Prisma が即時に
 * 大量行を取得しメモリ・DB 負荷が爆発するため、必ず上限 MAX_PAGE_LIMIT で
 * クランプする。cursor は cuid 形式チェックは過剰なので長さのみ妥当性検証。
 */
const listPaginationSchema = z.object({
  cursor: z.string().min(1).max(64).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT),
})

const createQuotePostSchema = z.object({
  content: z.string().optional().default(''),
})

export async function createPost(formData: FormData) {
  // 1. 認証 (非ゲスト)
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  // 2. Zod 形状検証 (DB / Redis に触れない pure validation)
  const shape = parseCreatePostShape(formData)
  if (!shape.ok) return shape.result

  // 3. レート制限 (Zod 通過後・business logic 前)
  const rl = await enforceUserRateLimit(userId, 'post')
  if (rl) return actionError(rl.error)

  // 4. ビジネスルール (membership / daily limit / media count 等、DB/Redis アクセスを含む)
  const validated = await applyCreatePostBusinessRules(shape.data, userId)
  if (!validated.ok) return validated.result

  const { content, genreIds, mediaUrls, mediaTypes, bonsaiId, pollOptions, pollDuration } = validated.data

  try {
    const post = await prisma.post.create({
      data: {
        userId,
        content: content || null,
        bonsaiId: bonsaiId || null,
        media: mediaUrls.length > 0 ? {
          create: mediaUrls.map((url: string, index: number) => ({
            url,
            type: mediaTypes[index] || 'image',
            sortOrder: index,
          })),
        } : undefined,
        genres: genreIds.length > 0 ? {
          create: genreIds.map((genreId: string) => ({
            genreId,
          })),
        } : undefined,
        poll: pollOptions.length > 0 ? {
          create: {
            duration: pollDuration,
            expiresAt: new Date(Date.now() + pollDuration * ONE_SECOND_MS),
            options: {
              create: pollOptions.map((text: string, index: number) => ({
                text: text.trim(),
                sortOrder: index,
              })),
            },
          },
        } : undefined,
      },
    })

    // ハッシュタグ紐付け・メンション通知は投稿の成否に影響させない（失敗時はログのみ）。
    // 並列化することで両者のレイテンシを直列加算ではなく max(a, b) に圧縮する。
    // Vercel Serverless では関数終了後に background promise が打ち切られる可能性があるため、
    // fire-and-forget ではなく Promise.allSettled で完了を待ってからレスポンスを返す。
    await Promise.allSettled([
      attachHashtagsToPost(post.id, content).catch((err) => {
        logger.error('attachHashtagsToPost failed', {
          postId: post.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }),
      notifyMentionedUsers(post.id, content, userId).catch((err) => {
        logger.error('notifyMentionedUsers failed', {
          postId: post.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }),
    ])

    revalidatePath(ROUTE_FEED)
    if (genreIds.length > 0) revalidateTrendingGenresCache()
    if (extractHashtags(content).length > 0) revalidatePopularTagsCache()
    return actionSuccess({ postId: post.id })
  } catch (error) {
    logger.error('Create post failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_POST_CREATE_FAILED)
  }
}

/**
 * @param formData - 引用コメントのフォームデータ
 * @param quotePostId - 引用元の投稿ID
 * @returns 成功時は { success, postId }、失敗時は { error }
 */
export async function createQuotePost(formData: FormData, quotePostId: string) {
  // 1. 認証 (非ゲスト)
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  // 2. Zod 形状検証 (DB / Redis に触れない pure validation)
  const parsed = createQuotePostSchema.safeParse({
    content: formData.get('content') || '',
  })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  if (!postIdSchema.safeParse(quotePostId).success) return actionError(ERR_INVALID_INPUT)

  const content = sanitizePostContent(parsed.data.content)

  if (!content) {
    return actionError(ERR_QUOTE_REQUIRED)
  }

  // 3. レート制限 (Zod 通過後・business logic 前)
  const rl = await enforceUserRateLimit(userId, 'post')
  if (rl) return actionError(rl.error)

  // 4. ビジネスルール (membership / daily limit、DB/Redis アクセスを含む)
  const limits = await getMembershipLimits(userId)

  if (content.length > limits.maxPostLength) {
    return actionError(ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength))
  }

  const dailyLimitError = await checkDailyPostLimit(userId)
  if (dailyLimitError) return dailyLimitError

  try {
    // Fetch quote target owner before creating the post to avoid extra query
    const quotePost = await prisma.post.findUnique({
      where: { id: quotePostId },
      select: { userId: true },
    })

    const post = await prisma.post.create({
      data: {
        userId,
        content,
        quotePostId,
      },
    })

    await attachHashtagsToPost(post.id, content)
    await notifyMentionedUsers(post.id, content, userId)

    if (quotePost && quotePost.userId !== userId) {
      await createNotification({
        userId: quotePost.userId,
        actorId: userId,
        type: 'quote',
        postId: post.id,
      })
    }

    revalidatePath(ROUTE_FEED)
    if (extractHashtags(content).length > 0) revalidatePopularTagsCache()
    return actionSuccess({ postId: post.id })
  } catch (error) {
    logger.error('Create quote post failed', {
      userId,
      quotePostId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_POST_CREATE_FAILED)
  }
}

/**
 * @param postId - リポスト対象の投稿ID
 * @returns 成功時は { success, reposted }、失敗時は { error }
 */
export async function createRepost(postId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!postIdSchema.safeParse(postId).success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'post')
  if (rl) return actionError(rl.error)

  try {
    // リポスト済みチェック + 削除/作成をトランザクションで原子的に実行
    const txResult = await prisma.$transaction(async (tx) => {
      const existing = await tx.post.findFirst({
        where: {
          userId,
          repostPostId: postId,
        },
      })

      if (existing) {
        await tx.post.delete({ where: { id: existing.id } })
        return { reposted: false }
      }

      return { reposted: true }
    })

    if (!txResult.reposted) {
      revalidatePath(ROUTE_FEED)
      return actionSuccess({ reposted: false })
    }

    const dailyLimitError = await checkDailyPostLimit(userId)
    if (dailyLimitError) return dailyLimitError

    // Fetch repost target owner + create post in a single transaction
    const repostPost = await prisma.$transaction(async (tx) => {
      const target = await tx.post.findUnique({
        where: { id: postId },
        select: { userId: true },
      })

      await tx.post.create({
        data: {
          userId,
          repostPostId: postId,
        },
      })

      return target
    })

    if (repostPost && repostPost.userId !== userId) {
      // 通知作成は createNotification 経由に統一（CLAUDE.md ルール6）。
      // ブロック関係・通知設定・重複チェック・プッシュ通知送信は内部で処理される。
      await createNotification({
        userId: repostPost.userId,
        actorId: userId,
        type: 'repost',
        postId,
      })
    }

    revalidatePath(ROUTE_FEED)
    return actionSuccess({ reposted: true })
  } catch (error) {
    logger.error('Create repost failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_REPOST_FAILED)
  }
}

/**
 * @param postId - 削除する投稿のID
 * @returns 成功時は { success }、失敗時は { error }
 */
export async function deletePost(postId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!postIdSchema.safeParse(postId).success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'delete_post')
  if (rl) return actionError(rl.error)

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (!post || post.userId !== userId) {
      return actionError(ERR_PERMISSION_DENIED)
    }

    await detachHashtagsFromPost(postId)
    await prisma.post.delete({ where: { id: postId } })

    revalidatePath(ROUTE_FEED)
    revalidateTrendingGenresCache()
    revalidatePopularTagsCache()
    return actionSuccess()
  } catch (error) {
    logger.error('Delete post failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_POST_DELETE_FAILED)
  }
}

export async function getPost(postId: string): Promise<ReturnType<typeof _getPostImpl>> {
  return _getPostImpl(postId)
}

async function _getPostImpl(postId: string) {
  if (!postIdSchema.safeParse(postId).success) return actionError(ERR_INVALID_INPUT)

  const session = await auth()
  const currentUserId = session?.user?.id

  const post = await prisma.post.findUnique({
    where: { id: postId, isHidden: false },
    include: {
      user: USER_MINIMAL_RELATION,
      media: { orderBy: { sortOrder: 'asc' } },
      genres: { include: { genre: true } },
      _count: {
        select: { likes: true, comments: { where: { deletedAt: null } } },
      },
      // 単一投稿詳細での引用元は意図的に media を含めない（カードプレビューの肥大を避ける）。
      // タイムライン側の POST_QUOTE_INCLUDE とは別系統で運用する。
      quotePost: { include: { user: USER_MINIMAL_RELATION } },
      repostPost: { include: POST_REPOST_INCLUDE },
      poll: { include: buildPostPollInclude(currentUserId) },
    },
  })

  if (!post) {
    return actionError(ERR_POST_NOT_FOUND)
  }

  let isLiked = false
  let isBookmarked = false

  if (currentUserId) {
    const [like, bookmark] = await Promise.all([
      prisma.like.findFirst({
        where: {
          userId: currentUserId,
          postId: postId,
          commentId: null,
        },
      }),
      prisma.bookmark.findUnique({
        where: {
          userId_postId: {
            userId: currentUserId,
            postId: postId,
          },
        },
      }),
    ])
    isLiked = !!like
    isBookmarked = !!bookmark
  }

  return actionSuccess({
    post: {
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
      isLiked,
      isBookmarked,
    },
  })
}

/**
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（MAX_PAGE_LIMIT で上限クランプ）
 * @returns タイムラインの投稿一覧（不正入力時は空配列）
 */
export async function getPosts(cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  // 不正な cursor / limit はサイレントにデフォルト値へフォールバックさせず、
  // クランプ後の値で続行する（DoS 防止）。
  const parsedPagination = listPaginationSchema.safeParse({ cursor, limit })
  if (!parsedPagination.success) {
    return { posts: [] }
  }
  const { cursor: safeCursor, limit: safeLimit } = parsedPagination.data

  const session = await auth()
  const currentUserId = session?.user?.id

  // 未認証時は relations 不要（タイムラインの絞り込みは行わず公開投稿のみ）。
  // 認証済みなら Redis キャッシュ + React cache でメモ化された 1 回のクエリで取得。
  const relations = currentUserId
    ? await getUserRelationSets(currentUserId)
    : null

  const userIdsToShow = currentUserId
    ? [currentUserId, ...(relations?.followingUserIds ?? [])]
    : []

  const excludedUserIds = [
    ...(relations?.blockedUserIds ?? []),
    ...(relations?.mutedUserIds ?? []),
  ]

  const posts = await prisma.post.findMany({
    where: {
      isHidden: false,
      ...(currentUserId && {
        userId: {
          in: userIdsToShow,
          notIn: excludedUserIds.length > 0 ? excludedUserIds : undefined,
        },
      }),
    },
    include: {
      ...POST_LIST_INCLUDE,
      // 引用元はカード肥大を避けるため media を含めない（_getPostImpl と方針を揃える）
      quotePost: { include: { user: USER_MINIMAL_RELATION } },
      repostPost: { include: POST_REPOST_INCLUDE },
      poll: { include: buildPostPollInclude() },
    },
    orderBy: { createdAt: 'desc' },
    ...buildCursorPagination(safeCursor, safeLimit),
  })

  const { likedSet, bookmarkedSet } = currentUserId
    ? await getPostInteractionSets(currentUserId, posts.map((p: typeof posts[number]) => p.id))
    : { likedSet: new Set<string>(), bookmarkedSet: new Set<string>() }

  return {
    posts: posts.map((post: typeof posts[number]) => ({
      ...post,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      genres: post.genres.map((pg: typeof post.genres[number]) => pg.genre),
      isLiked: likedSet.has(post.id),
      isBookmarked: bookmarkedSet.has(post.id),
    })),
  }
}

/** @returns カテゴリ別にグループ化されたジャンル一覧 */
export async function getGenres() {
  const result = await getCachedGenres()
  return { genres: result.genres }
}

export async function uploadPostMedia(formData: FormData) {
  // 1. 認証
  const authResult = await requireAuth()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  // 2. 入力検証 (file の存在 / type / size / magic byte)。
  //    未検証入力で rate / daily limit を消費しないため必ず順序を守る。
  const rawFile = formData.get('file')
  if (!(rawFile instanceof File)) {
    return actionError(ERR_FILE_NOT_SELECTED)
  }
  const file = rawFile

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')

  if (!isVideo && !isImage) {
    return actionError(ERR_IMAGE_VIDEO_SELECT)
  }

  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
  if (file.size > maxSize) {
    return actionError(isVideo ? ERR_VIDEO_SIZE_EXCEEDED : ERR_IMAGE_SIZE_EXCEEDED)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // 画像はマジックバイト検証で偽装 Content-Type を拒否する
  if (isImage) {
    const validation = validateImageFile(buffer, file.type)
    if (!validation.valid) {
      return actionError(validation.error || ERR_IMAGE_VIDEO_SELECT)
    }
  }

  // 3. レート制限 / 日次上限 (入力検証後にのみ消費)
  const rateLimitResult = await checkUserRateLimit(userId, 'upload')
  if (!rateLimitResult.success) {
    return actionError(ERR_RATE_LIMIT_UPLOAD)
  }

  // R2 課金保護のため Redis 障害時も fail-closed
  const dailyLimitResult = await checkDailyLimit(userId, 'upload', { failOpen: false })
  if (!dailyLimitResult.allowed) {
    return actionError(ERR_DAILY_UPLOAD_LIMIT(dailyLimitResult.limit))
  }

  // 4. アップロード本処理
  try {
    const { uploadFile } = await import('@/lib/storage')
    const folder = isVideo ? STORAGE_FOLDER_POST_VIDEOS : STORAGE_FOLDER_POST_IMAGES
    const safeName = generateSafeFileName(file.name, file.type)
    const result = await uploadFile(buffer, safeName, file.type, folder)

    if (!result.success || !result.url) {
      if (result.error) logger.error('Post media upload failed:', result.error)
      return actionError(ERR_UPLOAD_FAILED)
    }

    return actionSuccess({
      url: result.url,
      type: isVideo ? 'video' : 'image',
    })
  } catch (error) {
    logger.error('Upload post media error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_UPLOAD_FAILED)
  }
}

/**
 * @param bonsaiId - 盆栽ID
 * @param cursor - ページネーション用カーソル
 * @param limit - 取得件数（MAX_PAGE_LIMIT で上限クランプ）
 * @returns 投稿一覧と次のカーソル
 */
export async function getPostsByBonsai(
  bonsaiId: string,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT
) {
  if (!postIdSchema.safeParse(bonsaiId).success) {
    return actionError(ERR_INVALID_INPUT)
  }
  const parsedPagination = listPaginationSchema.safeParse({ cursor, limit })
  if (!parsedPagination.success) {
    return actionError(ERR_INVALID_INPUT)
  }
  const { cursor: safeCursor, limit: safeLimit } = parsedPagination.data

  try {
    // ログイン中ならブロック/ミュートユーザーを除外
    const session = await auth()
    const excludeIds =
      session?.user?.id
        ? await getExcludedUserIds(session.user.id, { blocked: true, muted: true })
        : []

    const posts = await prisma.post.findMany({
      where: {
        bonsaiId,
        ...(excludeIds.length > 0 && { userId: { notIn: excludeIds } }),
      },
      ...buildCursorPagination(safeCursor, safeLimit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: USER_MINIMAL_RELATION,
        media: { orderBy: { sortOrder: 'asc' } },
        genres: { include: { genre: true } },
        _count: {
          select: {
            likes: true,
            comments: { where: { deletedAt: null } },
          },
        },
      },
    })

    const hasMore = posts.length === safeLimit
    const nextCursor = hasMore ? posts[posts.length - 1]?.id : undefined

    return actionSuccess({ posts, nextCursor })
  } catch (error) {
    // Why actionError: 旧実装は `actionSuccess({ posts: [] })` で握り潰していたが、
    // 「該当 0 件」と「DB 障害」を呼び出し側が区別できず UI が「投稿がありません」を
    // 表示してしまうサイレント障害となる。エラーは ActionResult の error として伝播し、
    // UI 側 error.tsx / リトライ UI で扱う責務とする。
    logger.error('Get posts by bonsai failed', {
      bonsaiId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_OPERATION_FAILED)
  }
}
