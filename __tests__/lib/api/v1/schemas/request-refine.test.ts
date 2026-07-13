// @vitest-environment node
/**
 * lib/api/v1/schemas/request.ts の `.refine()` 分岐カバレッジテスト。
 *
 * geocodeQuerySchema は request.test.ts で担保済み。ここでは refine を持つ
 * その他のスキーマについて、valid/invalid 双方の分岐を検証する。
 * route handler レベルの正常系/エラー系は各 route.test.ts で
 * 別途担保されているため、ここではスキーマ自体の境界・refine 条件に焦点を当てる。
 */
import { describe, it, expect } from 'vitest'
import {
  registerRequestSchema,
  updateProfileRequestSchema,
  createPostRequestSchema,
  updatePostRequestSchema,
  listEventsQuerySchema,
  listShopsQuerySchema,
  createShopRequestSchema,
  updateShopRequestSchema,
  sendMessageRequestSchema,
} from '@/lib/api/v1/schemas/request'

describe('registerRequestSchema.nickname - 禁止文字 refine', () => {
  const base = { email: 'user@example.com', password: 'ValidPass123', termsAccepted: true as const }

  it('通常の nickname は成功する', () => {
    const result = registerRequestSchema.safeParse({ ...base, nickname: '盆栽太郎' })
    expect(result.success).toBe(true)
  })

  it('改行コード(\\n)を含む nickname は refine で拒否される', () => {
    const result = registerRequestSchema.safeParse({ ...base, nickname: 'a\nb' })
    expect(result.success).toBe(false)
  })

  it('CR(\\r)を含む nickname は refine で拒否される', () => {
    const result = registerRequestSchema.safeParse({ ...base, nickname: 'a\rb' })
    expect(result.success).toBe(false)
  })

  it('< を含む nickname は refine で拒否される（XSS対策）', () => {
    const result = registerRequestSchema.safeParse({ ...base, nickname: '<script>' })
    expect(result.success).toBe(false)
  })

  it('> を含む nickname は refine で拒否される', () => {
    const result = registerRequestSchema.safeParse({ ...base, nickname: 'a>b' })
    expect(result.success).toBe(false)
  })
})

