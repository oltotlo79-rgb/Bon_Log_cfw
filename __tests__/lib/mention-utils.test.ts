/**
 * メンションユーティリティのテスト
 */

import {
  extractMentionIds,
  parseContentSegments,
  hasMentions,
  insertMention,
  MENTION_ID_REGEX,
} from '@/lib/mention-utils'

describe('mention-utils', () => {
  // ============================================================
  // extractMentionIds
  // ============================================================

  describe('extractMentionIds', () => {
    it('単一のメンションを抽出できる', () => {
      const result = extractMentionIds('Hello <@cl123>!')
      expect(result).toEqual(['cl123'])
    })

    it('複数のメンションを抽出できる', () => {
      const result = extractMentionIds('Hello <@cl123> and <@cl456>!')
      expect(result).toEqual(['cl123', 'cl456'])
    })

    it('重複するメンションは1回だけ返す', () => {
      const result = extractMentionIds('<@cl123> and <@cl123> again')
      expect(result).toEqual(['cl123'])
    })

    it('空文字列の場合は空配列を返す', () => {
      const result = extractMentionIds('')
      expect(result).toEqual([])
    })

    it('メンションがない場合は空配列を返す', () => {
      const result = extractMentionIds('Hello world!')
      expect(result).toEqual([])
    })

    it('不正な形式のメンションは抽出しない', () => {
      // @のみ、<@のみ、>のみなど
      const result = extractMentionIds('@user1 <@incomplete')
      expect(result).toEqual([])
    })

    it('ハイフンやアンダースコアを含むIDを抽出できる', () => {
      const result = extractMentionIds('<@user-name_123>')
      expect(result).toEqual(['user-name_123'])
    })
  })

  // ============================================================
  // parseContentSegments
  // ============================================================

  describe('parseContentSegments', () => {
    it('テキストのみの場合は単一のtextセグメントを返す', () => {
      const result = parseContentSegments('Hello world!')
      expect(result).toEqual([{ type: 'text', content: 'Hello world!' }])
    })

    it('メンションをmentionセグメントとして返す', () => {
      const result = parseContentSegments('Hello <@cl123>!')
      expect(result).toEqual([
        { type: 'text', content: 'Hello ' },
        { type: 'mention', userId: 'cl123' },
        { type: 'text', content: '!' },
      ])
    })

    it('ハッシュタグをhashtagセグメントとして返す', () => {
      const result = parseContentSegments('Check out #bonsai')
      expect(result).toEqual([
        { type: 'text', content: 'Check out ' },
        { type: 'hashtag', tag: '#bonsai' },
      ])
    })

    it('メンションとハッシュタグを混在して処理できる', () => {
      const result = parseContentSegments('Hello <@cl123>! Check out #bonsai')
      expect(result).toEqual([
        { type: 'text', content: 'Hello ' },
        { type: 'mention', userId: 'cl123' },
        { type: 'text', content: '! Check out ' },
        { type: 'hashtag', tag: '#bonsai' },
      ])
    })

    it('日本語ハッシュタグを処理できる', () => {
      const result = parseContentSegments('盆栽 #盆栽 #松柏類')
      expect(result).toEqual([
        { type: 'text', content: '盆栽 ' },
        { type: 'hashtag', tag: '#盆栽' },
        { type: 'text', content: ' ' },
        { type: 'hashtag', tag: '#松柏類' },
      ])
    })

    it('空文字列の場合は空配列を返す', () => {
      const result = parseContentSegments('')
      expect(result).toEqual([])
    })

    it('連続するメンションを処理できる', () => {
      const result = parseContentSegments('<@cl123><@cl456>')
      expect(result).toEqual([
        { type: 'mention', userId: 'cl123' },
        { type: 'mention', userId: 'cl456' },
      ])
    })

    it('テキストのみ（メンションもハッシュタグもなし）の場合はtextセグメントを返す', () => {
      // この場合は218-219行目のパスを通る
      const result = parseContentSegments('普通のテキストです')
      expect(result).toEqual([{ type: 'text', content: '普通のテキストです' }])
    })

    it('メンションで始まるテキストを処理できる', () => {
      const result = parseContentSegments('<@user1> こんにちは')
      expect(result).toEqual([
        { type: 'mention', userId: 'user1' },
        { type: 'text', content: ' こんにちは' },
      ])
    })

    it('ハッシュタグで終わるテキストを処理できる', () => {
      const result = parseContentSegments('チェック #tag')
      expect(result).toEqual([
        { type: 'text', content: 'チェック ' },
        { type: 'hashtag', tag: '#tag' },
      ])
    })

    it('複数のハッシュタグを連続して処理できる', () => {
      const result = parseContentSegments('#tag1#tag2')
      expect(result).toEqual([
        { type: 'hashtag', tag: '#tag1' },
        { type: 'hashtag', tag: '#tag2' },
      ])
    })

    it('メンションとハッシュタグが交互に出現する場合を処理できる', () => {
      const result = parseContentSegments('<@user1>#tag1<@user2>#tag2')
      expect(result).toEqual([
        { type: 'mention', userId: 'user1' },
        { type: 'hashtag', tag: '#tag1' },
        { type: 'mention', userId: 'user2' },
        { type: 'hashtag', tag: '#tag2' },
      ])
    })

    it('改行を含むテキストを処理できる', () => {
      const result = parseContentSegments('Hello\n<@user1>\nWorld')
      expect(result).toEqual([
        { type: 'text', content: 'Hello\n' },
        { type: 'mention', userId: 'user1' },
        { type: 'text', content: '\nWorld' },
      ])
    })
  })

  // ============================================================
  // hasMentions
  // ============================================================

  describe('hasMentions', () => {
    it('メンションがある場合はtrueを返す', () => {
      expect(hasMentions('Hello <@cl123>!')).toBe(true)
    })

    it('メンションがない場合はfalseを返す', () => {
      expect(hasMentions('Hello world!')).toBe(false)
    })

    it('空文字列の場合はfalseを返す', () => {
      expect(hasMentions('')).toBe(false)
    })

    it('旧形式の@mentionはfalseを返す', () => {
      expect(hasMentions('@username')).toBe(false)
    })
  })

  // ============================================================
  // insertMention
  // ============================================================

  describe('insertMention', () => {
    it('テキストにメンションを挿入できる', () => {
      const result = insertMention('Hello @jo', 'cl123', 9, 6)
      expect(result.text).toBe('Hello <@cl123> ')
      // cursor = 'Hello '.length + '<@cl123> '.length = 6 + 9 = 15
      expect(result.cursor).toBe(15)
    })

    it('テキストの途中にメンションを挿入できる', () => {
      const result = insertMention('Hello @jo world', 'cl123', 9, 6)
      expect(result.text).toBe('Hello <@cl123>  world')
    })

    it('テキストの先頭にメンションを挿入できる', () => {
      const result = insertMention('@user', 'cl123', 5, 0)
      expect(result.text).toBe('<@cl123> ')
    })
  })

  // ============================================================
  // MENTION_ID_REGEX
  // ============================================================

  describe('MENTION_ID_REGEX', () => {
    it('正しいメンション形式にマッチする', () => {
      MENTION_ID_REGEX.lastIndex = 0
      expect('<@cl123>').toMatch(MENTION_ID_REGEX)
    })

    it('不正な形式にはマッチしない', () => {
      MENTION_ID_REGEX.lastIndex = 0
      expect('@user').not.toMatch(MENTION_ID_REGEX)
      MENTION_ID_REGEX.lastIndex = 0
      expect('<@>').not.toMatch(MENTION_ID_REGEX)
      MENTION_ID_REGEX.lastIndex = 0
      expect('<user>').not.toMatch(MENTION_ID_REGEX)
    })
  })
})
