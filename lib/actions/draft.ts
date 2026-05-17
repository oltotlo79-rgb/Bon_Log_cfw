/**
 * 下書き機能のServer Actions
 *
 * @module lib/actions/draft
 */

'use server'

/**
 * 認証ヘルパー
 * 共通の認証チェックパターンを提供
 */
import {
  requireActiveNonGuestUser,
  requireAuth,
  checkDailyPostLimit,
  actionSuccess,
  actionError,
  enforceUserRateLimit,
} from '@/lib/actions/utils'

/**
 * Prismaクライアント
 * データベース操作に使用
 */
import { prisma } from '@/lib/db'
import { GENRE_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'

/**
 * Next.jsのキャッシュ再検証関数
 * 投稿作成後にフィードを更新するために使用
 */
import { revalidatePath } from 'next/cache'

/**
 * ロガー
 * エラーログの記録に使用
 */
import logger from '@/lib/logger'
import { z } from 'zod'
import {
  MAX_POST_CONTENT_FREE,
  MAX_POST_IMAGES_FREE,
  MAX_GENRES_PER_POST,
} from '@/lib/constants/limits'
import {
  ERR_INVALID_INPUT,
  ERR_DRAFT_NOT_FOUND,
  ERR_DRAFT_FETCH_FAILED,
  ERR_DRAFT_SAVE_FAILED,
  ERR_DRAFT_DELETE_FAILED,
  ERR_POST_CREATE_FAILED,
  ERR_DRAFT_ID_REQUIRED,
} from '@/lib/constants/errors'
import { ROUTE_FEED } from '@/lib/constants/routes'

const saveDraftSchema = z.object({
  id: z.string().min(1).optional(),
  content: z.string().max(MAX_POST_CONTENT_FREE).optional(),
  mediaUrls: z.array(z.string().min(1)).max(MAX_POST_IMAGES_FREE).optional(),
  genreIds: z.array(z.string().min(1)).max(MAX_GENRES_PER_POST).optional(),
})
const draftIdSchema = z.string().min(1, ERR_DRAFT_ID_REQUIRED)

/**
 * 下書き一覧を取得
 *
 * ## 機能概要
 * 現在のユーザーの下書き一覧を取得します。
 *
 * ## 取得内容
 * - 下書き基本情報
 * - 添付メディア
 * - 関連ジャンル
 *
 * ## 並び順
 * 更新日時の新しい順（最近編集したものが先頭）
 *
 * @returns 下書き一覧、または { error: string }
 *
 * @example
 * ```typescript
 * const { drafts } = await getDrafts()
 *
 * return (
 *   <ul>
 *     {drafts.map(draft => (
 *       <DraftCard key={draft.id} draft={draft} />
 *     ))}
 *   </ul>
 * )
 * ```
 */
export async function getDrafts() {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  try {

    const drafts = await prisma.draftPost.findMany({
      where: { userId },
      include: {
        /**
         * 添付メディア
         */
        media: { orderBy: { sortOrder: 'asc' } },
        /**
         * 関連ジャンル
         */
        genres: { select: { genreId: true, genre: { select: GENRE_MINIMAL_SELECT } } },
      },
      /**
       * 更新日時の新しい順
       */
      orderBy: { updatedAt: 'desc' },
    })

    return actionSuccess({ drafts })
  } catch (error) {
    logger.error('Get drafts error:', error)
    return actionError(ERR_DRAFT_FETCH_FAILED)
  }
}

/**
 * 下書きの件数を取得
 *
 * @returns 下書きの件数
 */
export async function getDraftCount(): Promise<number> {
  const auth = await requireAuth()
  if ('error' in auth) return 0
  const userId = auth.userId

  try {
    const count = await prisma.draftPost.count({
      where: { userId },
    })
    return count
  } catch (error) {
    logger.error('Get draft count error:', error)
    return 0
  }
}

/**
 * 下書きを保存
 *
 * ## 機能概要
 * 下書きを新規作成または更新します。
 *
 * ## 新規作成 vs 更新
 * - id が指定されていない: 新規作成
 * - id が指定されている: 既存の下書きを更新
 *
 * ## 更新時の処理
 * メディアとジャンルは削除して再作成
 * （差分更新ではなく全置換）
 *
 * @param data - 下書きデータ
 * @returns 保存された下書き、または { error: string }
 *
 * @example
 * ```typescript
 * // 新規作成
 * const result = await saveDraft({
 *   content: '投稿の本文',
 *   mediaUrls: ['/uploads/image.jpg'],
 *   genreIds: ['genre-1', 'genre-2'],
 * })
 *
 * // 既存の更新
 * const result = await saveDraft({
 *   id: 'draft-123',
 *   content: '更新した本文',
 * })
 * ```
 */
export async function saveDraft(data: {
  id?: string
  content?: string
  mediaUrls?: string[]
  genreIds?: string[]
}) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = saveDraftSchema.safeParse(data)
  if (!parsed.success) {
    return actionError(ERR_INVALID_INPUT)
  }
  const { id, content, mediaUrls, genreIds } = parsed.data

  // レート制限キーは入力 id の有無で create_draft / update_draft を切り替える (自動保存を考慮)。
  const rl = await enforceUserRateLimit(userId, id ? 'update_draft' : 'create_draft')
  if (rl) return actionError(rl.error)

  try {
    if (id) {
      /**
       * 自分の下書きかどうか確認
       */
      const existing = await prisma.draftPost.findFirst({
        where: { id, userId },
      })

      if (!existing) {
        return actionError(ERR_DRAFT_NOT_FOUND)
      }

      await prisma.$transaction([
        prisma.draftPostMedia.deleteMany({ where: { draftPostId: id } }),
        prisma.draftPostGenre.deleteMany({ where: { draftPostId: id } }),
      ])

      const draft = await prisma.draftPost.update({
        where: { id },
        data: {
          content,
          media: mediaUrls?.length
            ? {
                create: mediaUrls.map((url: string, index: number) => ({
                  url,
                  type: 'image',
                  sortOrder: index,
                })),
              }
            : undefined,
          genres: genreIds?.length
            ? {
                create: genreIds.map((genreId: string) => ({ genreId })),
              }
            : undefined,
        },
        include: {
          media: true,
          genres: { select: { genreId: true, genre: { select: GENRE_MINIMAL_SELECT } } },
        },
      })

      return actionSuccess({ draft })
    }

    const draft = await prisma.draftPost.create({
      data: {
        userId,
        content,
        media: mediaUrls?.length
          ? {
              create: mediaUrls.map((url: string, index: number) => ({
                url,
                type: 'image',
                sortOrder: index,
              })),
            }
          : undefined,
        genres: genreIds?.length
          ? {
              create: genreIds.map((genreId: string) => ({ genreId })),
            }
          : undefined,
      },
      include: {
        media: true,
        genres: { select: { genreId: true, genre: { select: GENRE_MINIMAL_SELECT } } },
      },
    })

    return actionSuccess({ draft })
  } catch (error) {
    logger.error('Save draft error:', error)
    return actionError(ERR_DRAFT_SAVE_FAILED)
  }
}

