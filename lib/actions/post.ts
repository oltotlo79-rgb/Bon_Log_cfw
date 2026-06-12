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
import { notifyMentionedUsers } from '@/lib/services/mention'
import { createNotification } from '@/lib/services/notification-core'
import { deleteMediaFiles } from '@/lib/services/media-cleanup'
import {
  canViewAuthorContent,
  assertCanViewPost,
  visiblePostWhere,
  redactNonVisibleNestedPosts,
} from '@/lib/services/post-visibility'
import { fetchPostDetail } from '@/lib/services/post-read-service'
import { Prisma } from '@prisma/client'
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
import { parseCreatePostShape, applyCreatePostBusinessRules, applyUpdatePostBusinessRules } from './post-validation'
import { validateImageFile, validateVideoFile, generateSafeFileName } from '@/lib/file-validation'
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
  ERR_POST_UPDATE_FAILED,
  ERR_POST_NOT_EDITABLE,
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
import { buildPostPath } from '@/lib/constants/path-builders'

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
    // 対象リソース認可: 閲覧権限のない投稿（非表示/非公開/停止著者）は引用できない。
    // 著者公開状態まで 1 クエリで取得し、作成前に canViewAuthorContent で遮断する。
    const quotePost = await prisma.post.findUnique({
      where: { id: quotePostId },
      select: {
        userId: true,
        isHidden: true,
        user: { select: { isPublic: true, isSuspended: true } },
      },
    })
    if (
      !quotePost ||
      quotePost.isHidden ||
      !(await canViewAuthorContent(userId, quotePost.userId, quotePost.user))
    ) {
      return actionError(ERR_POST_NOT_FOUND)
    }

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

    // 対象リソース認可: 閲覧権限のない投稿はリポストできない。
    // 解除（toggle off）は上で済んでおり、ここを通るのは新規作成パスのみ。
    if (!(await assertCanViewPost(userId, postId))) {
      return actionError(ERR_POST_NOT_FOUND)
    }

    // 存在再確認 + 対象著者取得 + 作成を単一トランザクションで行う。
    // 別トランザクションで存在チェックすると、連打・並行リクエストで二重リポストが作られるため、
    // 作成直前に同一 tx 内で再確認する（@@unique が無いリポストの冪等化）。
    const repostResult = await prisma.$transaction(async (tx) => {
      const dup = await tx.post.findFirst({
        where: { userId, repostPostId: postId },
        select: { id: true },
      })
      if (dup) return { target: null, duplicate: true as const }

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

      return { target, duplicate: false as const }
    })

    // 既に作成済み（連打/競合）の場合は冪等に ON 扱いで返す（通知の二重送信もしない）。
    if (repostResult.duplicate) {
      revalidatePath(ROUTE_FEED)
      return actionSuccess({ reposted: true })
    }

    const repostPost = repostResult.target
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
    // unique 制約 (userId, repostPostId) 違反は並行リクエストによる二重リポスト。
    // 既に1件作成済みなので冪等に ON 扱いで返す（通知は先行リクエストが送る）。
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      revalidatePath(ROUTE_FEED)
      return actionSuccess({ reposted: true })
    }
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
      select: { userId: true, media: { select: { url: true } } },
    })

    if (!post || post.userId !== userId) {
      return actionError(ERR_PERMISSION_DENIED)
    }

    await detachHashtagsFromPost(postId)
    await prisma.post.delete({ where: { id: postId } })

    // DB カスケード後にストレージ実体も回収（オーファン防止、best-effort）
    await deleteMediaFiles(post.media.map((m) => m.url))

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

/**
 * 既存投稿の本文・ジャンル・メディアを編集する（所有者のみ・純粋リポストは不可）。
 * 編集は新規投稿ではないため 1 日上限は消費せず、editedAt を更新して「編集済み」を示す。
 *
 * @param postId - 編集対象の投稿ID
 * @param formData - content / genreIds / mediaUrls / mediaTypes
 */
