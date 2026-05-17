import { describe, it, expect } from 'vitest'
import { parseContentSegments, extractMentionIds } from '@/lib/mention-utils'

/**
 * mention-utils - ブランチカバレッジ向上テスト
 * parseContentSegments の未カバーブランチ:
 * - textContentが空文字の場合のスキップ
 * - ハッシュタグのみの入力
 * - マッチが連続している場合（間にテキストなし）
 * - segments.length === 0 && text のフォールバック
 */

describe('parseContentSegments - ブランチカバレッジ向上', () => {
  it('メンションが先頭にある場合（前方テキストなし）', () => {
    const segments = parseContentSegments('<@user1>テスト')
    expect(segments).toEqual([
      { type: 'mention', userId: 'user1' },
      { type: 'text', content: 'テスト' },
    ])
  })

  it('ハッシュタグのみの入力', () => {
    const segments = parseContentSegments('#盆栽')
    expect(segments).toEqual([
      { type: 'hashtag', tag: '#盆栽' },
    ])
  })

  it('複数のハッシュタグが連続する場合', () => {
    const segments = parseContentSegments('#盆栽 #松柏')
    expect(segments).toEqual([
      { type: 'hashtag', tag: '#盆栽' },
      { type: 'text', content: ' ' },
      { type: 'hashtag', tag: '#松柏' },
    ])
  })

  it('メンションとハッシュタグが連続する場合（間にテキストなし）', () => {
    const segments = parseContentSegments('<@user1>#盆栽')
    expect(segments).toEqual([
      { type: 'mention', userId: 'user1' },
      { type: 'hashtag', tag: '#盆栽' },
    ])
  })

  it('メンションのみの入力', () => {
    const segments = parseContentSegments('<@user1>')
    expect(segments).toEqual([
      { type: 'mention', userId: 'user1' },
    ])
  })

  it('空文字列の場合は空配列を返す', () => {
    const segments = parseContentSegments('')
    expect(segments).toEqual([])
  })

  it('メンションもハッシュタグもない通常テキスト', () => {
    const segments = parseContentSegments('普通のテキスト')
    expect(segments).toEqual([
      { type: 'text', content: '普通のテキスト' },
    ])
  })

  it('特殊文字のみ（マッチなしフォールバック）', () => {
    const segments = parseContentSegments('!@$%^&*()')
    expect(segments).toEqual([
      { type: 'text', content: '!@$%^&*()' },
    ])
  })

  it('複数メンションが連続する場合', () => {
    const segments = parseContentSegments('<@user1><@user2>')
    expect(segments).toEqual([
      { type: 'mention', userId: 'user1' },
      { type: 'mention', userId: 'user2' },
    ])
  })

  it('テキスト→メンション→ハッシュタグ→テキスト の完全パターン', () => {
    const segments = parseContentSegments('こんにちは<@user1>さん #盆栽 いいですね')
    expect(segments).toEqual([
      { type: 'text', content: 'こんにちは' },
      { type: 'mention', userId: 'user1' },
      { type: 'text', content: 'さん ' },
      { type: 'hashtag', tag: '#盆栽' },
      { type: 'text', content: ' いいですね' },
    ])
  })

  it('末尾にメンションがある場合（残りテキストなし）', () => {
    const segments = parseContentSegments('テスト<@user1>')
    expect(segments).toEqual([
      { type: 'text', content: 'テスト' },
      { type: 'mention', userId: 'user1' },
    ])
  })

  it('末尾にハッシュタグがある場合', () => {
    const segments = parseContentSegments('テスト#タグ')
    expect(segments).toEqual([
      { type: 'text', content: 'テスト' },
      { type: 'hashtag', tag: '#タグ' },
    ])
  })
})

describe('extractMentionIds - ブランチカバレッジ向上', () => {
  it('メンションが含まれないテキストでは空配列を返す', () => {
    expect(extractMentionIds('普通のテキスト')).toEqual([])
  })

  it('重複するメンションは1つに集約される', () => {
    expect(extractMentionIds('<@user1> <@user1> <@user1>')).toEqual(['user1'])
  })

  it('ハイフンとアンダースコアを含むユーザーIDを抽出する', () => {
    expect(extractMentionIds('<@user-name_123>')).toEqual(['user-name_123'])
  })
})
