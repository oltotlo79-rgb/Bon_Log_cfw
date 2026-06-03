/**
 * 公開中お知らせバナー。
 *
 * `getActiveAnnouncements` で取得した公開期間中のお知らせのうち、
 * `type` が `banner` または `both` の最新 1 件を上部バナーとして表示する。
 * 種別 `notification` のものは通知センター専用なのでバナーには出さない。
 *
 * - Server Component でデータ取得（60 秒 unstable_cache）
 * - Client Component (`AnnouncementBannerClient`) で dismiss 状態を localStorage 管理
 * - dismiss は ID 単位なので、新しいお知らせが追加されれば再表示される
 *
 * @module components/common/AnnouncementBanner
 */

import { getActiveAnnouncements } from '@/lib/actions/announcement'
import { AnnouncementBannerClient } from './AnnouncementBannerClient'

/** バナー表示対象とするお知らせ種別。`notification` 専用のお知らせは除外する。 */
const BANNER_DISPLAY_TYPES = new Set(['banner', 'both'] as const)

export async function AnnouncementBanner() {
  const announcements = await getActiveAnnouncements()
  const bannerCandidates = announcements.filter((a) => BANNER_DISPLAY_TYPES.has(a.type as 'banner' | 'both'))

  if (bannerCandidates.length === 0) return null

  // ISO 文字列で渡し、クライアントで Date 変換しないことで hydration mismatch を避ける。
  return (
    <AnnouncementBannerClient
      items={bannerCandidates.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        type: a.type,
      }))}
    />
  )
}
