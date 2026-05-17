import { describe, it, expect } from 'vitest'
import { RESERVED_NICKNAMES, isReservedNickname } from '@/lib/constants/reserved'

describe('reserved nicknames', () => {
  describe('RESERVED_NICKNAMES', () => {
    it('E2E用の予約ニックネームが含まれる', () => {
      expect(RESERVED_NICKNAMES).toContain('E2Eテストユーザー')
      expect(RESERVED_NICKNAMES).toContain('E2E他ユーザー')
      expect(RESERVED_NICKNAMES).toContain('E2E登録テスト')
      expect(RESERVED_NICKNAMES).toContain('E2E Test User')
    })
  })

  describe('isReservedNickname', () => {
    it('予約ニックネームの場合は true', () => {
      expect(isReservedNickname('E2Eテストユーザー')).toBe(true)
      expect(isReservedNickname('E2E他ユーザー')).toBe(true)
      expect(isReservedNickname('E2E登録テスト')).toBe(true)
      expect(isReservedNickname('E2E Test User')).toBe(true)
    })

    it('前後空白は無視して予約と判定する', () => {
      expect(isReservedNickname('  E2Eテストユーザー  ')).toBe(true)
      expect(isReservedNickname('E2E Test User ')).toBe(true)
    })

    it('大文字小文字の違いは無視する（英字部分）', () => {
      expect(isReservedNickname('e2e test user')).toBe(true)
      expect(isReservedNickname('E2E TEST USER')).toBe(true)
    })

    it('予約でないニックネームは false', () => {
      expect(isReservedNickname('一般ユーザー')).toBe(false)
      expect(isReservedNickname('盆栽太郎')).toBe(false)
      expect(isReservedNickname('')).toBe(false)
    })

    it('空文字や不正な入力は false', () => {
      expect(isReservedNickname('')).toBe(false)
      expect(isReservedNickname('   ')).toBe(false)
    })
  })
})