/**
 * 下書きから投稿を作成
 *
 * ## 機能概要
 * 下書きを正式な投稿として公開します。
 *
 * ## 処理フロー
 * 1. 下書きを取得
 * 2. 投稿を作成（下書きの内容をコピー）
 * 3. 下書きを削除
 * 4. フィードを再検証
 *
 * @param draftId - 下書きID
 * @returns 作成された投稿のID、または { error: string }
 *
 * @example
 * ```typescript
 * const result = await publishDraft('draft-123')
 *
 * if (result.success && result.data) {
 *   router.push(`/posts/${result.data.postId}`)
 * }
 * ```
 */
export async function publishDraft(draftId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = draftIdSchema.safeParse(draftId)
  if (!parsed.success) {
    return actionError(ERR_INVALID_INPUT)
  }
  const id = parsed.data

  const rl = await enforceUserRateLimit(userId, 'publish_draft')
  if (rl) return actionError(rl.error)

  try {
    const draft = await prisma.draftPost.findFirst({
      where: { id, userId },
      include: {
        media: { orderBy: { sortOrder: 'asc' } },
        genres: true,
      },
    })

    if (!draft) {
      return actionError(ERR_DRAFT_NOT_FOUND)
    }

    const dailyLimitError = await checkDailyPostLimit(userId)
    if (dailyLimitError) return dailyLimitError

    /**
     * 下書きの内容を投稿テーブルにコピー
     */
    const post = await prisma.post.create({
      data: {
        userId,
        content: draft.content,
        /**
         * メディアをコピー
         */
        media: draft.media.length
          ? {
              create: draft.media.map((m: typeof draft.media[number]) => ({
                url: m.url,
                type: m.type,
                sortOrder: m.sortOrder,
              })),
            }
          : undefined,
        /**
         * ジャンルをコピー
         */
        genres: draft.genres.length
          ? {
              create: draft.genres.map((g: typeof draft.genres[number]) => ({ genreId: g.genreId })),
            }
          : undefined,
      },
    })

    /**
     * 投稿が作成されたら下書きは不要
     *
     * カスケード削除で関連する media, genres も削除
     */
    await prisma.draftPost.delete({ where: { id } })

    revalidatePath(ROUTE_FEED)
    return actionSuccess({ postId: post.id })
  } catch (error) {
    logger.error('Publish draft error:', error)
    return actionError(ERR_POST_CREATE_FAILED)
  }
}

