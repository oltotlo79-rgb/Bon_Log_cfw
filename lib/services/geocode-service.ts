/**
 * @module lib/services/geocode-service
 * 国土地理院 (GSI) 住所検索 API を用いた住所ジオコーディング。
 *
 * Web の Server Action (`lib/actions/shop.ts::geocodeAddress` / `searchAddressSuggestions`) と
 * mobile API v1 route (`app/api/v1/geocode`) の双方から呼べるよう、GSI 呼び出し・パース処理を
 * このファイルに集約する。認証・エラーメッセージへのマッピングは呼び出し元（action / route）が担う
 * （このファイルは 'use server' を付けない services 層のため RPC 公開されない）。
 */
import 'server-only'

import { z } from 'zod'
import { GSI_ADDRESS_SEARCH_URL, ADDRESS_SEARCH_TIMEOUT_MS, MAX_ADDRESS_SUGGESTIONS } from '@/lib/constants/limits'

/**
 * 国土地理院 (GSI) 住所検索 API のレスポンス schema。
 * 各エントリは `geometry.coordinates: [経度, 緯度]` を持つ GeoJSON 風の形状。
 * 任意 cast を避けるため Zod で narrow し、未知 shape を runtime で弾く。
 */
const gsiSearchResultsSchema = z.array(
  z.object({
    geometry: z.object({
      coordinates: z.tuple([z.number(), z.number()]),
    }),
    properties: z.object({
      title: z.string(),
    }),
  }),
)

export type GeocodeSuggestion = {
  latitude: number
  longitude: number
  displayName: string
  formattedAddress: string
}

export type GeocodeAddressResult =
  | { ok: true; latitude: number; longitude: number; displayName: string }
  | { ok: false; reason: 'http_error' | 'parse_error' | 'not_found' | 'network_error' }

/**
 * 住所文字列から単一の最良候補（緯度経度）を取得する。
 *
 * 呼び出し元がエラー種別ごとに異なるメッセージへマッピングできるよう、
 * 失敗理由を discriminated union で返す（例外は投げない）。
 */
export async function geocodeAddress(address: string): Promise<GeocodeAddressResult> {
  try {
    const encodedAddress = encodeURIComponent(address)

    const response = await fetch(
      `${GSI_ADDRESS_SEARCH_URL}?q=${encodedAddress}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(ADDRESS_SEARCH_TIMEOUT_MS),
      }
    )

    if (!response.ok) {
      return { ok: false, reason: 'http_error' }
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      return { ok: false, reason: 'parse_error' }
    }

    const parsed = gsiSearchResultsSchema.safeParse(data)
    if (!parsed.success || parsed.data.length === 0) {
      return { ok: false, reason: 'not_found' }
    }

    // 国土地理院APIは [経度, 緯度] の順序で返す
    const first = parsed.data[0]
    if (!first) return { ok: false, reason: 'not_found' }
    const [longitude, latitude] = first.geometry.coordinates

    return { ok: true, latitude, longitude, displayName: first.properties.title }
  } catch {
    return { ok: false, reason: 'network_error' }
  }
}

export type SearchAddressSuggestionsResult =
  | { ok: true; suggestions: GeocodeSuggestion[] }
  | { ok: false }

/**
 * 住所候補を検索する（オートコンプリート用）。
 *
 * 呼び出し元側で query の長さ・空文字バリデーションを済ませている前提
 * （このファイルは GSI 呼び出し・パースのみを担う）。
 */
export async function searchAddressSuggestions(query: string): Promise<SearchAddressSuggestionsResult> {
  try {
    const encodedQuery = encodeURIComponent(query)

    const response = await fetch(
      `${GSI_ADDRESS_SEARCH_URL}?q=${encodedQuery}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(ADDRESS_SEARCH_TIMEOUT_MS),
      }
    )

    if (!response.ok) {
      return { ok: false }
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      return { ok: false }
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false }
    }

    const parsedList = gsiSearchResultsSchema.safeParse(data)
    if (!parsedList.success || parsedList.data.length === 0) {
      return { ok: false }
    }

    // 国土地理院APIは [経度, 緯度] の順序で返す
    const suggestions = parsedList.data.slice(0, MAX_ADDRESS_SUGGESTIONS).map((item) => {
      const [longitude, latitude] = item.geometry.coordinates
      return {
        latitude,
        longitude,
        displayName: item.properties.title,
        formattedAddress: item.properties.title,
      }
    })

    return { ok: true, suggestions }
  } catch {
    return { ok: false }
  }
}
