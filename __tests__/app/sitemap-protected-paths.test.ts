/**
 * sitemap.ts が PROTECTED_PATHS を出力しないことを検証する回帰テスト。
 *
 * 監査指摘 (P0-3) で `/bonsai/[id]` が sitemap に含まれていた。
 * 認証必須 route が sitemap に混入すると Search Console の blocked / soft 404 が
 * 増えるため、PROTECTED_PATHS と sitemap 出力 URL の交差が常に空であることを保証する。
 */
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PROTECTED_PATHS } from '@/lib/constants/routes'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findMany: vi.fn().mockResolvedValue([]) },
    post: { findMany: vi.fn().mockResolvedValue([]) },
    bonsaiShop: { findMany: vi.fn().mockResolvedValue([]) },
    event: { findMany: vi.fn().mockResolvedValue([]) },
    bonsaiTerm: { findMany: vi.fn().mockResolvedValue([]) },
    pesticide: { findMany: vi.fn().mockResolvedValue([]) },
    diseasePest: { findMany: vi.fn().mockResolvedValue([]) },
    bonsai: { findMany: vi.fn().mockResolvedValue([]) },
    pesticideColumn: { findMany: vi.fn().mockResolvedValue([]) },
    activeIngredient: { findMany: vi.fn().mockResolvedValue([]) },
    spreaderType: { findMany: vi.fn().mockResolvedValue([]) },
    fertilizerColumn: { findMany: vi.fn().mockResolvedValue([]) },
    fertilizerNutrient: { findMany: vi.fn().mockResolvedValue([]) },
    treeSpecies: { findMany: vi.fn().mockResolvedValue([]) },
    hormoneType: { findMany: vi.fn().mockResolvedValue([]) },
    hormoneColumn: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/lib/build/db-availability', () => ({
  shouldSkipBuildTimeDbAccess: () => false,
}))

describe('sitemap PROTECTED_PATHS exclusion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sitemap には PROTECTED_PATHS のいずれの prefix も含まれない', async () => {
    const sitemap = (await import('@/app/sitemap')).default
    const entries = await sitemap()
    const urls = entries.map((entry) => entry.url)

    for (const protectedPath of PROTECTED_PATHS) {
      for (const url of urls) {
        const pathname = new URL(url).pathname
        // ROUTE_FEED 等の root protected path 自身、または `${protectedPath}/...` を弾く
        const matched =
          pathname === protectedPath || pathname.startsWith(`${protectedPath}/`)
        expect(
          matched,
          `sitemap entry ${url} matched protected path ${protectedPath}`,
        ).toBe(false)
      }
    }
  })

  it('特に /bonsai/* は sitemap に含まれない (P0-3 回帰)', async () => {
    const sitemap = (await import('@/app/sitemap')).default
    const entries = await sitemap()
    const bonsaiUrls = entries.filter((entry) => entry.url.includes('/bonsai/'))
    expect(bonsaiUrls).toEqual([])
  })
})
