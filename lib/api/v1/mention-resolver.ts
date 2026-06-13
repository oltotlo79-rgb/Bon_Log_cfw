/**
 * @module lib/api/v1/mention-resolver
 * v1 API レスポンス用メンション一括解決ユーティリティ。
 *
 * 複数の投稿/コメントから `<@userId>` トークンを収集し、1 回の findMany で
 * 表示用 nickname / avatarUrl を解決して各アイテムに付加する。
 * formatPostForClient 自体は変更せず、v1 サービス層でのみ使用する
 * （Web レスポンスへの影響をゼロにするため）。
 */

import 'server-only'

import { resolveMentionUsers } from '@/lib/services/mention'
import { extractMentionIds } from '@/lib/mention-utils'

export type MentionedUserItem = {
  id: string
  nickname: string
  avatarUrl: string | null
}

type HasContent = { content: string | null }

/**
 * コンテンツ配列から全メンション userId を一括抽出し、1 クエリで解決する。
 * 解決できない userId（削除済みユーザー等）は結果から省略される。
 */
async function resolveAllMentionIds(
  contents: (string | null)[],
): Promise<Map<string, MentionedUserItem>> {
  const allIds = new Set<string>()
  for (const content of contents) {
    if (!content) continue
    for (const id of extractMentionIds(content)) {
      allIds.add(id)
    }
  }
  if (allIds.size === 0) return new Map()
  return resolveMentionUsers([...allIds])
}

/**
 * 投稿/コメント一覧に mentionedUsers を付加する。
 * N+1 を防ぐため、全アイテムの content を集約してから 1 回だけ DB を叩く。
 */
export async function attachMentionedUsers<T extends HasContent>(
  items: T[],
): Promise<(T & { mentionedUsers: MentionedUserItem[] })[]> {
  if (items.length === 0) return []

  const contents = items.map((item) => item.content)
  const userMap = await resolveAllMentionIds(contents)

  return items.map((item) => {
    const mentionIds = item.content ? extractMentionIds(item.content) : []
    const mentionedUsers = mentionIds
      .map((id) => userMap.get(id))
      .filter((u): u is MentionedUserItem => u !== undefined)
    return { ...item, mentionedUsers }
  })
}

/**
 * 単一の投稿/コメントに mentionedUsers を付加する（詳細取得用）。
 */
export async function attachMentionedUsersToOne<T extends HasContent>(
  item: T,
): Promise<T & { mentionedUsers: MentionedUserItem[] }> {
  const results = await attachMentionedUsers([item])
  const result = results[0]
  if (!result) return { ...item, mentionedUsers: [] }
  return result
}
