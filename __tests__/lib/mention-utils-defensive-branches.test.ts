/**
 * mention-utils.ts の防御的分岐（capture group 欠落ガード）のテスト
 *
 * MENTION_ID_REGEX は `[a-zA-Z0-9_-]+` (1文字以上) を必須にしているため、
 * 通常の入力では match[1] が falsy になることはない。
 * しかし実装はその前提が崩れても壊れないよう `if (match[1])` で防御している。
 * この防御コードが実際に安全側へ倒れることを検証するため、
 * RegExp.prototype.exec を一時的に差し替えて capture group 欠落を再現する。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { extractMentionIds, MENTION_ID_REGEX } from '@/lib/mention-utils'

describe('extractMentionIds - capture group 欠落時の防御分岐', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    MENTION_ID_REGEX.lastIndex = 0
  })

  it('マッチ結果の capture group が欠落している場合、そのマッチはIDとして追加されない', () => {
    let callCount = 0
    vi.spyOn(MENTION_ID_REGEX, 'exec').mockImplementation(() => {
      callCount += 1
      if (callCount === 1) {
        const fakeMatch = ['<@>'] as unknown as RegExpExecArray
        fakeMatch.index = 0
        fakeMatch.input = 'irrelevant'
        // capture group が undefined という壊れた状態を模倣
        ;(fakeMatch as unknown as (string | undefined)[])[1] = undefined
        return fakeMatch
      }
      return null
    })

    const result = extractMentionIds('irrelevant')

    expect(result).toEqual([])
  })
})