export async function updatePost(postId: string, formData: FormData) {
  // 1. 認証 (非ゲスト)
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  if (!postIdSchema.safeParse(postId).success) return actionError(ERR_INVALID_INPUT)

  // 2. Zod 形状検証
  const shape = parseCreatePostShape(formData)
  if (!shape.ok) return shape.result

  // 3. レート制限 (Zod 通過後)
  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  // 4. ビジネスルール (1 日上限は消費しない)
  const validated = await applyUpdatePostBusinessRules(shape.data, userId)
  if (!validated.ok) return validated.result
  const { content, genreIds, mediaUrls, mediaTypes } = validated.data

  try {
    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true, repostPostId: true, media: { select: { url: true } } },
    })
    if (!existing || existing.userId !== userId) return actionError(ERR_PERMISSION_DENIED)
    // 純粋なリポストは本文を持たないため編集不可
    if (existing.repostPostId !== null) return actionError(ERR_POST_NOT_EDITABLE)

    // メディア・ジャンルは差し替え方式（トランザクションで原子的に置換）
    await prisma.$transaction(async (tx) => {
      await tx.postMedia.deleteMany({ where: { postId } })
      await tx.postGenre.deleteMany({ where: { postId } })
      await tx.post.update({
        where: { id: postId },
        data: {
          content: content || null,
          editedAt: new Date(),
          media: mediaUrls.length > 0 ? {
            create: mediaUrls.map((url: string, index: number) => ({
              url,
              type: mediaTypes[index] || 'image',
              sortOrder: index,
            })),
          } : undefined,
          genres: genreIds.length > 0 ? {
            create: genreIds.map((genreId: string) => ({ genreId })),
          } : undefined,
        },
      })
    })

    // 差し替えで外れた旧メディアを R2 から回収（オーファン防止、best-effort）
    const removedUrls = existing.media.map((m) => m.url).filter((url) => !mediaUrls.includes(url))
    if (removedUrls.length > 0) await deleteMediaFiles(removedUrls)

    // 本文変更を反映するためハッシュタグを貼り直す。
    // メンション通知は編集のたびに再送するとスパムになるため、編集時は再通知しない。
    await detachHashtagsFromPost(postId)
    await attachHashtagsToPost(postId, content).catch((err) => {
      logger.error('attachHashtagsToPost (update) failed', {
        postId,
        error: err instanceof Error ? err.message : String(err),
      })
    })

    revalidatePath(ROUTE_FEED)
    revalidatePath(buildPostPath(postId))
    revalidateTrendingGenresCache()
    revalidatePopularTagsCache()
    return actionSuccess({ postId })
  } catch (error) {
    logger.error('Update post failed', {
      userId,
      postId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_POST_UPDATE_FAILED)
  }
}

export async function getPost(postId: string) {
  if (!postIdSchema.safeParse(postId).success) return actionError(ERR_INVALID_INPUT)

  const session = await auth()
  const currentUserId = session?.user?.id

  const result = await fetchPostDetail(postId, currentUserId)

  if (!result.found) {
    return actionError(ERR_POST_NOT_FOUND)
  }

  return actionSuccess({ post: result.post })
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

  // 未認証時は relations 不要。公開かつ非停止著者の投稿のみを返す（visiblePostWhere）。
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

  // 認証時はフォロー/自分の投稿に絞り、停止著者（自分以外）を除外する。
  // 未認証時は公開面の可視性条件（公開・非停止）をそのまま適用する。
  const where: Prisma.PostWhereInput = currentUserId
    ? {
        isHidden: false,
        OR: [{ userId: currentUserId }, { user: { isSuspended: false } }],
        userId: {
          in: userIdsToShow,
          notIn: excludedUserIds.length > 0 ? excludedUserIds : undefined,
        },
      }
    : visiblePostWhere()

  const rawPosts = await prisma.post.findMany({
    where,
    include: {
      ...POST_LIST_INCLUDE,
      // 引用元はカード肥大を避けるため media を含めない（_getPostImpl と方針を揃える）
      quotePost: { include: { user: USER_MINIMAL_RELATION } },
      repostPost: { include: POST_REPOST_INCLUDE },
      poll: { include: buildPostPollInclude() },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...buildCursorPagination(safeCursor, safeLimit),
  })

  // 引用元・リポスト元の可視性を viewer ごとに再適用する（作成後に非表示化/非公開化された漏えいを防ぐ）。
  const posts = await redactNonVisibleNestedPosts(currentUserId, rawPosts)

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

  // 偽装 Content-Type を拒否するため、画像・動画ともにマジックバイト検証を行う。
  // /api/upload 経路と同じ検証を Server Action 直接呼び出し経路にも適用し、
  // クライアントから Server Action だけ叩かれても fail-closed になるようにする。
  if (isImage) {
    const validation = validateImageFile(buffer, file.type)
    if (!validation.valid) {
      return actionError(validation.error || ERR_IMAGE_VIDEO_SELECT)
    }
  } else if (isVideo) {
    const validation = validateVideoFile(buffer, file.type)
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
    const session = await auth()
    const viewerId = session?.user?.id

    // マイ盆栽は所有者専用リソース。関連投稿も所有者にのみ返す（非所有者は空）。
    const bonsai = await prisma.bonsai.findUnique({
      where: { id: bonsaiId },
      select: { userId: true },
    })
    if (!bonsai || bonsai.userId !== viewerId) {
      return actionSuccess({ posts: [], nextCursor: undefined })
    }

    const excludeIds = await getExcludedUserIds(viewerId, { blocked: true, muted: true })

    const posts = await prisma.post.findMany({
      where: {
        bonsaiId,
        isHidden: false,
        ...(excludeIds.length > 0 && { userId: { notIn: excludeIds } }),
      },
      ...buildCursorPagination(safeCursor, safeLimit),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
