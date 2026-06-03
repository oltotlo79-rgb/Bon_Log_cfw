'use server'

import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import {
  ACTIVE_ANNOUNCEMENTS_LIMIT,
  ACTIVE_ANNOUNCEMENTS_REVALIDATE_SECONDS,
} from '@/lib/constants/limits'
import { logger } from '@/lib/logger'

const ACTIVE_ANNOUNCEMENTS_CACHE_TAG = 'announcements'

async function fetchActiveAnnouncements() {
  try {
    const now = new Date()
    return await prisma.announcement.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: 'desc' },
      take: ACTIVE_ANNOUNCEMENTS_LIMIT,
    })
  } catch (error) {
    logger.error('getActiveAnnouncements failed', error)
    return []
  }
}

const getCachedActiveAnnouncements = unstable_cache(
  fetchActiveAnnouncements,
  ['active-announcements'],
  {
    revalidate: ACTIVE_ANNOUNCEMENTS_REVALIDATE_SECONDS,
    tags: [ACTIVE_ANNOUNCEMENTS_CACHE_TAG],
  },
)

/**
 * 現在有効なお知らせを取得（フロントエンド表示用）
 *
 * `'use server'` ファイルに置く必要があるが認証不要の公開データ。
 * admin 配下に置くと「admin 関数は全て requireAdmin 保護」の規約と衝突するため、
 * 非 admin 配置とし、60秒のサーバーサイドキャッシュで負荷を抑える。
 * 管理者が作成/更新/削除した際は `revalidateTag('announcements')` で即時無効化する。
 */
export async function getActiveAnnouncements() {
  return getCachedActiveAnnouncements()
}
