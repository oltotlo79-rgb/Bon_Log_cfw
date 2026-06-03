/**
 * 投稿作成 Server Action の純粋検証ヘルパー群。
 *
 * `lib/actions/post.ts` から物理的に分離する目的:
 *
 * 1. `'use server'` 境界の責務を明確にする — `post.ts` 側はクライアントから
 *    呼ばれる薄い Action だけにし、入力検証ロジックは server-only な通常モジュール
 *    に閉じる。
 * 2. テスト容易性 — Server Action は `'use server'` ディレクティブで全 export が
 *    Action ID 付与の対象になり、ユニットテストから個別 helper を import しづらい。
 *    通常モジュールに切り出すことで in-process でそのまま import できる。
 * 3. 可読性 — `post.ts` のトップレベルにあった ~70 行の検証ロジックが減り、
 *    Server Action の主筋（DB 書き込み・revalidate）に集中できる。
 *
 * Why no `'use server'`: このファイルから export される関数はすべて helper であり、
 * クライアントから直接呼ばれる必要はない。`'use server'` を付けると Action ID 化
 * されて任意 input で外部から呼べる攻撃面になるため、付けない。
 *
 * @module lib/actions/post-validation
 */

import 'server-only'
import { z } from 'zod'
import { sanitizePostContent } from '@/lib/sanitize'
import { actionError } from '@/types/action-result'
import { validateMediaCounts, checkDailyPostLimit } from '@/lib/actions/utils'
import { getMembershipLimits } from '@/lib/premium'
import { mediaUrlListSchema, mediaTypeListSchema, type MediaType } from '@/lib/actions/schemas/common'
import { getFormString } from '@/lib/utils/form-data'
import {
  MAX_GENRES_PER_POST,
  MIN_POLL_OPTIONS,
  MAX_POLL_OPTIONS,
  MAX_POLL_OPTION_LENGTH,
  MAX_POLL_OPTIONS_JSON_LENGTH,
  VALID_POLL_DURATIONS,
} from '@/lib/constants/limits'
import {
  ERR_INVALID_INPUT,
  ERR_CONTENT_REQUIRED,
  ERR_POLL_DATA_INVALID,
  ERR_POLL_INVALID_DURATION,
  ERR_POLL_OPTIONS_COUNT,
  ERR_POLL_OPTION_TOO_LONG,
  ERR_POST_CONTENT_TOO_LONG,
  ERR_GENRE_LIMIT,
} from '@/lib/constants/errors'

// Schemas

const createPostSchema = z.object({
  content: z.string().optional().default(''),
  genreIds: z.array(z.string()).default([]),
  mediaUrls: mediaUrlListSchema,
  mediaTypes: mediaTypeListSchema,
  bonsaiId: z.string().nullable().optional(),
  pollOptions: z.string().max(MAX_POLL_OPTIONS_JSON_LENGTH).nullable().optional(),
  pollDuration: z.string().nullable().optional(),
})

// Types

export type CreatePostValidatedData = {
  content: string
  genreIds: string[]
  mediaUrls: string[]
  mediaTypes: MediaType[]
  bonsaiId: string | null | undefined
  pollOptions: string[]
  pollDuration: number
}

export type CreatePostShapeData = {
  content: string
  genreIds: string[]
  mediaUrls: string[]
  mediaTypes: MediaType[]
  bonsaiId: string | null | undefined
  pollOptionsRaw: string | null | undefined
  pollDurationRaw: string | null | undefined
}

export type ValidationFailure = { ok: false; result: ReturnType<typeof actionError> }

// Validation helpers

/**
 * Poll オプションの妥当性検証（個数・各オプションの長さ・期間ホワイトリスト）。
 *
 * `validateCreatePostShape` から呼ばれるが、形状検証段階では JSON 構造まで
 * 踏み込まないので、本関数で `JSON.parse` も含めて行う。
 *
 * @returns 成功時は `{ success: true, pollOptions, pollDuration }`、
 *          失敗時は `actionError` の戻り値
 */
export function validatePollOptions(
  pollOptionsRaw: string | null | undefined,
  pollDurationRaw: string | null | undefined,
): { success: true; pollOptions: string[]; pollDuration: number } | ReturnType<typeof actionError> {
  if (!pollOptionsRaw) {
    return { success: true, pollOptions: [], pollDuration: 0 }
  }
  let parsedRaw: unknown
  try {
    parsedRaw = JSON.parse(pollOptionsRaw)
  } catch {
    return actionError(ERR_POLL_DATA_INVALID)
  }
  // 配列要素が全て妥当な文字列であることを Zod で検証し、
  // 同時に narrow された `string[]` を取り出す（`as` 排除）。
  const optionsSchema = z
    .array(
      z
        .string()
        .min(1)
        .max(MAX_POLL_OPTION_LENGTH)
        .refine((s) => s.trim().length > 0),
    )
    .min(MIN_POLL_OPTIONS)
    .max(MAX_POLL_OPTIONS)
  const optionsResult = optionsSchema.safeParse(parsedRaw)
  if (!optionsResult.success) {
    // 個数違反と要素違反でエラーメッセージを分ける（Array でないかは個数違反扱い）。
    if (
      !Array.isArray(parsedRaw) ||
      parsedRaw.length < MIN_POLL_OPTIONS ||
      parsedRaw.length > MAX_POLL_OPTIONS
    ) {
      return actionError(ERR_POLL_OPTIONS_COUNT(MIN_POLL_OPTIONS, MAX_POLL_OPTIONS))
    }
    return actionError(ERR_POLL_OPTION_TOO_LONG(MAX_POLL_OPTION_LENGTH))
  }
  const pollOptions = optionsResult.data

  const pollDuration = parseInt(pollDurationRaw || '0', 10)
  // Why widen: VALID_POLL_DURATIONS は `readonly [n1, n2, ...]` のリテラル tuple のため
  // `Array.includes(arg)` の型が `arg is (n1 | n2 | ...)` に絞り込まれ、`number` を
  // そのまま渡せない（TS 既知の readonly tuple includes 制約）。
  if (!(VALID_POLL_DURATIONS as readonly number[]).includes(pollDuration)) {
    return actionError(ERR_POLL_INVALID_DURATION)
  }
  return { success: true, pollOptions, pollDuration }
}

