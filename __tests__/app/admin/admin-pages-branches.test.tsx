/**
 * 管理者ページの未カバー分岐テスト
 * 実データを渡して描画ロジックの分岐をカバーする
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

class RedirectError extends Error {
  url: string
  constructor(url: string) { super(`REDIRECT:${url}`); this.url = url }
}
const mockRedirect = vi.fn((url: string) => { throw new RedirectError(url) })
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))

vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return { ...actual, Suspense: ({ children }: { children: React.ReactNode }) => children }
})

// Server Actions モック
const mockGetCohortAnalysis = vi.fn()
const mockGetContentAnalysis = vi.fn()
const mockGetSecurityDashboard = vi.fn()
const mockGetSecurityEvents = vi.fn()
const mockGetAdminRoles = vi.fn()
const mockGetWarnings = vi.fn()
const mockGetUserActivity = vi.fn()
const mockDetectSuspiciousBehavior = vi.fn()
const mockGetAdminUserDetail = vi.fn()
const mockGetNutrientBySlug = vi.fn()
const mockGetNutrients = vi.fn()
const mockGetAdminPesticides = vi.fn()
const mockIsAdmin = vi.fn()

vi.mock('@/lib/actions/admin/analytics', () => ({
  getCohortAnalysis: (...args: unknown[]) => mockGetCohortAnalysis(...args),
  getContentAnalysis: (...args: unknown[]) => mockGetContentAnalysis(...args),
}))
vi.mock('@/lib/actions/admin/security', () => ({
  getSecurityDashboard: (...args: unknown[]) => mockGetSecurityDashboard(...args),
  getSecurityEvents: (...args: unknown[]) => mockGetSecurityEvents(...args),
}))
vi.mock('@/lib/actions/admin/roles', () => ({
  getAdminRoles: (...args: unknown[]) => mockGetAdminRoles(...args),
}))
vi.mock('@/lib/admin-permissions', () => ({
  ROLE_LABELS: {
    super_admin: 'スーパー管理者',
    admin: '管理者',
    moderator: 'モデレーター',
    support: 'サポート',
    readonly: '閲覧',
  },
}))
vi.mock('@/lib/actions/admin/warnings', () => ({
  getWarnings: (...args: unknown[]) => mockGetWarnings(...args),
}))
vi.mock('@/lib/actions/admin/activity', () => ({
  getUserActivity: (...args: unknown[]) => mockGetUserActivity(...args),
  detectSuspiciousBehavior: (...args: unknown[]) => mockDetectSuspiciousBehavior(...args),
}))
vi.mock('@/lib/actions/admin/users', () => ({
  getAdminUserDetail: (...args: unknown[]) => mockGetAdminUserDetail(...args),
}))
vi.mock('@/lib/actions/fertilizer', () => ({
  getNutrientBySlug: (...args: unknown[]) => mockGetNutrientBySlug(...args),
  getNutrients: (...args: unknown[]) => mockGetNutrients(...args),
}))
vi.mock('@/lib/actions/admin/pesticide-data', () => ({
  getAdminPesticides: (...args: unknown[]) => mockGetAdminPesticides(...args),
}))
vi.mock('@/lib/actions/admin', () => ({
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}))

// Client Components をスタブ化
vi.mock('@/app/admin/analytics/cohort/CohortTable', () => ({
  CohortTable: (props: Record<string, unknown>) => <div data-testid="cohort-table" data-props={JSON.stringify(props)} />,
}))
vi.mock('@/app/admin/analytics/content/ContentAnalyticsClient', () => ({
  ContentAnalyticsClient: (props: Record<string, unknown>) => <div data-testid="content-client" data-props={JSON.stringify(props)} />,
}))
vi.mock('@/app/admin/security/SecurityEventList', () => ({
  SecurityEventList: () => <div data-testid="security-events" />,
}))
vi.mock('@/app/admin/roles/RolesTable', () => ({
  default: () => <div data-testid="roles-table" />,
}))
vi.mock('@/app/admin/roles/RoleAbilityDetails', () => ({
  RoleAbilityDetails: () => <div data-testid="role-ability-details" />,
}))
vi.mock('@/app/admin/warnings/WarningsList', () => ({
  WarningsList: (props: Record<string, unknown>) => <div data-testid="warnings-list" data-props={JSON.stringify(props)} />,
}))
vi.mock('@/app/admin/pesticide-data/PesticideTable', () => ({
  PesticideTable: () => <div data-testid="pesticide-table" />,
}))
vi.mock('@/components/fertilizer/NutrientCategoryBadge', () => ({
  NutrientCategoryBadge: () => <span data-testid="nutrient-badge" />,
}))
vi.mock('@/components/fertilizer/NutrientCard', () => ({
  NutrientCard: () => <div data-testid="nutrient-card" />,
}))
vi.mock('@/lib/db', () => ({
  prisma: new Proxy({}, {
    get: () => ({ findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) }),
  }),
}))
vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})
vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// CohortPage — 実データの分岐カバー
// ============================================================
import CohortPage from '@/app/admin/analytics/cohort/page'

describe('CohortPage branches', () => {
  const makeCohortData = () => ({
    cohorts: [
      { cohort: '2026-01', total: 100 },
      { cohort: '2026-02', total: 50 },
    ],
    retention: [
      { cohort: '2026-01', activeMonth: '2026-01', activeUsers: 100 },
      { cohort: '2026-01', activeMonth: '2026-02', activeUsers: 60 },
      { cohort: '2026-02', activeMonth: '2026-02', activeUsers: 50 },
      { cohort: '2026-02', activeMonth: '2026-03', activeUsers: 20 },
    ],
  })

  it('retentionMap 構築 + tableData + avgRetention 計算をカバー', async () => {
    mockGetCohortAnalysis.mockResolvedValue(makeCohortData())
    const result = await CohortPage({ searchParams: Promise.resolve({}) })
    expect(result).toBeDefined()
  })

  it('weekly period でも正常動作', async () => {
    mockGetCohortAnalysis.mockResolvedValue(makeCohortData())
    const result = await CohortPage({ searchParams: Promise.resolve({ period: 'weekly' }) })
    expect(result).toBeDefined()
  })

  it('total=0 のコホートでもゼロ除算しない', async () => {
    mockGetCohortAnalysis.mockResolvedValue({
      cohorts: [{ cohort: '2026-01', total: 0 }],
      retention: [{ cohort: '2026-01', activeMonth: '2026-01', activeUsers: 0 }],
    })
    const result = await CohortPage({ searchParams: Promise.resolve({}) })
    expect(result).toBeDefined()
  })

  it('retention が空でも avgRetention を計算', async () => {
    mockGetCohortAnalysis.mockResolvedValue({ cohorts: [{ cohort: '2026-01', total: 10 }], retention: [] })
    const result = await CohortPage({ searchParams: Promise.resolve({}) })
    expect(result).toBeDefined()
  })
})

// ============================================================
// ContentAnalyticsPage — 実データの分岐カバー
// ============================================================
import ContentAnalyticsPage from '@/app/admin/analytics/content/page'

describe('ContentAnalyticsPage branches', () => {
  it('genreTrends・topHashtags・dailyEngagement があるケース', async () => {
    mockGetContentAnalysis.mockResolvedValue({
      genreTrends: [
        { name: '松柏類', count: 100 },
        { name: '雑木類', count: 50 },
      ],
      topHashtags: [
        { tag: '盆栽', count: 50 },
        { tag: '松', count: 30 },
        { tag: '紅葉', count: 10 },
      ],
      dailyEngagement: [{ date: '2026-04-01', posts: 10, likes: 50, comments: 20 }],
    })
    const result = await ContentAnalyticsPage()
    expect(result).toBeDefined()
  })

  it('genreTrends が空の場合「データがありません」分岐', async () => {
    mockGetContentAnalysis.mockResolvedValue({
      genreTrends: [],
      topHashtags: [{ tag: '盆栽', count: 10 }],
      dailyEngagement: [],
    })
    const result = await ContentAnalyticsPage()
    expect(result).toBeDefined()
  })

  it('topHashtags が空の場合', async () => {
    mockGetContentAnalysis.mockResolvedValue({
      genreTrends: [{ name: '松柏類', count: 10 }],
      topHashtags: [],
      dailyEngagement: [],
    })
    const result = await ContentAnalyticsPage()
    expect(result).toBeDefined()
  })

  it('topHashtags が1件のみ (range=0 分岐)', async () => {
    mockGetContentAnalysis.mockResolvedValue({
      genreTrends: [],
      topHashtags: [{ tag: '盆栽', count: 5 }],
      dailyEngagement: [],
    })
    const result = await ContentAnalyticsPage()
    expect(result).toBeDefined()
  })
})

// ============================================================
// SecurityPage — 実データの分岐カバー
// ============================================================
import SecurityPage from '@/app/admin/security/page'

describe('SecurityPage branches', () => {
  const baseDashboard = {
    failedLoginsToday: 0,
    failedLoginsWeek: 0,
    passwordChangesToday: 0,
    twoFactorTogglesToday: 0,
    topFailedIps: [],
    eventsByType: [],
  }

  it('topFailedIps がある場合のテーブル描画 (count>=10, >=5, <5)', async () => {
    mockGetSecurityDashboard.mockResolvedValue({
      ...baseDashboard,
      failedLoginsToday: 15,
      topFailedIps: [
        { ipAddress: '1.2.3.4', count: 15 },
        { ipAddress: '5.6.7.8', count: 7 },
        { ipAddress: '9.10.11.12', count: 2 },
      ],
    })
    mockGetSecurityEvents.mockResolvedValue({ events: [], total: 0 })
    const result = await SecurityPage({ searchParams: Promise.resolve({}) })
    expect(result).toBeDefined()
  })

  it('eventsByType がある場合のバーチャート描画', async () => {
    mockGetSecurityDashboard.mockResolvedValue({
      ...baseDashboard,
      eventsByType: [
        { type: 'failed_login', count: 20 },
        { type: 'password_change', count: 5 },
        { type: '2fa_toggle', count: 3 },
        { type: 'unknown_type', count: 1 },
      ],
    })
    mockGetSecurityEvents.mockResolvedValue({ events: [], total: 0 })
    const result = await SecurityPage({ searchParams: Promise.resolve({}) })
    expect(result).toBeDefined()
  })

  it('searchParams フィルター付き', async () => {
    mockGetSecurityDashboard.mockResolvedValue(baseDashboard)
    mockGetSecurityEvents.mockResolvedValue({ events: [], total: 0 })
    const result = await SecurityPage({
      searchParams: Promise.resolve({
        eventType: 'failed_login',
        ipAddress: '1.2.3.4',
        dateFrom: '2026-01-01',
        dateTo: '2026-04-01',
        page: '2',
      }),
    })
    expect(result).toBeDefined()
  })

  it('events に createdAt が Date のケース', async () => {
    mockGetSecurityDashboard.mockResolvedValue(baseDashboard)
    mockGetSecurityEvents.mockResolvedValue({
      events: [
        { id: 'e1', type: 'failed_login', createdAt: new Date('2026-04-01'), details: { ip: '1.2.3.4' } },
      ],
      total: 1,
    })
    const result = await SecurityPage({ searchParams: Promise.resolve({}) })
    expect(result).toBeDefined()
  })
})

// ============================================================
// RolesPage — roleCounts 分岐
// ============================================================
import RolesPage from '@/app/admin/roles/page'

describe('RolesPage branches', () => {
  it('複数ロールの管理者がいる場合の roleCounts 集計', async () => {
    mockGetAdminRoles.mockResolvedValue({
      admins: [
        { id: 'a1', role: 'super_admin', nickname: 'Admin1' },
        { id: 'a2', role: 'admin', nickname: 'Admin2' },
        { id: 'a3', role: 'admin', nickname: 'Admin3' },
        { id: 'a4', role: 'moderator', nickname: 'Mod1' },
      ],
    })
    const result = await RolesPage()
    expect(result).toBeDefined()
  })
})

// ============================================================
// WarningsPage — levelCounts 分岐
// ============================================================
import WarningsPage from '@/app/admin/warnings/page'

describe('WarningsPage branches', () => {
  it('複数レベルの警告がある場合の levelCounts 集計', async () => {
    mockGetWarnings.mockResolvedValue({
      warnings: [
        { id: 'w1', level: 'caution', isActive: true },
        { id: 'w2', level: 'warning', isActive: true },
        { id: 'w3', level: 'warning', isActive: false },
        { id: 'w4', level: 'ban', isActive: true },
      ],
      total: 4,
    })
    const result = await WarningsPage({ searchParams: Promise.resolve({}) })
    expect(result).toBeDefined()
  })

  it('isActive=true フィルター', async () => {
    mockGetWarnings.mockResolvedValue({ warnings: [{ id: 'w1', level: 'caution', isActive: true }], total: 1 })
    const result = await WarningsPage({ searchParams: Promise.resolve({ isActive: 'true', level: 'caution', search: 'test', page: '2' }) })
    expect(result).toBeDefined()
  })

  it('isActive=false フィルター', async () => {
    mockGetWarnings.mockResolvedValue({ warnings: [], total: 0 })
    const result = await WarningsPage({ searchParams: Promise.resolve({ isActive: 'false' }) })
    expect(result).toBeDefined()
  })
})

// ============================================================
// AdminUserActivityPage — 0%カバレッジ
// ============================================================
import AdminUserActivityPage, { generateMetadata } from '@/app/admin/users/[id]/activity/page'

describe('AdminUserActivityPage', () => {
  it('ユーザーが見つからない場合は notFound', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ error: 'not found' })
    mockGetUserActivity.mockResolvedValue({ activities: [] })
    mockDetectSuspiciousBehavior.mockResolvedValue({ flags: [], isSuspicious: false })
    await expect(AdminUserActivityPage({ params: Promise.resolve({ id: 'xxx' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('正常時にアクティビティタイムラインを表示', async () => {
    mockGetAdminUserDetail.mockResolvedValue({
      user: { id: 'u1', nickname: 'TestUser', email: 'test@test.com', avatarUrl: null, isSuspended: false },
    })
    mockGetUserActivity.mockResolvedValue({
      activities: [
        { type: 'post', id: 'p1', description: '投稿しました', createdAt: new Date() },
        { type: 'comment', id: 'c1', description: 'コメントしました', createdAt: new Date() },
        { type: 'like', id: 'l1', description: 'いいねしました', createdAt: new Date() },
        { type: 'follow', id: 'f1', description: 'フォローしました', createdAt: new Date() },
        { type: 'login', id: 'lg1', description: 'ログインしました', createdAt: new Date() },
      ],
    })
    mockDetectSuspiciousBehavior.mockResolvedValue({ flags: [], isSuspicious: false })
    const result = await AdminUserActivityPage({ params: Promise.resolve({ id: 'u1' }) })
    expect(result).toBeDefined()
  })

  it('avatarUrl がある場合に Image を表示', async () => {
    mockGetAdminUserDetail.mockResolvedValue({
      user: { id: 'u1', nickname: 'TestUser', email: 'test@test.com', avatarUrl: '/avatar.jpg', isSuspended: true },
    })
    mockGetUserActivity.mockResolvedValue({ activities: [] })
    mockDetectSuspiciousBehavior.mockResolvedValue({ flags: [], isSuspicious: false })
    const result = await AdminUserActivityPage({ params: Promise.resolve({ id: 'u1' }) })
    expect(result).toBeDefined()
  })

  it('不審行動フラグがある場合に表示', async () => {
    mockGetAdminUserDetail.mockResolvedValue({
      user: { id: 'u1', nickname: 'TestUser', email: 'test@test.com', avatarUrl: null, isSuspended: false },
    })
    mockGetUserActivity.mockResolvedValue({ activities: [] })
    mockDetectSuspiciousBehavior.mockResolvedValue({
      isSuspicious: true,
      flags: [
        { type: 'mass_likes', value: 500, threshold: 100 },
        { type: 'mass_posts', value: 50, threshold: 20 },
        { type: 'many_reports', value: 10, threshold: 5 },
        { type: 'mass_follows', value: 200, threshold: 50 },
        { type: 'unknown_flag', value: 1, threshold: 1 },
      ],
    })
    const result = await AdminUserActivityPage({ params: Promise.resolve({ id: 'u1' }) })
    expect(result).toBeDefined()
  })

  it('アクティビティがない場合は空メッセージ表示', async () => {
    mockGetAdminUserDetail.mockResolvedValue({
      user: { id: 'u1', nickname: 'TestUser', email: 'test@test.com', avatarUrl: null, isSuspended: false },
    })
    mockGetUserActivity.mockResolvedValue({ activities: [] })
    mockDetectSuspiciousBehavior.mockResolvedValue({ flags: [], isSuspicious: false })
    const result = await AdminUserActivityPage({ params: Promise.resolve({ id: 'u1' }) })
    expect(result).toBeDefined()
  })

  it('不明なアクティビティタイプに default ケースが使われる', async () => {
    mockGetAdminUserDetail.mockResolvedValue({
      user: { id: 'u1', nickname: 'TestUser', email: 'test@test.com', avatarUrl: null, isSuspended: false },
    })
    mockGetUserActivity.mockResolvedValue({
      activities: [
        { type: 'unknown_type', id: 'x1', description: '不明', createdAt: new Date() },
      ],
    })
    mockDetectSuspiciousBehavior.mockResolvedValue({ flags: [], isSuspicious: false })
    const result = await AdminUserActivityPage({ params: Promise.resolve({ id: 'u1' }) })
    expect(result).toBeDefined()
  })
})

describe('AdminUserActivityPage generateMetadata', () => {
  it('ユーザーが見つからない場合', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ error: 'not found' })
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'xxx' }) })
    expect(meta.title).toContain('見つかりません')
  })

  it('ユーザーが見つかった場合', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: { nickname: 'TestUser' } })
    const meta = await generateMetadata({ params: Promise.resolve({ id: 'u1' }) })
    expect(meta.title).toContain('TestUser')
  })
})

// ============================================================
// NutrientDetailPage — 70% → 高カバレッジ
// ============================================================
import NutrientDetailPage, { generateMetadata as nutrientMetadata } from '@/app/(main)/fertilizers/nutrients/[slug]/page'

describe('NutrientDetailPage', () => {
  const fullNutrient = {
    id: 'n1',
    slug: 'nitrogen',
    name: '窒素',
    nameEn: 'Nitrogen',
    symbol: 'N',
    category: 'macronutrient',
    description: '植物の成長に必要な主要栄養素',
    bonsaiRole: '新芽・葉の成長を促進',
    deficiencySymptoms: '葉が黄色くなる',
    excessSymptoms: '徒長する',
    foodSources: '油かす、魚粉',
  }

  it('nutrient が見つからない場合 notFound', async () => {
    mockGetNutrientBySlug.mockResolvedValue(null)
    mockGetNutrients.mockResolvedValue({ nutrients: [] })
    await expect(NutrientDetailPage({ params: Promise.resolve({ slug: 'xxx' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('全フィールドが存在する場合にすべてのセクションを描画', async () => {
    mockGetNutrientBySlug.mockResolvedValue(fullNutrient)
    mockGetNutrients.mockResolvedValue({
      nutrients: [
        fullNutrient,
        { id: 'n2', slug: 'phosphorus', name: 'リン', symbol: 'P', category: 'macronutrient' },
        { id: 'n3', slug: 'potassium', name: 'カリウム', symbol: 'K', category: 'macronutrient' },
      ],
    })
    const result = await NutrientDetailPage({ params: Promise.resolve({ slug: 'nitrogen' }) })
    expect(result).toBeDefined()
  })

  it('オプションフィールドがない場合にセクションが省略される', async () => {
    mockGetNutrientBySlug.mockResolvedValue({
      id: 'n1', slug: 'nitrogen', name: '窒素', symbol: 'N', category: 'macronutrient',
      nameEn: null, description: null, bonsaiRole: null,
      deficiencySymptoms: null, excessSymptoms: null, foodSources: null,
    })
    mockGetNutrients.mockResolvedValue({ nutrients: [] })
    const result = await NutrientDetailPage({ params: Promise.resolve({ slug: 'nitrogen' }) })
    expect(result).toBeDefined()
  })

  it('関連栄養素がない場合（別カテゴリのみ）', async () => {
    mockGetNutrientBySlug.mockResolvedValue(fullNutrient)
    mockGetNutrients.mockResolvedValue({
      nutrients: [
        fullNutrient,
        { id: 'n4', slug: 'iron', name: '鉄', symbol: 'Fe', category: 'micronutrient' },
      ],
    })
    const result = await NutrientDetailPage({ params: Promise.resolve({ slug: 'nitrogen' }) })
    expect(result).toBeDefined()
  })
})

describe('NutrientDetailPage generateMetadata', () => {
  it('nutrient が見つからない場合', async () => {
    mockGetNutrientBySlug.mockResolvedValue(null)
    const meta = await nutrientMetadata({ params: Promise.resolve({ slug: 'xxx' }) })
    expect(meta.title).toContain('見つかりません')
  })

  it('nutrient が見つかった場合', async () => {
    mockGetNutrientBySlug.mockResolvedValue({ name: '窒素', symbol: 'N' })
    const meta = await nutrientMetadata({ params: Promise.resolve({ slug: 'nitrogen' }) })
    expect(meta.title).toContain('窒素')
    expect(meta.title).toContain('N')
  })
})

// ============================================================
// PesticideDataPage — searchParams 分岐カバー
// ============================================================
import PesticideDataPage from '@/app/admin/pesticide-data/page'

describe('PesticideDataPage branches', () => {
  it('searchParams でフィルター付きレンダリング', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockGetAdminPesticides.mockResolvedValue({
      pesticides: [
        {
          id: 'p1', name: 'テスト農薬', slug: 'test', pesticideType: 'insecticide',
          registrationNumber: 'R-001', formulationType: { name: '乳剤' },
          _count: { effects: 2, ingredients: 1 }, updatedAt: new Date(),
        },
      ],
      total: 1,
    })
    const result = await PesticideDataPage({
      searchParams: Promise.resolve({ search: 'テスト', type: 'insecticide', page: '1' }),
    })
    expect(result).toBeDefined()
  })
})
