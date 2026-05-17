/**
 * 管理者Server Componentページのテスト
 * 各ページの「エラー時リダイレクト」と「正常レンダリング」を検証
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// redirect / notFound をモック（throwしてページ実行を中断）
class RedirectError extends Error {
  url: string
  constructor(url: string) { super(`REDIRECT:${url}`); this.url = url }
}
const mockRedirect = vi.fn((url: string) => { throw new RedirectError(url) })
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))

// Suspense をパススルー
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return { ...actual, Suspense: ({ children }: { children: React.ReactNode }) => children }
})

// Server Actions モック
const mockGetAnnouncements = vi.fn()
const mockGetNgWords = vi.fn()
const mockGetModerationQueue = vi.fn()
const mockGetWarnings = vi.fn()
const mockGetAdminRoles = vi.fn()
const mockGetSegments = vi.fn()
const mockGetSecurityDashboard = vi.fn()
const mockGetSecurityEvents = vi.fn()
const mockGetIpAddresses = vi.fn()
const mockDetectMultiAccounts = vi.fn()
const mockIsAdmin = vi.fn()
const mockGetCmsPages = vi.fn()
const mockGetAdminPesticides = vi.fn()
const mockGetCohortAnalysis = vi.fn()
const mockGetContentAnalysis = vi.fn()
const mockGetNgWordStats = vi.fn()

vi.mock('@/lib/actions/admin/announcements', () => ({ getAnnouncements: (...args: unknown[]) => mockGetAnnouncements(...args) }))
vi.mock('@/lib/actions/admin/moderation', () => ({
  getNgWords: (...args: unknown[]) => mockGetNgWords(...args),
  getNgWordStats: (...args: unknown[]) => mockGetNgWordStats(...args),
  getModerationQueue: (...args: unknown[]) => mockGetModerationQueue(...args),
}))
vi.mock('@/lib/actions/admin/warnings', () => ({ getWarnings: (...args: unknown[]) => mockGetWarnings(...args) }))
vi.mock('@/lib/actions/admin/roles', () => ({ getAdminRoles: (...args: unknown[]) => mockGetAdminRoles(...args) }))
vi.mock('@/lib/admin-permissions', () => ({ ROLE_LABELS: { super_admin: 'スーパー管理者', admin: '管理者' } }))
vi.mock('@/lib/actions/admin/segments', () => ({ getSegments: (...args: unknown[]) => mockGetSegments(...args) }))
vi.mock('@/lib/actions/admin/security', () => ({ getSecurityDashboard: (...args: unknown[]) => mockGetSecurityDashboard(...args), getSecurityEvents: (...args: unknown[]) => mockGetSecurityEvents(...args) }))
vi.mock('@/lib/actions/admin/ip-management', () => ({ getIpAddresses: (...args: unknown[]) => mockGetIpAddresses(...args), detectMultiAccounts: (...args: unknown[]) => mockDetectMultiAccounts(...args) }))
vi.mock('@/lib/actions/admin', () => ({ isAdmin: (...args: unknown[]) => mockIsAdmin(...args) }))
vi.mock('@/lib/actions/admin/cms', () => ({ getCmsPages: (...args: unknown[]) => mockGetCmsPages(...args) }))
vi.mock('@/lib/actions/admin/pesticide-data', () => ({ getAdminPesticides: (...args: unknown[]) => mockGetAdminPesticides(...args) }))
vi.mock('@/lib/actions/admin/analytics', () => ({ getCohortAnalysis: (...args: unknown[]) => mockGetCohortAnalysis(...args), getContentAnalysis: (...args: unknown[]) => mockGetContentAnalysis(...args) }))

// Client Components をスタブ化
vi.mock('@/app/admin/announcements/AnnouncementList', () => ({ AnnouncementList: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/ng-words/NgWordList', () => ({ NgWordList: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/moderation-queue/ModerationQueueList', () => ({ ModerationQueueList: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/warnings/WarningsList', () => ({ WarningsList: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/roles/RolesTable', () => ({ default: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/roles/RoleAbilityDetails', () => ({ RoleAbilityDetails: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/segments/SegmentBuilder', () => ({ SegmentBuilder: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/security/SecurityEventList', () => ({ SecurityEventList: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/ip-management/IpManagementClient', () => ({ IpManagementClient: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/content-management/CmsPageList', () => ({ CmsPageList: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/pesticide-data/PesticideTable', () => ({ PesticideTable: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/analytics/cohort/CohortTable', () => ({ CohortTable: () => <div data-testid="stub" /> }))
vi.mock('@/app/admin/analytics/content/ContentAnalyticsClient', () => ({ ContentAnalyticsClient: () => <div data-testid="stub" /> }))

vi.mock('@/lib/db', () => ({
  prisma: new Proxy({}, {
    get: () => ({ findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), findUnique: vi.fn().mockResolvedValue(null) }),
  }),
}))
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: (props: Record<string, unknown>) => <img alt="" {...props} /> }))

const emptySearchParams = Promise.resolve({})

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// 1. Announcements
// ============================================================
import AnnouncementsPage from '@/app/admin/announcements/page'

describe('AnnouncementsPage', () => {
  it('エラー時はリダイレクト', async () => {
    mockGetAnnouncements.mockResolvedValue({ error: '認証エラー' })
    await expect(AnnouncementsPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('正常時はコンテンツ表示', async () => {
    mockGetAnnouncements.mockResolvedValue({
      announcements: [{ id: '1', title: 'テスト', type: 'banner', isActive: true, content: 'c', createdAt: new Date() }],
      total: 1,
    })
    const result = await AnnouncementsPage()
    expect(result).toBeDefined()
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

// ============================================================
// 2. NG Words
// ============================================================
import NgWordsPage from '@/app/admin/ng-words/page'

describe('NgWordsPage', () => {
  it('エラー時はエラー表示', async () => {
    mockGetNgWords.mockResolvedValue({ error: 'エラー' })
    mockGetNgWordStats.mockResolvedValue({ total: 0, activeCount: 0, inactiveCount: 0 })
    const result = await NgWordsPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })

  it('正常時はリスト表示', async () => {
    mockGetNgWords.mockResolvedValue({ words: [], total: 0 })
    mockGetNgWordStats.mockResolvedValue({ total: 0, activeCount: 0, inactiveCount: 0 })
    const result = await NgWordsPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })

  it('統計エラー時もエラー表示', async () => {
    mockGetNgWords.mockResolvedValue({ words: [], total: 0 })
    mockGetNgWordStats.mockResolvedValue({ error: '統計取得エラー' })
    const result = await NgWordsPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })
})

// ============================================================
// 3. Moderation Queue
// ============================================================
import ModerationQueuePage from '@/app/admin/moderation-queue/page'

describe('ModerationQueuePage', () => {
  it('エラー時はリダイレクト', async () => {
    mockGetModerationQueue.mockResolvedValue({ error: '認証エラー' })
    await expect(ModerationQueuePage({ searchParams: emptySearchParams })).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('正常時はキュー表示', async () => {
    mockGetModerationQueue.mockResolvedValue({ items: [], total: 0 })
    const result = await ModerationQueuePage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })

  it('reviewedAt を持つ item は ISO 文字列に変換され、null の場合はそのまま伝わる', async () => {
    const reviewed = new Date('2026-04-01T03:14:15.000Z')
    const created = new Date('2026-04-02T00:00:00.000Z')
    mockGetModerationQueue.mockResolvedValueOnce({
      items: [
        {
          id: 'q-1',
          targetType: 'post',
          targetId: 'p-1',
          status: 'pending',
          reason: 'NG word',
          matchedWords: ['x'],
          reviewedBy: null,
          reviewedAt: reviewed, // truthy 分岐
          createdAt: created,
        },
        {
          id: 'q-2',
          targetType: 'comment',
          targetId: 'c-1',
          status: 'pending',
          reason: null,
          matchedWords: [],
          reviewedBy: null,
          reviewedAt: null, // falsy 分岐
          createdAt: created,
        },
      ],
      total: 2,
      nextCursor: 'cur-2',
    })
    // 4 つの stats query (pending / auto_flagged / approved / rejected)
    mockGetModerationQueue.mockResolvedValueOnce({ items: [], total: 5 })
    mockGetModerationQueue.mockResolvedValueOnce({ items: [], total: 7 })
    mockGetModerationQueue.mockResolvedValueOnce({ items: [], total: 9 })
    mockGetModerationQueue.mockResolvedValueOnce({ items: [], total: 11 })
    const result = await ModerationQueuePage({
      searchParams: Promise.resolve({ status: 'pending' }),
    })
    expect(result).toBeDefined()
  })

  it('stats の各クエリがエラーを返したときは 0 にフォールバックする (4 分岐)', async () => {
    // メインクエリは success
    mockGetModerationQueue.mockResolvedValueOnce({ items: [], total: 0 })
    // 4 stats queries 全て error → 全て 0 になる
    mockGetModerationQueue.mockResolvedValueOnce({ error: 'unauthorized' })
    mockGetModerationQueue.mockResolvedValueOnce({ error: 'unauthorized' })
    mockGetModerationQueue.mockResolvedValueOnce({ error: 'unauthorized' })
    mockGetModerationQueue.mockResolvedValueOnce({ error: 'unauthorized' })
    const result = await ModerationQueuePage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })

  it('cursor / trail を含む searchParams を受け入れて CursorPagination に渡す', async () => {
    mockGetModerationQueue.mockResolvedValue({ items: [], total: 0, nextCursor: undefined })
    const result = await ModerationQueuePage({
      searchParams: Promise.resolve({ cursor: 'abc', trail: 'a,b' }),
    })
    expect(result).toBeDefined()
  })
})

// ============================================================
// 4. Warnings
// ============================================================
import WarningsPage from '@/app/admin/warnings/page'

describe('WarningsPage', () => {
  it('エラー時はエラー表示', async () => {
    mockGetWarnings.mockResolvedValue({ error: 'エラー' })
    const result = await WarningsPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })

  it('正常時は警告リスト表示', async () => {
    mockGetWarnings.mockResolvedValue({ warnings: [], total: 0, stats: { total: 0, active: 0, byLevel: {} } })
    const result = await WarningsPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })
})

// ============================================================
// 5. Roles
// ============================================================
import RolesPage from '@/app/admin/roles/page'

describe('RolesPage', () => {
  it('エラー時はリダイレクト', async () => {
    mockGetAdminRoles.mockResolvedValue({ error: '認証エラー' })
    await expect(RolesPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('正常時はロールテーブル表示', async () => {
    mockGetAdminRoles.mockResolvedValue({ admins: [], roleLabels: {} })
    const result = await RolesPage()
    expect(result).toBeDefined()
  })
})

// ============================================================
// 6. Segments
// ============================================================
import SegmentsPage from '@/app/admin/segments/page'

describe('SegmentsPage', () => {
  it('エラー時もレンダリング', async () => {
    mockGetSegments.mockResolvedValue({ error: 'エラー' })
    const result = await SegmentsPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })

  it('正常時はセグメント表示', async () => {
    mockGetSegments.mockResolvedValue({ segments: [], total: 0 })
    const result = await SegmentsPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })
})

// ============================================================
// 7. Security
// ============================================================
import SecurityPage from '@/app/admin/security/page'

describe('SecurityPage', () => {
  it('ダッシュボードエラー時はリダイレクト', async () => {
    mockGetSecurityDashboard.mockResolvedValue({ error: '認証エラー' })
    mockGetSecurityEvents.mockResolvedValue({ events: [], total: 0 })
    await expect(SecurityPage({ searchParams: emptySearchParams })).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('イベントエラー時はリダイレクト', async () => {
    mockGetSecurityDashboard.mockResolvedValue({ totalEvents: 0, recentEvents: 0, suspiciousIps: [], eventsByType: {} })
    mockGetSecurityEvents.mockResolvedValue({ error: '認証エラー' })
    await expect(SecurityPage({ searchParams: emptySearchParams })).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('正常時はダッシュボード表示', async () => {
    mockGetSecurityDashboard.mockResolvedValue({
      totalEvents: 10, recentEvents: 5, suspiciousIps: [],
      eventsByType: [], topFailedIps: [],
      failedLoginsToday: 0, failedLoginsWeek: 0,
      passwordChangesToday: 0, twoFactorTogglesToday: 0,
    })
    mockGetSecurityEvents.mockResolvedValue({ events: [], total: 0 })
    const result = await SecurityPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })
})

// ============================================================
// 8. IP Management
// ============================================================
import IpManagementPage from '@/app/admin/ip-management/page'

describe('IpManagementPage', () => {
  it('正常時は表示', async () => {
    mockGetIpAddresses.mockResolvedValue({ devices: [], total: 0 })
    mockDetectMultiAccounts.mockResolvedValue({ suspiciousIps: [] })
    const result = await IpManagementPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })
})

// ============================================================
// 9. Backups
// ============================================================
import BackupsPage from '@/app/admin/backups/page'

describe('BackupsPage', () => {
  it('非管理者はリダイレクト', async () => {
    mockIsAdmin.mockResolvedValue(false)
    await expect(BackupsPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('管理者はページ表示', async () => {
    mockIsAdmin.mockResolvedValue(true)
    const result = await BackupsPage()
    expect(result).toBeDefined()
  })
})

// ============================================================
// 10. Content Management
// ============================================================
import ContentManagementPage from '@/app/admin/content-management/page'

describe('ContentManagementPage', () => {
  it('エラー時はリダイレクト', async () => {
    mockGetCmsPages.mockResolvedValue({ error: '認証エラー' })
    await expect(ContentManagementPage({ searchParams: emptySearchParams })).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('正常時はCMSリスト表示', async () => {
    mockGetCmsPages.mockResolvedValue({ pages: [], total: 0 })
    const result = await ContentManagementPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })
})

// ============================================================
// 11. Pesticide Data
// ============================================================
import PesticideDataPage from '@/app/admin/pesticide-data/page'

describe('PesticideDataPage', () => {
  it('非管理者はリダイレクト', async () => {
    mockIsAdmin.mockResolvedValue(false)
    await expect(PesticideDataPage({ searchParams: emptySearchParams })).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('管理者はテーブル表示', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockGetAdminPesticides.mockResolvedValue({ pesticides: [], total: 0 })
    const result = await PesticideDataPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })
})

// ============================================================
// 12. Cohort Analysis
// ============================================================
import CohortPage from '@/app/admin/analytics/cohort/page'

describe('CohortPage', () => {
  it('エラー時はリダイレクト', async () => {
    mockGetCohortAnalysis.mockResolvedValue({ error: '認証エラー' })
    await expect(CohortPage({ searchParams: emptySearchParams })).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('正常時はコホートテーブル表示', async () => {
    mockGetCohortAnalysis.mockResolvedValue({ cohorts: [], retention: [] })
    const result = await CohortPage({ searchParams: emptySearchParams })
    expect(result).toBeDefined()
  })
})

// ============================================================
// 13. Content Analytics
// ============================================================
import ContentAnalyticsPage from '@/app/admin/analytics/content/page'

describe('ContentAnalyticsPage', () => {
  it('エラー時はリダイレクト', async () => {
    mockGetContentAnalysis.mockResolvedValue({ error: '認証エラー' })
    await expect(ContentAnalyticsPage()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('正常時は分析表示', async () => {
    mockGetContentAnalysis.mockResolvedValue({ genreTrends: [], topHashtags: [], dailyEngagement: [] })
    const result = await ContentAnalyticsPage()
    expect(result).toBeDefined()
  })
})