/**
 * 下書きを削除
 *
 * ## 機能概要
 * 下書きを削除します。
 *
 * ## カスケード削除
 * 関連するメディア・ジャンルも自動削除
 *
 * @param draftId - 下書きID
 * @returns 成功時は { success: true }、失敗時は { error: string }
 *
 * @example
 * ```typescript
 * const result = await deleteDraft('draft-123')
 *
 * if (result.success) {
 *   toast.success('下書きを削除しました')
 * }
 * ```
 */
export async function deleteDraft(draftId: string) {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  const parsed = draftIdSchema.safeParse(draftId)
  if (!parsed.success) {
    return actionError(ERR_INVALID_INPUT)
  }

  const rl = await enforceUserRateLimit(userId, 'delete_draft')
  if (rl) return actionError(rl.error)
  const id = parsed.data

  try {
    const draft = await prisma.draftPost.findFirst({
      where: { id, userId },
    })

    if (!draft) {
      return actionError(ERR_DRAFT_NOT_FOUND)
    }

    await prisma.draftPost.delete({ where: { id, userId } })

    return actionSuccess()
  } catch (error) {
    logger.error('Delete draft error:', error)
    return actionError(ERR_DRAFT_DELETE_FAILED)
  }
}

/**
 * 下書き詳細を取得
 *
 * ## 機能概要
 * 指定された下書きの詳細を取得します。
 *
 * ## 用途
 * - 下書きの編集画面
 * - 下書きのプレビュー
 *
 * @param draftId - 下書きID
 * @returns 下書き詳細、または { error: string }
 *
 * @example
 * ```typescript
 * const { draft } = await getDraft('draft-123')
 *
 * // 編集フォームに初期値を設定
 * setContent(draft.content)
 * setMediaUrls(draft.media.map(m => m.url))
 * setGenreIds(draft.genres.map(g => g.genreId))
 * ```
 */
export async function getDraft(draftId: string) {
  // 1. 認証（読み取り系なのでレート制限・非ゲスト判定は省略、ただし認証は必須）
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  // 2. 入力の境界検証（ERR_INVALID_INPUT で統一）
  const parsed = draftIdSchema.safeParse(draftId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)
  const id = parsed.data

  try {
    const draft = await prisma.draftPost.findFirst({
      where: { id, userId },
      include: {
        /**
         * 添付メディア
         */
        media: { orderBy: { sortOrder: 'asc' } },
        /**
         * 関連ジャンル
         */
        genres: { select: { genreId: true, genre: { select: GENRE_MINIMAL_SELECT } } },
      },
    })

    if (!draft) {
      return actionError(ERR_DRAFT_NOT_FOUND)
    }

    return actionSuccess({ draft })
  } catch (error) {
    logger.error('Get draft error:', error)
    return actionError(ERR_DRAFT_FETCH_FAILED)
  }
}
