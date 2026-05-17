// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { POST_LIST_INCLUDE, formatPostForClient } from '@/lib/actions/post-include'

describe('post-include', () => {
  describe('POST_LIST_INCLUDE', () => {
    it('user に必要なフィールドのみ select する', () => {
      expect(POST_LIST_INCLUDE.user.select).toEqual({
        id: true,
        nickname: true,
        avatarUrl: true,
      })
    })

    it('media を sortOrder 昇順で取得する', () => {
      expect(POST_LIST_INCLUDE.media.orderBy).toEqual({ sortOrder: 'asc' })
    })

    it('genres のネストした select を含む', () => {
      expect(POST_LIST_INCLUDE.genres.select.genre.select).toEqual({
        id: true,
        name: true,
        category: true,
      })
    })

    it('_count で likes と deletedAt=null の comments をカウントする', () => {
      expect(POST_LIST_INCLUDE._count.select.likes).toBe(true)
      expect(POST_LIST_INCLUDE._count.select.comments).toEqual({ where: { deletedAt: null } })
    })
  })

  describe('formatPostForClient', () => {
    const basePost = {
      id: 'post-1',
      content: 'テスト投稿',
      userId: 'user-1',
      createdAt: new Date('2026-01-01'),
      _count: { likes: 5, comments: 3 },
      genres: [
        { genre: { id: 'g1', name: '松柏類', category: '盆栽' } },
        { genre: { id: 'g2', name: '雑木類', category: '盆栽' } },
      ],
    }

    it('_count を likeCount / commentCount にフラット化する', () => {
      const result = formatPostForClient(basePost, new Set(), new Set())
      expect(result.likeCount).toBe(5)
      expect(result.commentCount).toBe(3)
    })

    it('genres のネストを解除する', () => {
      const result = formatPostForClient(basePost, new Set(), new Set())
      expect(result.genres).toEqual([
        { id: 'g1', name: '松柏類', category: '盆栽' },
        { id: 'g2', name: '雑木類', category: '盆栽' },
      ])
    })

    it('いいね済みの場合 isLiked=true を返す', () => {
      const likedSet = new Set(['post-1'])
      const result = formatPostForClient(basePost, likedSet, new Set())
      expect(result.isLiked).toBe(true)
    })

    it('いいね未済の場合 isLiked=false を返す', () => {
      const result = formatPostForClient(basePost, new Set(), new Set())
      expect(result.isLiked).toBe(false)
    })

    it('ブックマーク済みの場合 isBookmarked=true を返す', () => {
      const bookmarkedSet = new Set(['post-1'])
      const result = formatPostForClient(basePost, new Set(), bookmarkedSet)
      expect(result.isBookmarked).toBe(true)
    })

    it('ブックマーク未済の場合 isBookmarked=false を返す', () => {
      const result = formatPostForClient(basePost, new Set(), new Set())
      expect(result.isBookmarked).toBe(false)
    })

    it('元の投稿プロパティを保持する', () => {
      const result = formatPostForClient(basePost, new Set(), new Set())
      expect(result.id).toBe('post-1')
      expect(result.content).toBe('テスト投稿')
      expect(result.userId).toBe('user-1')
    })

    it('genres が空配列の場合は空配列を返す', () => {
      const post = { ...basePost, genres: [] }
      const result = formatPostForClient(post, new Set(), new Set())
      expect(result.genres).toEqual([])
    })

    it('_count がゼロの場合も正しく処理する', () => {
      const post = { ...basePost, _count: { likes: 0, comments: 0 } }
      const result = formatPostForClient(post, new Set(), new Set())
      expect(result.likeCount).toBe(0)
      expect(result.commentCount).toBe(0)
    })
  })
})
