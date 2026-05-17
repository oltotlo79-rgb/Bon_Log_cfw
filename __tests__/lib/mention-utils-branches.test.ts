/**
 * mention-utils.ts の未カバーブランチを補完するテスト
 *
 * 対象:
 * - extractMentionIds: 空文字、重複ID、複数メンション
 * - parseContentSegments: 空文字、メンションのみ、ハッシュタグのみ、混在、残りテキスト
 * - hasMentions: 空文字、メンション含む/含まない
 * - insertMention: 先頭/中間/末尾への挿入
 */

import { describe, it, expect } from 'vitest'
import {
  extractMentionIds,
  parseContentSegments,
  hasMentions,
  insertMention,
  MENTION_ID_REGEX,
  HASHTAG_REGEX,
} from '@/lib/mention-utils'

describe('extractMentionIds', () => {
  it('空文字列で空配列を返す', () => {
    expect(extractMentionIds('')).toEqual([])
  })

  it('メンションがないテキストで空配列を返す', () => {
    expect(extractMentionIds('Hello world!')).toEqual([])
  })

  it('単一メンションを抽出する', () => {
    expect(extractMentionIds('Hello <@user1>!')).toEqual(['user1'])
  })

  it('複数メンションを抽出する', () => {
    expect(extractMentionIds('<@user1> and <@user2>')).toEqual(['user1', 'user2'])
  })

  it('重複メンションを除去する', () => {
    expect(extractMentionIds('<@user1> likes <@user1>')).toEqual(['user1'])
  })

  it('ハイフン・アンダースコアを含むIDを抽出する', () => {
    expect(extractMentionIds('<@user-name_123>')).toEqual(['user-name_123'])
  })
})

describe('parseContentSegments', () => {
  it('空文字列で空配列を返す', () => {
    expect(parseContentSegments('')).toEqual([])
  })

  it('通常テキストのみで1セグメントを返す', () => {
    const result = parseContentSegments('Hello world')
    expect(result).toEqual([{ type: 'text', content: 'Hello world' }])
  })

  it('メンションのみで1セグメントを返す', () => {
    const result = parseContentSegments('<@user1>')
    expect(result).toEqual([{ type: 'mention', userId: 'user1' }])
  })

  it('ハッシュタグのみで1セグメントを返す', () => {
    const result = parseContentSegments('#盆栽')
    expect(result).toEqual([{ type: 'hashtag', tag: '#盆栽' }])
  })

  it('テキスト + メンション + テキストの3セグメント', () => {
    const result = parseContentSegments('Hi <@user1> there')
    expect(result).toEqual([
      { type: 'text', content: 'Hi ' },
      { type: 'mention', userId: 'user1' },
      { type: 'text', content: ' there' },
    ])
  })

  it('テキスト + ハッシュタグの2セグメント', () => {
    const result = parseContentSegments('Check #bonsai')
    expect(result).toEqual([
      { type: 'text', content: 'Check ' },
      { type: 'hashtag', tag: '#bonsai' },
    ])
  })

  it('メンションとハッシュタグの混在', () => {
    const result = parseContentSegments('<@user1> posted #bonsai')
    expect(result).toEqual([
      { type: 'mention', userId: 'user1' },
      { type: 'text', content: ' posted ' },
      { type: 'hashtag', tag: '#bonsai' },
    ])
  })

  it('先頭がメンションで後ろにテキスト', () => {
    const result = parseContentSegments('<@user1>さんこんにちは')
    expect(result).toEqual([
      { type: 'mention', userId: 'user1' },
      { type: 'text', content: 'さんこんにちは' },
    ])
  })

  it('連続メンション', () => {
    const result = parseContentSegments('<@user1><@user2>')
    expect(result).toEqual([
      { type: 'mention', userId: 'user1' },
      { type: 'mention', userId: 'user2' },
    ])
  })

  it('日本語ハッシュタグ（ひらがな・カタカナ・漢字）', () => {
    const result = parseContentSegments('#松柏類 #カエデ #はなみずき')
    expect(result.filter(s => s.type === 'hashtag')).toHaveLength(3)
  })
})

describe('hasMentions', () => {
  it('空文字列でfalseを返す', () => {
    expect(hasMentions('')).toBe(false)
  })

  it('メンションなしでfalseを返す', () => {
    expect(hasMentions('Hello world')).toBe(false)
  })

  it('メンションありでtrueを返す', () => {
    expect(hasMentions('Hello <@user1>')).toBe(true)
  })

  it('不完全なメンション形式はfalse', () => {
    expect(hasMentions('Hello @user1')).toBe(false)
  })
})

describe('insertMention', () => {
  it('テキスト末尾にメンションを挿入する', () => {
    const result = insertMention('Hello @jo', 'user1', 9, 6)
    expect(result.text).toBe('Hello <@user1> ')
    expect(result.cursor).toBe(15)
  })

  it('テキスト先頭にメンションを挿入する', () => {
    const result = insertMention('@jo', 'user1', 3, 0)
    expect(result.text).toBe('<@user1> ')
    expect(result.cursor).toBe(9)
  })

  it('テキスト中間にメンションを挿入する', () => {
    const result = insertMention('Hi @jo there', 'user1', 6, 3)
    expect(result.text).toBe('Hi <@user1>  there')
    expect(result.cursor).toBe(12)
  })
})

describe('正規表現パターン', () => {
  it('MENTION_ID_REGEXがグローバルフラグを持つ', () => {
    expect(MENTION_ID_REGEX.flags).toContain('g')
  })

  it('HASHTAG_REGEXがグローバルフラグを持つ', () => {
    expect(HASHTAG_REGEX.flags).toContain('g')
  })
})
