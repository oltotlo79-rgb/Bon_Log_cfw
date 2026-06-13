// @vitest-environment node
/**
 * lib/api/v1/mention-resolver のユニットテスト
 *
 * attachMentionedUsers / attachMentionedUsersToOne の正常系・空配列・
 * 不明 userId 省略・N+1 防止（findMany 1 回のみ）を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockResolveMentionUsers = vi.fn()
vi.mock('@/lib/services/mention', () => ({
  resolveMentionUsers: (...args: unknown[]) => mockResolveMentionUsers(...args),
  notifyMentionedUsers: vi.fn(),
}))

describe('lib/api/v1/mention-resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('attachMentionedUsers', () => {
    it('空配列を渡すと空配列を返し resolveMentionUsers を呼ばない', async () => {
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const result = await attachMentionedUsers([])

      expect(result).toEqual([])
      expect(mockResolveMentionUsers).not.toHaveBeenCalled()
    })

    it('メンションなしのコンテンツでは mentionedUsers が空配列', async () => {
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const items = [{ content: 'メンションなし' }, { content: '普通のテキスト' }]
      const result = await attachMentionedUsers(items)

      expect(result).toHaveLength(2)
      expect(result[0]?.mentionedUsers).toEqual([])
      expect(result[1]?.mentionedUsers).toEqual([])
    })

    it('content が null のアイテムでも mentionedUsers は空配列', async () => {
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const items = [{ content: null }]
      const result = await attachMentionedUsers(items)

      expect(result[0]?.mentionedUsers).toEqual([])
    })

    it('メンションありのコンテンツで mentionedUsers にユーザー情報が付与される', async () => {
      const userMap = new Map([
        ['user-1', { id: 'user-1', nickname: '盆栽太郎', avatarUrl: null }],
      ])
      mockResolveMentionUsers.mockResolvedValue(userMap)
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const items = [{ content: 'こんにちは <@user-1>' }]
      const result = await attachMentionedUsers(items)

      expect(result[0]?.mentionedUsers).toHaveLength(1)
      expect(result[0]?.mentionedUsers[0]).toMatchObject({
        id: 'user-1',
        nickname: '盆栽太郎',
      })
    })

    it('解決できない userId（削除済みユーザー等）は mentionedUsers から省かれる', async () => {
      const userMap = new Map([
        ['user-1', { id: 'user-1', nickname: '盆栽太郎', avatarUrl: null }],
        // user-deleted は Map にない
      ])
      mockResolveMentionUsers.mockResolvedValue(userMap)
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const items = [{ content: '<@user-1> と <@user-deleted>' }]
      const result = await attachMentionedUsers(items)

      expect(result[0]?.mentionedUsers).toHaveLength(1)
      expect(result[0]?.mentionedUsers[0]?.id).toBe('user-1')
    })

    it('N+1 防止: 複数アイテムでも resolveMentionUsers が 1 回だけ呼ばれる', async () => {
      const userMap = new Map([
        ['user-1', { id: 'user-1', nickname: '太郎', avatarUrl: null }],
        ['user-2', { id: 'user-2', nickname: '花子', avatarUrl: null }],
      ])
      mockResolveMentionUsers.mockResolvedValue(userMap)
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const items = [
        { content: '<@user-1> おはよう' },
        { content: '<@user-2> こんにちは' },
        { content: '<@user-1> また後で' },
      ]
      await attachMentionedUsers(items)

      expect(mockResolveMentionUsers).toHaveBeenCalledTimes(1)
    })

    it('N+1 防止: 全アイテムのメンション ID を集約して 1 回の findMany で解決する', async () => {
      mockResolveMentionUsers.mockResolvedValue(new Map())
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const items = [
        { content: '<@user-1>' },
        { content: '<@user-2>' },
        { content: '<@user-3>' },
      ]
      await attachMentionedUsers(items)

      const calledIds = mockResolveMentionUsers.mock.calls[0]?.[0] as string[]
      expect(calledIds).toHaveLength(3)
      expect(calledIds).toContain('user-1')
      expect(calledIds).toContain('user-2')
      expect(calledIds).toContain('user-3')
    })

    it('複数アイテムに同一 userId が登場しても ID が重複なく渡される', async () => {
      mockResolveMentionUsers.mockResolvedValue(new Map())
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const items = [
        { content: '<@user-1>' },
        { content: '<@user-1> 再登場' },
      ]
      await attachMentionedUsers(items)

      const calledIds = mockResolveMentionUsers.mock.calls[0]?.[0] as string[]
      expect(calledIds.filter((id) => id === 'user-1')).toHaveLength(1)
    })

    it('全アイテムにメンションがない場合は resolveMentionUsers を呼ばない', async () => {
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const items = [{ content: 'メンションなし' }, { content: null }]
      await attachMentionedUsers(items)

      expect(mockResolveMentionUsers).not.toHaveBeenCalled()
    })

    it('元のアイテムのプロパティが保持される', async () => {
      mockResolveMentionUsers.mockResolvedValue(new Map())
      const { attachMentionedUsers } = await import('@/lib/api/v1/mention-resolver')
      const items = [{ content: 'テスト', id: 'post-1', likeCount: 5 }]
      const result = await attachMentionedUsers(items)

      expect(result[0]?.id).toBe('post-1')
      expect(result[0]?.likeCount).toBe(5)
      expect(result[0]?.content).toBe('テスト')
    })
  })

  describe('attachMentionedUsersToOne', () => {
    it('単一アイテムに mentionedUsers が付与される', async () => {
      const userMap = new Map([
        ['user-x', { id: 'user-x', nickname: '盆栽次郎', avatarUrl: '/av.jpg' }],
      ])
      mockResolveMentionUsers.mockResolvedValue(userMap)
      const { attachMentionedUsersToOne } = await import('@/lib/api/v1/mention-resolver')
      const result = await attachMentionedUsersToOne({ content: '<@user-x>' })

      expect(result.mentionedUsers).toHaveLength(1)
      expect(result.mentionedUsers[0]).toMatchObject({ id: 'user-x', nickname: '盆栽次郎' })
    })

    it('メンションなしの場合 mentionedUsers が空配列', async () => {
      mockResolveMentionUsers.mockResolvedValue(new Map())
      const { attachMentionedUsersToOne } = await import('@/lib/api/v1/mention-resolver')
      const result = await attachMentionedUsersToOne({ content: 'メンションなし' })

      expect(result.mentionedUsers).toEqual([])
    })

    it('content が null でも mentionedUsers は空配列', async () => {
      const { attachMentionedUsersToOne } = await import('@/lib/api/v1/mention-resolver')
      const result = await attachMentionedUsersToOne({ content: null })

      expect(result.mentionedUsers).toEqual([])
      expect(mockResolveMentionUsers).not.toHaveBeenCalled()
    })

    it('元アイテムのプロパティが保持される', async () => {
      mockResolveMentionUsers.mockResolvedValue(new Map())
      const { attachMentionedUsersToOne } = await import('@/lib/api/v1/mention-resolver')
      const result = await attachMentionedUsersToOne({ content: 'テスト', id: 'post-999' })

      expect(result.id).toBe('post-999')
      expect(result.content).toBe('テスト')
    })
  })
})
