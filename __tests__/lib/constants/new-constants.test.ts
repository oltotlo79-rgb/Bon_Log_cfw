// @vitest-environment node

/**
 * 新規追加定数のテスト
 *
 * 今回のレビュー対応で追加された定数の存在・型・値を検証
 */

import { describe, it, expect } from 'vitest'

describe('新規追加定数', () => {
  describe('pagination.ts 定数', () => {
    it('REVALIDATE_MASTER_DATA が定義されている', async () => {
      const { REVALIDATE_MASTER_DATA } = await import('@/lib/constants/limits')
      expect(REVALIDATE_MASTER_DATA).toBe(3600)
      expect(typeof REVALIDATE_MASTER_DATA).toBe('number')
    })

    it('REVALIDATE_LIST_PAGE が定義されている', async () => {
      const { REVALIDATE_LIST_PAGE } = await import('@/lib/constants/limits')
      expect(REVALIDATE_LIST_PAGE).toBe(300)
      expect(typeof REVALIDATE_LIST_PAGE).toBe('number')
    })

    it('ADMIN_ID_DISPLAY_LONG_LENGTH が定義されている', async () => {
      const { ADMIN_ID_DISPLAY_LONG_LENGTH } = await import('@/lib/constants/limits')
      expect(ADMIN_ID_DISPLAY_LONG_LENGTH).toBe(12)
      expect(typeof ADMIN_ID_DISPLAY_LONG_LENGTH).toBe('number')
    })

    it('COLUMN_OG_DESCRIPTION_LENGTH が定義されている', async () => {
      const { COLUMN_OG_DESCRIPTION_LENGTH } = await import('@/lib/constants/limits')
      expect(COLUMN_OG_DESCRIPTION_LENGTH).toBe(200)
      expect(typeof COLUMN_OG_DESCRIPTION_LENGTH).toBe('number')
    })

    it('ADMIN_ID_DISPLAY_LONG_LENGTH > ADMIN_ID_DISPLAY_LENGTH', async () => {
      const { ADMIN_ID_DISPLAY_LONG_LENGTH, ADMIN_ID_DISPLAY_LENGTH } = await import('@/lib/constants/limits')
      expect(ADMIN_ID_DISPLAY_LONG_LENGTH).toBeGreaterThan(ADMIN_ID_DISPLAY_LENGTH)
    })
  })

  describe('external.ts 定数', () => {
    it('GSI_ADDRESS_SEARCH_URL が有効な URL', async () => {
      const { GSI_ADDRESS_SEARCH_URL } = await import('@/lib/constants/limits')
      expect(GSI_ADDRESS_SEARCH_URL).toBe('https://msearch.gsi.go.jp/address-search/AddressSearch')
      expect(GSI_ADDRESS_SEARCH_URL).toMatch(/^https:\/\//)
    })
  })

  describe('errors/admin.ts 定数', () => {
    it('ERR_NG_WORD_REGEX_UNSAFE が定義されている', async () => {
      const { ERR_NG_WORD_REGEX_UNSAFE } = await import('@/lib/constants/errors')
      expect(typeof ERR_NG_WORD_REGEX_UNSAFE).toBe('string')
      expect(ERR_NG_WORD_REGEX_UNSAFE.length).toBeGreaterThan(0)
      expect(ERR_NG_WORD_REGEX_UNSAFE).toContain('ReDoS')
    })
  })

  describe('ui.ts 定数', () => {
    it('TIMEOUT_TOAST が定義されている', async () => {
      const { TIMEOUT_TOAST } = await import('@/lib/constants/limits')
      expect(TIMEOUT_TOAST).toBe(3000)
    })
  })

  describe('cache.ts 定数', () => {
    it('MAINTENANCE_CACHE_TTL_MS は 30 秒（30_000ms）', async () => {
      const { MAINTENANCE_CACHE_TTL_MS } = await import('@/lib/constants/limits')
      expect(MAINTENANCE_CACHE_TTL_MS).toBe(30_000)
      expect(typeof MAINTENANCE_CACHE_TTL_MS).toBe('number')
    })

    it('MAINTENANCE_CACHE_TTL_MS は秒ベースの TTL より厳密に大きい（ミリ秒単位の証跡）', async () => {
      const { MAINTENANCE_CACHE_TTL_MS, REDIS_RELATIONS_TTL_SECONDS } = await import(
        '@/lib/constants/limits'
      )
      // セカンドベースの TTL と取り違えていないことを保証
      expect(MAINTENANCE_CACHE_TTL_MS).toBeGreaterThan(REDIS_RELATIONS_TTL_SECONDS)
    })
  })
})
