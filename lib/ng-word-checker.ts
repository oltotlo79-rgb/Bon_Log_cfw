/**
 * NGワードチェッカー
 *
 * 投稿・コメント作成時にNGワード辞書と照合し、
 * マッチした場合はモデレーションキューに自動登録する。
 *
 * @module lib/ng-word-checker
 */

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getRedisClient } from '@/lib/redis'
import logger from '@/lib/logger'
import { NG_WORDS_CACHE_TTL_SECONDS, NG_WORD_REGEX_MAX_LENGTH, NG_WORD_LOG_PREVIEW_LENGTH } from '@/lib/constants/limits'

const NG_WORDS_CACHE_KEY = 'ng_words:active'

type NgWordEntry = {
  word: string
  isRegex: boolean
  category: string
  compiledRegex?: RegExp
}

/**
 * Redis に保存した NG ワード配列を安全に取り出す。
 *
 * `compiledRegex` は RegExp 実体で本来非シリアライズだが、`getActiveNgWords` の
 * Redis hit 経路ではキャッシュ取得後にそのまま返す（再コンパイルしない）ため、
 * 余分フィールドを保持できるよう `.loose()` を指定する。
 *
 * `compiledRegex` を `instanceof RegExp` で判定する optional フィールドとして
 * schema に含めることで、Zod の出力型が直接 `NgWordEntry[]` と互換になり cast 不要。
 */
const cachedNgWordsSchema = z.array(
  z
    .object({
      word: z.string(),
      isRegex: z.boolean(),
      category: z.string(),
      compiledRegex: z.instanceof(RegExp).optional(),
    })
    .loose(),
)

function parseCachedNgWords(cached: unknown): NgWordEntry[] | null {
  let raw: unknown
  try {
    raw = typeof cached === 'string' ? JSON.parse(cached) : cached
  } catch {
    return null
  }
  const parsed = cachedNgWordsSchema.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data
}

/**
 * アクティブなNGワード一覧を取得（Redisキャッシュ付き）
 */
async function getActiveNgWords(): Promise<NgWordEntry[]> {
  try {
    const redis = getRedisClient()
    const cached = await redis.get(NG_WORDS_CACHE_KEY)
    if (cached) {
      const parsed = parseCachedNgWords(cached)
      if (parsed) return parsed
      // 不正なキャッシュ内容を検出したので破棄して DB から再構築する
      logger.warn('Invalid ng_words cache detected, falling back to DB')
      try {
        await redis.del(NG_WORDS_CACHE_KEY)
      } catch {
        // 削除失敗は致命的ではないので無視
      }
    }
  } catch (err) {
    logger.warn('Redis cache get failed for ng_words', { err })
  }

  const words = await prisma.ngWord.findMany({
    where: { isActive: true },
    select: { word: true, isRegex: true, category: true },
  })

  try {
    const redis = getRedisClient()
    await redis.set(NG_WORDS_CACHE_KEY, JSON.stringify(words), { ex: NG_WORDS_CACHE_TTL_SECONDS })
  } catch (err) {
    logger.warn('Redis cache set failed for ng_words', { err })
  }

  // Pre-compile regex patterns
  return words.map((entry) => {
    if (entry.isRegex) {
      if (entry.word.length > NG_WORD_REGEX_MAX_LENGTH) {
        logger.warn('NGワード正規表現が長すぎるためスキップ', { word: entry.word.slice(0, NG_WORD_LOG_PREVIEW_LENGTH) })
        return { ...entry, compiledRegex: undefined }
      }
      try {
        return { ...entry, compiledRegex: new RegExp(entry.word, 'i') }
      } catch (err) {
        logger.warn('NGワード正規表現のコンパイル失敗', { word: entry.word, err })
        return { ...entry, compiledRegex: undefined }
      }
    }
    return entry
  })
}

/**
 * NGワードキャッシュを無効化する。
 * NGワードの追加・編集・削除時に呼び出す。
 */
export async function invalidateNgWordsCache(): Promise<void> {
  try {
    const redis = getRedisClient()
    await redis.del(NG_WORDS_CACHE_KEY)
  } catch (err) {
    logger.error('invalidateNgWordsCache failed:', err)
  }
}

type CheckResult = {
  matched: boolean
  matchedWords: string[]
  categories: string[]
}

/**
 * テキストをNGワード辞書と照合する
 */
export async function checkNgWords(text: string): Promise<CheckResult> {
  if (!text || text.trim().length === 0) {
    return { matched: false, matchedWords: [], categories: [] }
  }

  const ngWords = await getActiveNgWords()
  const matchedWords: string[] = []
  const categories: string[] = []
  const normalizedText = text.toLowerCase()

  for (const entry of ngWords) {
    try {
      if (entry.isRegex) {
        if (!entry.compiledRegex) continue
        if (entry.compiledRegex.test(normalizedText)) {
          matchedWords.push(entry.word)
          if (!categories.includes(entry.category)) {
            categories.push(entry.category)
          }
        }
      } else {
        if (normalizedText.includes(entry.word.toLowerCase())) {
          matchedWords.push(entry.word)
          if (!categories.includes(entry.category)) {
            categories.push(entry.category)
          }
        }
      }
    } catch (err) {
      logger.error('NGワードチェックエラー:', { word: entry.word, err })
    }
  }

  return {
    matched: matchedWords.length > 0,
    matchedWords,
    categories,
  }
}

/**
 * コンテンツをチェックし、NGワードが見つかった場合はモデレーションキューに登録する
 */
export async function checkAndEnqueue(
  text: string,
  targetType: 'post' | 'comment',
  targetId: string,
): Promise<{ flagged: boolean; matchedWords: string[] }> {
  const result = await checkNgWords(text)

  if (result.matched) {
    await prisma.moderationQueue.create({
      data: {
        targetType,
        targetId,
        status: 'auto_flagged',
        reason: `NGワード検出: ${result.categories.join(', ')}`,
        matchedWords: result.matchedWords,
      },
    })
  }

  return { flagged: result.matched, matchedWords: result.matchedWords }
}
