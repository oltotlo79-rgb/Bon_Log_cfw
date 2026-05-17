/**
 * メンションユーティリティ
 *
 * @module lib/mention-utils
 */

/**
 * コンテンツセグメントの型
 *
 * テキストを解析して得られるセグメントの型。
 * テキスト、メンション、ハッシュタグの3種類がある。
 */
export type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'mention'; userId: string }
  | { type: 'hashtag'; tag: string }

/**
 * メンションユーザー情報の型
 *
 * メンションを表示する際に必要なユーザー情報。
 */
export type MentionUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

/**
 * メンションID形式を抽出する正規表現
 *
 * ## マッチするパターン
 * - <@userId>
 * - <@cl123abc>
 * - <@user_name-123>
 *
 * ## キャプチャグループ
 * グループ1: ユーザーID部分（<@と>を除く）
 */
export const MENTION_ID_REGEX = /<@([a-zA-Z0-9_-]+)>/g

/**
 * ハッシュタグを抽出する正規表現
 *
 * ## マッチするパターン
 * - #hashtag
 * - #盆栽
 * - #bonsai2024
 *
 * ## 対応文字
 * - 英数字（a-z, A-Z, 0-9）
 * - アンダースコア（_）
 * - ひらがな（\u3040-\u309F）
 * - カタカナ（\u30A0-\u30FF）
 * - 漢字（\u4E00-\u9FAF）
 */
export const HASHTAG_REGEX = /#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g

/**
 * テキストからメンションされたユーザーIDを抽出
 *
 * ## 処理内容
 * 1. 正規表現で <@userId> 形式をマッチ
 * 2. ユーザーID部分を抽出
 * 3. 重複を除去して返却
 *
 * @param text - 抽出元のテキスト
 * @returns ユーザーIDの配列（重複なし）
 *
 * @example
 * ```typescript
 * extractMentionIds('Hello <@cl123>! Check out <@cl456> and <@cl123>')
 * // → ['cl123', 'cl456']
 * ```
 */
export function extractMentionIds(text: string): string[] {
  if (!text) return []

  const ids: string[] = []
  let match

  // 正規表現のlastIndexをリセット
  MENTION_ID_REGEX.lastIndex = 0

  while ((match = MENTION_ID_REGEX.exec(text)) !== null) {
    if (match[1]) ids.push(match[1])
  }

  // 重複を除去して返却
  return [...new Set(ids)]
}

/**
 * テキストをセグメント（テキスト/メンション/ハッシュタグ）に分割
 *
 * ## 処理内容
 * 1. メンションとハッシュタグの位置を特定
 * 2. テキストを各セグメントに分割
 * 3. 種類ごとに適切なセグメントオブジェクトを生成
 *
 * ## セグメントの種類
 * - text: 通常のテキスト
 * - mention: メンション（<@userId>形式）
 * - hashtag: ハッシュタグ（#tag形式）
 *
 * @param text - 分割元のテキスト
 * @returns セグメントの配列
 *
 * @example
 * ```typescript
 * parseContentSegments('Hello <@cl123>! Check out #bonsai')
 * // → [
 * //     { type: 'text', content: 'Hello ' },
 * //     { type: 'mention', userId: 'cl123' },
 * //     { type: 'text', content: '! Check out ' },
 * //     { type: 'hashtag', tag: '#bonsai' }
 * //   ]
 * ```
 */
export function parseContentSegments(text: string): ContentSegment[] {
  if (!text) return []

  const segments: ContentSegment[] = []

  // マッチ情報を格納する型
  type MatchInfo = {
    type: 'mention' | 'hashtag'
    start: number
    end: number
    value: string
    userId?: string
  }

  // すべてのマッチを収集
  const matches: MatchInfo[] = []

  // メンションをマッチ
  MENTION_ID_REGEX.lastIndex = 0
  let match
  while ((match = MENTION_ID_REGEX.exec(text)) !== null) {
    matches.push({
      type: 'mention',
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
      userId: match[1],
    })
  }

  // ハッシュタグをマッチ
  HASHTAG_REGEX.lastIndex = 0
  while ((match = HASHTAG_REGEX.exec(text)) !== null) {
    matches.push({
      type: 'hashtag',
      start: match.index,
      end: match.index + match[0].length,
      value: match[0],
    })
  }

  // 位置でソート
  matches.sort((a, b) => a.start - b.start)

  // セグメントを構築
  let lastIndex = 0

  for (const m of matches) {
    // マッチ前のテキストがあれば追加
    if (m.start > lastIndex) {
      const textContent = text.slice(lastIndex, m.start)
      if (textContent) {
        segments.push({ type: 'text', content: textContent })
      }
    }

    // マッチしたセグメントを追加
    if (m.type === 'mention' && m.userId) {
      segments.push({ type: 'mention', userId: m.userId })
    } else if (m.type === 'hashtag') {
      segments.push({ type: 'hashtag', tag: m.value })
    }

    lastIndex = m.end
  }

  // 残りのテキストがあれば追加
  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex)
    if (textContent) {
      segments.push({ type: 'text', content: textContent })
    }
  }

  // マッチがない場合はテキスト全体を返す
  if (segments.length === 0 && text) {
    segments.push({ type: 'text', content: text })
  }

  return segments
}

/**
 * メンションを含むテキストかどうかを判定
 *
 * @param text - 判定対象のテキスト
 * @returns メンションを含む場合はtrue
 *
 * @example
 * ```typescript
 * hasMentions('Hello <@cl123>!')
 * // → true
 *
 * hasMentions('Hello world!')
 * // → false
 * ```
 */
export function hasMentions(text: string): boolean {
  if (!text) return false
  MENTION_ID_REGEX.lastIndex = 0
  return MENTION_ID_REGEX.test(text)
}

/**
 * メンションIDをテキストに挿入するヘルパー
 *
 * オートコンプリートでユーザーを選択した際に、
 * 入力中のテキストにメンションを挿入するために使用。
 *
 * @param text - 現在のテキスト
 * @param userId - 挿入するユーザーID
 * @param cursorPosition - カーソル位置
 * @param triggerStart - @の開始位置
 * @returns 新しいテキストと新しいカーソル位置
 *
 * @example
 * ```typescript
 * insertMention('Hello @jo', 'cl123', 9, 6)
 * // → { text: 'Hello <@cl123> ', cursor: 16 }
 * ```
 */
export function insertMention(
  text: string,
  userId: string,
  cursorPosition: number,
  triggerStart: number
): { text: string; cursor: number } {
  const before = text.slice(0, triggerStart)
  const after = text.slice(cursorPosition)
  const mentionTag = `<@${userId}> `
  const newText = before + mentionTag + after
  const newCursor = before.length + mentionTag.length

  return { text: newText, cursor: newCursor }
}
