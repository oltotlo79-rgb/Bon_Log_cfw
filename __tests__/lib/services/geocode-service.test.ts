// @vitest-environment node
/**
 * lib/services/geocode-service — 国土地理院 (GSI) 住所検索 API ラッパーの単体テスト。
 *
 * geocodeAddress / searchAddressSuggestions ともに例外を投げず discriminated union を
 * 返す設計のため、GSI レスポンスのパース分岐（成功/0件/形式不正/HTTPエラー/例外）を検証する。
 * 外部 HTTP は global.fetch モックで代替し、実通信は行わない。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

describe('geocode-service', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('geocodeAddress', () => {
    it('GSI が候補を返す場合は単一の最良候補 { ok: true, latitude, longitude, displayName } を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            geometry: { coordinates: [139.6503, 35.6762] },
            properties: { title: '東京都渋谷区代々木1-1-1' },
          },
        ]),
      })

      const { geocodeAddress } = await import('@/lib/services/geocode-service')
      const result = await geocodeAddress('東京都渋谷区')

      expect(result).toEqual({
        ok: true,
        latitude: 35.6762,
        longitude: 139.6503,
        displayName: '東京都渋谷区代々木1-1-1',
      })
    })

    it('候補が0件の場合は { ok: false, reason: "not_found" } を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      const { geocodeAddress } = await import('@/lib/services/geocode-service')
      const result = await geocodeAddress('存在しない住所')

      expect(result).toEqual({ ok: false, reason: 'not_found' })
    })

    it('GSI レスポンス形式が不正な場合も { ok: false, reason: "not_found" } を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ unexpected: 'shape' }]),
      })

      const { geocodeAddress } = await import('@/lib/services/geocode-service')
      const result = await geocodeAddress('東京都')

      expect(result).toEqual({ ok: false, reason: 'not_found' })
    })

    it('HTTP エラーレスポンスの場合は { ok: false, reason: "http_error" } を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false })

      const { geocodeAddress } = await import('@/lib/services/geocode-service')
      const result = await geocodeAddress('東京都')

      expect(result).toEqual({ ok: false, reason: 'http_error' })
    })

    it('JSON パース失敗時は { ok: false, reason: "parse_error" } を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('invalid json')),
      })

      const { geocodeAddress } = await import('@/lib/services/geocode-service')
      const result = await geocodeAddress('東京都')

      expect(result).toEqual({ ok: false, reason: 'parse_error' })
    })

    it('fetch が例外を投げた場合は { ok: false, reason: "network_error" } を返す', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network down'))

      const { geocodeAddress } = await import('@/lib/services/geocode-service')
      const result = await geocodeAddress('東京都')

      expect(result).toEqual({ ok: false, reason: 'network_error' })
    })
  })

  describe('searchAddressSuggestions', () => {
    it('GSI が複数候補を返す場合は suggestions 配列を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          { geometry: { coordinates: [139.6503, 35.6762] }, properties: { title: '東京都渋谷区' } },
          { geometry: { coordinates: [139.7454, 35.6585] }, properties: { title: '東京都港区' } },
        ]),
      })

      const { searchAddressSuggestions } = await import('@/lib/services/geocode-service')
      const result = await searchAddressSuggestions('東京都')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.suggestions).toHaveLength(2)
        expect(result.suggestions[0]).toEqual({
          latitude: 35.6762,
          longitude: 139.6503,
          displayName: '東京都渋谷区',
          formattedAddress: '東京都渋谷区',
        })
      }
    })

    it('候補が0件の場合は { ok: false } を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      const { searchAddressSuggestions } = await import('@/lib/services/geocode-service')
      const result = await searchAddressSuggestions('存在しない地名')

      expect(result).toEqual({ ok: false })
    })

    it('最大件数（MAX_ADDRESS_SUGGESTIONS）でスライスされる', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(
          Array(10).fill(null).map((_, i) => ({
            geometry: { coordinates: [139.0 + i, 35.0 + i] },
            properties: { title: `地名${i}` },
          }))
        ),
      })

      const { searchAddressSuggestions } = await import('@/lib/services/geocode-service')
      const { MAX_ADDRESS_SUGGESTIONS } = await import('@/lib/constants/limits')
      const result = await searchAddressSuggestions('東京')

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.suggestions).toHaveLength(MAX_ADDRESS_SUGGESTIONS)
      }
    })

    it('HTTP エラーの場合は { ok: false } を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false })

      const { searchAddressSuggestions } = await import('@/lib/services/geocode-service')
      const result = await searchAddressSuggestions('東京都')

      expect(result).toEqual({ ok: false })
    })

    it('fetch 例外時は { ok: false } を返す', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network down'))

      const { searchAddressSuggestions } = await import('@/lib/services/geocode-service')
      const result = await searchAddressSuggestions('東京都')

      expect(result).toEqual({ ok: false })
    })
  })
})