/**
 * 形状検証のみを行う純粋同期 helper（DB アクセスなし）。
 *
 * 業務ロジック（プレミアム制限・1 日上限・サニタイズ後のメディア整合性）は
 * {@link applyCreatePostBusinessRules} に分離する。
 * 分離する Why: 形状エラー（malformed FormData）は DB を叩く前に弾けるため
 * テスト容易性とエラーパスの早期リターン性が上がる。
 */
export function parseCreatePostShape(
  formData: FormData,
): { ok: true; data: CreatePostShapeData } | ValidationFailure {
  const parsed = createPostSchema.safeParse({
    content: getFormString(formData, 'content') ?? '',
    genreIds: formData.getAll('genreIds'),
    mediaUrls: formData.getAll('mediaUrls'),
    mediaTypes: formData.getAll('mediaTypes'),
    bonsaiId: getFormString(formData, 'bonsaiId'),
    pollOptions: getFormString(formData, 'pollOptions'),
    pollDuration: getFormString(formData, 'pollDuration'),
  })
  if (!parsed.success) return { ok: false, result: actionError(ERR_INVALID_INPUT) }

  return {
    ok: true,
    data: {
      content: sanitizePostContent(parsed.data.content),
      genreIds: parsed.data.genreIds,
      mediaUrls: parsed.data.mediaUrls,
      mediaTypes: parsed.data.mediaTypes,
      bonsaiId: parsed.data.bonsaiId,
      pollOptionsRaw: parsed.data.pollOptions,
      pollDurationRaw: parsed.data.pollDuration,
    },
  }
}

export type UpdatePostValidatedData = {
  content: string
  genreIds: string[]
  mediaUrls: string[]
  mediaTypes: MediaType[]
}

/**
 * 投稿編集の業務ルール検証。作成版から「1 日投稿上限」と「投票検証」を除く。
 *
 * Why no daily limit: 編集は新規投稿ではないため `checkDailyPostLimit` を消費させない。
 * Why no poll: 既存の投票は票が紐づくため編集対象外（content / genre / media のみ差し替える）。
 */
export async function applyUpdatePostBusinessRules(
  shape: CreatePostShapeData,
  userId: string,
): Promise<{ ok: true; data: UpdatePostValidatedData } | ValidationFailure> {
  const { content, genreIds, mediaUrls, mediaTypes } = shape

  const limits = await getMembershipLimits(userId)

  if (!content && mediaUrls.length === 0) {
    return { ok: false, result: actionError(ERR_CONTENT_REQUIRED) }
  }
  if (content && content.length > limits.maxPostLength) {
    return { ok: false, result: actionError(ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength)) }
  }
  if (genreIds.length > MAX_GENRES_PER_POST) {
    return { ok: false, result: actionError(ERR_GENRE_LIMIT(MAX_GENRES_PER_POST)) }
  }

  const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, limits)
  if (mediaValidation && !mediaValidation.success) return { ok: false, result: mediaValidation }

  return { ok: true, data: { content, genreIds, mediaUrls, mediaTypes } }
}

/**
 * 業務ルール検証（プレミアム制限・コンテンツ必須・1 日上限・投票検証）。
 * 形状検証済みの値を受け取り、DB / Redis を叩いてユーザー固有の制限を確認する。
 */
export async function applyCreatePostBusinessRules(
  shape: CreatePostShapeData,
  userId: string,
): Promise<{ ok: true; data: CreatePostValidatedData } | ValidationFailure> {
  const { content, genreIds, mediaUrls, mediaTypes, bonsaiId, pollOptionsRaw, pollDurationRaw } = shape

  const limits = await getMembershipLimits(userId)

  if (!content && mediaUrls.length === 0) {
    return { ok: false, result: actionError(ERR_CONTENT_REQUIRED) }
  }
  if (content && content.length > limits.maxPostLength) {
    return { ok: false, result: actionError(ERR_POST_CONTENT_TOO_LONG(limits.maxPostLength)) }
  }
  if (genreIds.length > MAX_GENRES_PER_POST) {
    return { ok: false, result: actionError(ERR_GENRE_LIMIT(MAX_GENRES_PER_POST)) }
  }

  // validateMediaCounts / checkDailyPostLimit は truthy = error 形のみを返す。
  const mediaValidation = await validateMediaCounts(mediaUrls, mediaTypes, limits)
  if (mediaValidation && !mediaValidation.success) return { ok: false, result: mediaValidation }

  const pollValidation = validatePollOptions(pollOptionsRaw, pollDurationRaw)
  if (!pollValidation.success) return { ok: false, result: pollValidation }

  const dailyLimitError = await checkDailyPostLimit(userId)
  if (dailyLimitError && !dailyLimitError.success) return { ok: false, result: dailyLimitError }

  return {
    ok: true,
    data: {
      content,
      genreIds,
      mediaUrls,
      mediaTypes,
      bonsaiId,
      pollOptions: pollValidation.pollOptions,
      pollDuration: pollValidation.pollDuration,
    },
  }
}