describe('updateProfileRequestSchema.nickname - 禁止文字 refine', () => {
  it('nickname を省略した場合は refine 自体が走らず成功する（optional）', () => {
    const result = updateProfileRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('通常の nickname は成功する', () => {
    const result = updateProfileRequestSchema.safeParse({ nickname: '盆栽太郎' })
    expect(result.success).toBe(true)
  })

  it('禁止文字を含む nickname は refine で拒否される', () => {
    const result = updateProfileRequestSchema.safeParse({ nickname: '<b>bold</b>' })
    expect(result.success).toBe(false)
  })
})

describe('createPostRequestSchema.poll.durationSeconds - VALID_POLL_DURATIONS refine', () => {
  it('poll を省略した場合は成功する（poll 自体が optional）', () => {
    const result = createPostRequestSchema.safeParse({ content: '投票なし投稿' })
    expect(result.success).toBe(true)
  })

  it('VALID_POLL_DURATIONS に含まれる値（86400 = 1日）は成功する', () => {
    const result = createPostRequestSchema.safeParse({
      content: 'アンケート',
      poll: { options: ['A', 'B'], durationSeconds: 86400 },
    })
    expect(result.success).toBe(true)
  })

  it('durationSeconds を省略した場合は DEFAULT_POLL_DURATION_SECONDS が採用される', () => {
    const result = createPostRequestSchema.safeParse({
      content: 'アンケート',
      poll: { options: ['A', 'B'] },
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.poll?.durationSeconds).toBe(86400)
  })

  it('VALID_POLL_DURATIONS に含まれない値は refine で拒否される', () => {
    const result = createPostRequestSchema.safeParse({
      content: 'アンケート',
      poll: { options: ['A', 'B'], durationSeconds: 12345 },
    })
    expect(result.success).toBe(false)
  })
})

describe('createPostRequestSchema / updatePostRequestSchema - bonsaiId', () => {
  it('createPostRequestSchema: bonsaiId を省略した場合は成功する（optional）', () => {
    const result = createPostRequestSchema.safeParse({ content: '盆栽の紐付けなし投稿' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.bonsaiId).toBeUndefined()
  })

  it('createPostRequestSchema: bonsaiId に文字列を指定した場合は成功する', () => {
    const result = createPostRequestSchema.safeParse({ content: '盆栽紐付け投稿', bonsaiId: 'bonsai-1' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.bonsaiId).toBe('bonsai-1')
  })

  it('createPostRequestSchema: bonsaiId に null を指定した場合は成功する', () => {
    const result = createPostRequestSchema.safeParse({ content: '投稿', bonsaiId: null })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.bonsaiId).toBeNull()
  })

  it('updatePostRequestSchema: bonsaiId を省略した場合は成功する（現状維持）', () => {
    const result = updatePostRequestSchema.safeParse({ content: '編集後' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.bonsaiId).toBeUndefined()
  })

  it('updatePostRequestSchema: bonsaiId に null を指定した場合は成功する（紐付け解除）', () => {
    const result = updatePostRequestSchema.safeParse({ content: '編集後', bonsaiId: null })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.bonsaiId).toBeNull()
  })
})

describe('listEventsQuerySchema.region / prefecture - refine', () => {
  it('region 未指定は成功する', () => {
    const result = listEventsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('region が有効な地方ブロック名（関東）なら成功する', () => {
    const result = listEventsQuerySchema.safeParse({ region: '関東' })
    expect(result.success).toBe(true)
  })

  it('region が地方ブロック名に無い値なら refine で拒否される', () => {
    const result = listEventsQuerySchema.safeParse({ region: '存在しない地方' })
    expect(result.success).toBe(false)
  })

  it('prefecture 未指定は成功する', () => {
    const result = listEventsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('prefecture が有効な都道府県名（東京都）なら成功する', () => {
    const result = listEventsQuerySchema.safeParse({ prefecture: '東京都' })
    expect(result.success).toBe(true)
  })

  it('prefecture が都道府県名に無い値なら refine で拒否される', () => {
    const result = listEventsQuerySchema.safeParse({ prefecture: '架空の県' })
    expect(result.success).toBe(false)
  })
})

describe('listShopsQuerySchema.region - refine', () => {
  it('region 未指定は成功する', () => {
    const result = listShopsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('region が有効な地方ブロック名（九州・沖縄）なら成功する', () => {
    const result = listShopsQuerySchema.safeParse({ region: '九州・沖縄' })
    expect(result.success).toBe(true)
  })

  it('region が地方ブロック名に無い値なら refine で拒否される', () => {
    const result = listShopsQuerySchema.safeParse({ region: '存在しない地方' })
    expect(result.success).toBe(false)
  })
})

describe('createShopRequestSchema.website / updateShopRequestSchema.website - http(s) refine', () => {
  it('website 未指定（create）は成功する', () => {
    const result = createShopRequestSchema.safeParse({ name: '盆栽園', address: '東京都' })
    expect(result.success).toBe(true)
  })

  it('website が空文字（create）は成功する（refine が null/空文字を許容）', () => {
    const result = createShopRequestSchema.safeParse({ name: '盆栽園', address: '東京都', website: '' })
    expect(result.success).toBe(true)
  })

  it('website が https URL（create）は成功する', () => {
    const result = createShopRequestSchema.safeParse({
      name: '盆栽園',
      address: '東京都',
      website: 'https://example.com',
    })
    expect(result.success).toBe(true)
  })

  it('website が http(s) で始まらない場合（create）は refine で拒否される', () => {
    const result = createShopRequestSchema.safeParse({
      name: '盆栽園',
      address: '東京都',
      website: 'ftp://example.com',
    })
    expect(result.success).toBe(false)
  })

  it('website 未指定（update）は成功する', () => {
    const result = updateShopRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('website が https URL（update）は成功する', () => {
    const result = updateShopRequestSchema.safeParse({ website: 'https://example.com' })
    expect(result.success).toBe(true)
  })

  it('website が http(s) で始まらない場合（update）は refine で拒否される', () => {
    const result = updateShopRequestSchema.safeParse({ website: 'javascript:alert(1)' })
    expect(result.success).toBe(false)
  })
})

describe('sendMessageRequestSchema.content - 空白/長さ refine', () => {
  it('通常の content は成功する', () => {
    const result = sendMessageRequestSchema.safeParse({ content: 'こんにちは' })
    expect(result.success).toBe(true)
  })

  it('空文字は 1 つ目の refine（trim().length > 0）で拒否される', () => {
    const result = sendMessageRequestSchema.safeParse({ content: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('メッセージを入力してください')
    }
  })

  it('空白のみは 1 つ目の refine（trim().length > 0）で拒否される', () => {
    const result = sendMessageRequestSchema.safeParse({ content: '   ' })
    expect(result.success).toBe(false)
  })

  it('MAX_MESSAGE_LENGTH を超える content は 2 つ目の refine で拒否される', () => {
    const result = sendMessageRequestSchema.safeParse({ content: 'a'.repeat(1001) })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('文字以内で入力してください')
    }
  })

  it('MAX_MESSAGE_LENGTH ちょうどの content は成功する（境界値）', () => {
    const result = sendMessageRequestSchema.safeParse({ content: 'a'.repeat(1000) })
    expect(result.success).toBe(true)
  })
})
