import { z } from 'zod'
import {
  MAX_SHOP_NAME_LENGTH,
  MAX_SHOP_ADDRESS_LENGTH,
  MAX_SHOP_PHONE_LENGTH,
  MAX_SHOP_URL_LENGTH,
  MAX_SHOP_BUSINESS_HOURS_LENGTH,
  MAX_SHOP_CLOSED_DAYS_LENGTH,
} from '@/lib/constants/limits'

/**
 * 盆栽園変更リクエストで送信可能なフィールド。
 * Server Action と Server Component 両方から参照される純粋型。
 */
export type ShopChangeRequestData = {
  name?: string
  address?: string
  phone?: string
  website?: string
  businessHours?: string
  closedDays?: string
}

/**
 * 盆栽園変更リクエストの入力検証 schema。
 * `.strict()` で未知キーを拒否し、各フィールドに長さ上限を持たせる。
 * URL は `https?://` のみ許可しオープンリダイレクト / javascript: スキーム流入を防ぐ。
 */
export const shopChangeRequestInputSchema = z
  .object({
    name: z.string().trim().min(1).max(MAX_SHOP_NAME_LENGTH).optional(),
    address: z.string().trim().min(1).max(MAX_SHOP_ADDRESS_LENGTH).optional(),
    phone: z.string().trim().max(MAX_SHOP_PHONE_LENGTH).optional(),
    website: z
      .string()
      .trim()
      .max(MAX_SHOP_URL_LENGTH)
      .refine((s) => s === '' || /^https?:\/\//i.test(s), { message: 'website must be http(s) URL' })
      .optional(),
    businessHours: z.string().trim().max(MAX_SHOP_BUSINESS_HOURS_LENGTH).optional(),
    closedDays: z.string().trim().max(MAX_SHOP_CLOSED_DAYS_LENGTH).optional(),
  })
  .strict()

/**
 * DB から取り出した requestedChanges (Json) を読み戻す用の緩い schema。
 * 既存レコードが旧形式 (未トリミング、未知キー) を含む可能性があるため
 * `.strip()` で未知キーを落とし、不正値は空オブジェクトに縮退する。
 */
const shopChangeRequestStoredSchema = z
  .object({
    name: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    website: z.string().optional(),
    businessHours: z.string().optional(),
    closedDays: z.string().optional(),
  })
  .strip()

/**
 * DB の Json カラムに保存された requestedChanges を {@link ShopChangeRequestData} に
 * 絞り込む。不正値は空オブジェクトにフォールバックし、呼び出し側の素の
 * `as` キャストを不要にする。
 */
export function parseShopChangeRequestedChanges(raw: unknown): ShopChangeRequestData {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const parsed = shopChangeRequestStoredSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}

/**
 * Sanitized changes に変更があるか (非空フィールドが 1 つ以上あるか) を返す。
 * 空文字 / undefined / null は変更なしとみなす。
 */
export function hasMeaningfulChanges(changes: ShopChangeRequestData): boolean {
  return Object.values(changes).some((v) => typeof v === 'string' && v.length > 0)
}
