// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({ checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }), RATE_LIMITS: {} }))
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }) }))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

describe('管理者分析アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
  })

  // ============================================================
  // getCohortAnalysis
  // ============================================================
  describe('getCohortAnalysis', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      expect(result).toHaveProperty('error')
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      expect(result).toHaveProperty('error')
    })

    it('ユーザーも投稿もない場合は空のコホートを返す', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      expect(result).toHaveProperty('cohorts')
      expect(result).toHaveProperty('retention')
      expect((result as { cohorts: unknown[] }).cohorts).toEqual([])
      expect((result as { retention: unknown[] }).retention).toEqual([])
    })

    it('ユーザーはいるが投稿がない場合はコホートのみ返す', async () => {
      const users = [
        { id: 'user-1', createdAt: new Date('2024-03-15') },
        { id: 'user-2', createdAt: new Date('2024-03-20') },
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue([])
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as { cohorts: { cohort: string; total: number }[]; retention: unknown[] }
      expect(data.cohorts.length).toBe(1) // 同月なので1コホート
      expect(data.cohorts[0].total).toBe(2)
      expect(data.retention).toEqual([])
    })

    it('ユーザーと投稿があればコホートとリテンションを返す', async () => {
      const users = [
        { id: 'user-1', createdAt: new Date('2024-01-10') },
        { id: 'user-2', createdAt: new Date('2024-02-05') },
      ]
      const posts = [
        { userId: 'user-1', createdAt: new Date('2024-01-15') },
        { userId: 'user-1', createdAt: new Date('2024-02-10') },
        { userId: 'user-2', createdAt: new Date('2024-02-20') },
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue(posts)
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as {
        cohorts: { cohort: string; total: number }[]
        retention: { cohort: string; activeMonth: string; activeUsers: number }[]
      }
      expect(data.cohorts.length).toBe(2)
      expect(data.cohorts[0].cohort).toBe('2024-01')
      expect(data.cohorts[0].total).toBe(1)
      expect(data.cohorts[1].cohort).toBe('2024-02')
      expect(data.cohorts[1].total).toBe(1)
      expect(data.retention.length).toBeGreaterThan(0)
    })

    it('monthlyがデフォルト期間として使用される', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      await getCohortAnalysis()
      const call = mockPrisma.user.findMany.mock.calls[0][0]
      expect(call.where.createdAt.gte).toBeInstanceOf(Date)
    })

    it('weekly期間を指定できる', async () => {
      const users = [
        { id: 'user-1', createdAt: new Date('2024-03-04') },
        { id: 'user-2', createdAt: new Date('2024-03-11') },
      ]
      const posts = [
        { userId: 'user-1', createdAt: new Date('2024-03-06') },
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue(posts)
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis({ period: 'weekly', months: 3 })
      const data = result as { cohorts: { cohort: string; total: number }[] }
      // weeklyの場合 YYYY-Wxx形式
      expect(data.cohorts.length).toBeGreaterThan(0)
      expect(data.cohorts[0].cohort).toMatch(/^\d{4}-W\d{2}$/)
    })

    it('monthsオプションで期間を変更できる', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      await getCohortAnalysis({ months: 12 })
      const call = mockPrisma.user.findMany.mock.calls[0][0]
      const startDate = call.where.createdAt.gte as Date
      const now = new Date()
      // 約12ヶ月前の日付であること
      const diffMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth())
      expect(diffMonths).toBe(12)
    })

    it('コホートは日付順でソートされる', async () => {
      const users = [
        { id: 'user-1', createdAt: new Date('2024-03-01') },
        { id: 'user-2', createdAt: new Date('2024-01-01') },
        { id: 'user-3', createdAt: new Date('2024-02-01') },
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue([])
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as { cohorts: { cohort: string }[] }
      expect(data.cohorts[0].cohort).toBe('2024-01')
      expect(data.cohorts[1].cohort).toBe('2024-02')
      expect(data.cohorts[2].cohort).toBe('2024-03')
    })

    it('リテンションはコホート・月順でソートされる', async () => {
      const users = [
        { id: 'user-1', createdAt: new Date('2024-01-10') },
      ]
      const posts = [
        { userId: 'user-1', createdAt: new Date('2024-02-10') },
        { userId: 'user-1', createdAt: new Date('2024-01-15') },
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue(posts)
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as { retention: { activeMonth: string }[] }
      expect(data.retention[0].activeMonth).toBe('2024-01')
      expect(data.retention[1].activeMonth).toBe('2024-02')
    })

    it('同一コホート・同一月の重複ユーザーはカウントしない', async () => {
      const users = [
        { id: 'user-1', createdAt: new Date('2024-01-10') },
      ]
      const posts = [
        { userId: 'user-1', createdAt: new Date('2024-01-15') },
        { userId: 'user-1', createdAt: new Date('2024-01-20') },
        { userId: 'user-1', createdAt: new Date('2024-01-25') },
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue(posts)
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as { retention: { activeUsers: number }[] }
      expect(data.retention.length).toBe(1)
      expect(data.retention[0].activeUsers).toBe(1)
    })

    it('userCohort に存在しない投稿のユーザーは無視される（防御的フォールバック）', async () => {
      // ユーザーは user-1 のみだが、posts に未知の user-X が混じる
      // （データ不整合の防御パス: `if (!cohort) continue`）
      const users = [
        { id: 'user-1', createdAt: new Date('2024-01-10') },
      ]
      const posts = [
        { userId: 'user-1', createdAt: new Date('2024-01-15') },
        { userId: 'user-X', createdAt: new Date('2024-01-20') }, // 未知ユーザー
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue(posts)
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as { retention: { cohort: string; activeUsers: number }[] }
      // 結果は user-1 のみカウントされ、 user-X は黙って捨てられる
      expect(data.retention).toHaveLength(1)
      expect(data.retention[0].activeUsers).toBe(1)
      expect(data.retention[0].cohort).toBe('2024-01')
    })

    it('同一コホートに複数ユーザーがいる場合 cohortMap.size が正しく集計される', async () => {
      // リファクタで cohortMap.get(key)! → 新規 Set 注入の if-else に変わったので、
      // 「複数ユーザーが同一キーに集まる」ことを明示的に検証する
      const users = [
        { id: 'user-1', createdAt: new Date('2024-01-05') },
        { id: 'user-2', createdAt: new Date('2024-01-15') },
        { id: 'user-3', createdAt: new Date('2024-01-25') },
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue([])
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as { cohorts: { cohort: string; total: number }[] }
      expect(data.cohorts).toEqual([
        { cohort: '2024-01', total: 3 },
      ])
    })

    it('同一コホート・複数アクティブ月のリテンションが正しく集計される', async () => {
      // retentionMap の二段ネストが正しく働くことを検証
      const users = [
        { id: 'user-1', createdAt: new Date('2024-01-10') },
        { id: 'user-2', createdAt: new Date('2024-01-20') },
      ]
      const posts = [
        { userId: 'user-1', createdAt: new Date('2024-01-15') }, // cohort 01 / active 01
        { userId: 'user-2', createdAt: new Date('2024-01-22') }, // cohort 01 / active 01
        { userId: 'user-1', createdAt: new Date('2024-02-05') }, // cohort 01 / active 02
        { userId: 'user-2', createdAt: new Date('2024-03-01') }, // cohort 01 / active 03
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue(posts)
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as {
        retention: { cohort: string; activeMonth: string; activeUsers: number }[]
      }
      expect(data.retention).toEqual([
        { cohort: '2024-01', activeMonth: '2024-01', activeUsers: 2 },
        { cohort: '2024-01', activeMonth: '2024-02', activeUsers: 1 },
        { cohort: '2024-01', activeMonth: '2024-03', activeUsers: 1 },
      ])
    })

    it('Prisma が例外を投げた場合は ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('DB outage'))
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      expect(result).toHaveProperty('error')
      expect((result as { error: string }).error).toBe('操作に失敗しました')
    })
  })

  // ============================================================
  // getContentAnalysis
  // ============================================================
  describe('getContentAnalysis', () => {
    const setupEmptyMocks = () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([])
      mockPrisma.genre.findMany.mockResolvedValue([])
      mockPrisma.postHashtag.groupBy.mockResolvedValue([])
      mockPrisma.hashtag.findMany.mockResolvedValue([])
      // 日別エンゲージメント: $queryRaw で DATE() 集約に変更済み
      mockPrisma.$queryRaw.mockResolvedValue([])
    }

    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      expect(result).toHaveProperty('error')
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      expect(result).toHaveProperty('error')
    })

    it('データがない場合は空の結果を返す', async () => {
      setupEmptyMocks()
      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as {
        genreTrends: unknown[]
        topHashtags: unknown[]
        dailyEngagement: unknown[]
      }
      expect(data.genreTrends).toEqual([])
      expect(data.topHashtags).toEqual([])
      // 31日分（0〜30日前）
      expect(data.dailyEngagement.length).toBe(31)
    })

    it('ジャンルトレンドが正しく返される', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([
        { genreId: 'g1', _count: { postId: 50 } },
        { genreId: 'g2', _count: { postId: 30 } },
      ])
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'g1', name: '黒松' },
        { id: 'g2', name: '五葉松' },
      ])
      mockPrisma.postHashtag.groupBy.mockResolvedValue([])
      mockPrisma.hashtag.findMany.mockResolvedValue([])
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { genreTrends: { name: string; count: number }[] }
      expect(data.genreTrends).toEqual([
        { name: '黒松', count: 50 },
        { name: '五葉松', count: 30 },
      ])
    })

    it('不明なジャンルIDは「不明」と表示される', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([
        { genreId: 'unknown-id', _count: { postId: 10 } },
      ])
      mockPrisma.genre.findMany.mockResolvedValue([])
      mockPrisma.postHashtag.groupBy.mockResolvedValue([])
      mockPrisma.hashtag.findMany.mockResolvedValue([])
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { genreTrends: { name: string }[] }
      expect(data.genreTrends[0].name).toBe('不明')
    })

    it('ハッシュタグトレンドが正しく返される', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([])
      mockPrisma.genre.findMany.mockResolvedValue([])
      mockPrisma.postHashtag.groupBy.mockResolvedValue([
        { hashtagId: 'h1', _count: { postId: 100 } },
        { hashtagId: 'h2', _count: { postId: 40 } },
      ])
      mockPrisma.hashtag.findMany.mockResolvedValue([
        { id: 'h1', name: '盆栽' },
        { id: 'h2', name: '松' },
      ])
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { topHashtags: { tag: string; count: number }[] }
      expect(data.topHashtags).toEqual([
        { tag: '盆栽', count: 100 },
        { tag: '松', count: 40 },
      ])
    })

    it('不明なハッシュタグIDは「不明」と表示される', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([])
      mockPrisma.genre.findMany.mockResolvedValue([])
      mockPrisma.postHashtag.groupBy.mockResolvedValue([
        { hashtagId: 'missing-id', _count: { postId: 5 } },
      ])
      mockPrisma.hashtag.findMany.mockResolvedValue([])
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { topHashtags: { tag: string }[] }
      expect(data.topHashtags[0].tag).toBe('不明')
    })

    it('日別エンゲージメントが31日分生成される', async () => {
      setupEmptyMocks()
      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { dailyEngagement: { date: string; posts: number; likes: number; comments: number }[] }
      expect(data.dailyEngagement.length).toBe(31)
      // 全てゼロ
      for (const day of data.dailyEngagement) {
        expect(day.posts).toBe(0)
        expect(day.likes).toBe(0)
        expect(day.comments).toBe(0)
      }
    })

    it('日別エンゲージメントに投稿・いいね・コメントが集計される', async () => {
      const today = new Date()
      const todayKey = today.toISOString().split('T')[0]

      mockPrisma.postGenre.groupBy.mockResolvedValue([])
      mockPrisma.genre.findMany.mockResolvedValue([])
      mockPrisma.postHashtag.groupBy.mockResolvedValue([])
      mockPrisma.hashtag.findMany.mockResolvedValue([])
      // $queryRaw は Promise.all で posts, likes, comments の順に3回呼ばれる
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ date: new Date(todayKey), count: BigInt(5) }])
        .mockResolvedValueOnce([{ date: new Date(todayKey), count: BigInt(12) }])
        .mockResolvedValueOnce([{ date: new Date(todayKey), count: BigInt(3) }])

      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { dailyEngagement: { date: string; posts: number; likes: number; comments: number }[] }
      const todayEntry = data.dailyEngagement.find(d => d.date === todayKey)
      expect(todayEntry).toBeDefined()
      expect(todayEntry!.posts).toBe(5)
      expect(todayEntry!.likes).toBe(12)
      expect(todayEntry!.comments).toBe(3)
    })

    it('日別エンゲージメントの日付はYYYY-MM-DD形式', async () => {
      setupEmptyMocks()
      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { dailyEngagement: { date: string }[] }
      for (const day of data.dailyEngagement) {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })

    it('過去30日のフィルタが適用される', async () => {
      setupEmptyMocks()
      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      await getContentAnalysis()
      const call = mockPrisma.postGenre.groupBy.mock.calls[0][0]
      expect(call.where.post.createdAt.gte).toBeInstanceOf(Date)
      const daysDiff = (Date.now() - call.where.post.createdAt.gte.getTime()) / (1000 * 60 * 60 * 24)
      expect(daysDiff).toBeCloseTo(30, 0)
    })
  })

  // ============================================================
  // exportAnalyticsCSV
  // ============================================================
  describe('exportAnalyticsCSV', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('users')
      expect(result).toHaveProperty('error')
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('users')
      expect(result).toHaveProperty('error')
    })

    it('usersタイプのCSVエクスポートが正しく返される', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          nickname: 'ユーザー1',
          email: 'user1@example.com',
          createdAt: new Date('2024-01-15T00:00:00.000Z'),
          isPremium: false,
          isSuspended: false,
          _count: { posts: 10, followers: 5, following: 3 },
        },
        {
          id: 'user-2',
          nickname: 'ユーザー2',
          email: 'user2@example.com',
          createdAt: new Date('2024-02-20T00:00:00.000Z'),
          isPremium: true,
          isSuspended: false,
          _count: { posts: 25, followers: 100, following: 50 },
        },
      ]
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)

      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('users')
      const data = result as { csv: string; filename: string }

      expect(data.csv).toBeDefined()
      expect(data.filename).toMatch(/^users_\d{4}-\d{2}-\d{2}\.csv$/)

      const lines = data.csv.split('\n')
      // ヘッダー + 2データ行
      expect(lines.length).toBe(3)
      expect(lines[0]).toBe('ID,ニックネーム,メール,登録日,プレミアム,停止,投稿数,フォロワー数,フォロー数')
      expect(lines[1]).toContain('user-1')
      expect(lines[1]).toContain('ユーザー1')
      expect(lines[2]).toContain('user-2')
      expect(lines[2]).toContain('true')
    })

    it('ユーザーがない場合はヘッダーのみ返す', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('users')
      const data = result as { csv: string; filename: string }
      const lines = data.csv.split('\n')
      expect(lines.length).toBe(1) // ヘッダーのみ
      expect(lines[0]).toContain('ID')
    })

    it('未対応のエクスポートタイプはエラーを返す', async () => {
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('cohort')
      expect(result).toEqual({ success: false, error: '未対応のエクスポートタイプです' })
    })

    it('contentタイプも未対応エラーを返す', async () => {
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('content')
      expect(result).toEqual({ success: false, error: '未対応のエクスポートタイプです' })
    })

    it('CSVデータの行数が最大5000件に制限される', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      await exportAnalyticsCSV('users')
      const call = mockPrisma.user.findMany.mock.calls[0][0]
      expect(call.take).toBe(5000)
    })

    it('CSVデータは作成日降順でソートされる', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      await exportAnalyticsCSV('users')
      const call = mockPrisma.user.findMany.mock.calls[0][0]
      expect(call.orderBy).toEqual({ createdAt: 'desc' })
    })
  })

  // ============================================================
  // 品質向上テスト: データ変換精度
  // ============================================================
  describe('データ変換精度', () => {
    it('getCohortAnalysisの戻り値でcohortキーがYYYY-MM形式である', async () => {
      const users = [
        { id: 'u1', createdAt: new Date('2024-06-15') },
        { id: 'u2', createdAt: new Date('2024-11-03') },
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue([])
      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as { cohorts: { cohort: string }[] }
      for (const c of data.cohorts) {
        expect(c.cohort).toMatch(/^\d{4}-\d{2}$/)
      }
    })

    it('getContentAnalysisのgenreTrendsが降順ソートされている', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([
        { genreId: 'g1', _count: { postId: 80 } },
        { genreId: 'g2', _count: { postId: 50 } },
        { genreId: 'g3', _count: { postId: 20 } },
      ])
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'g1', name: '黒松' },
        { id: 'g2', name: '五葉松' },
        { id: 'g3', name: '真柏' },
      ])
      mockPrisma.postHashtag.groupBy.mockResolvedValue([])
      mockPrisma.hashtag.findMany.mockResolvedValue([])
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { genreTrends: { count: number }[] }
      for (let i = 1; i < data.genreTrends.length; i++) {
        expect(data.genreTrends[i - 1].count).toBeGreaterThanOrEqual(data.genreTrends[i].count)
      }
    })

    it('dailyEngagementが30日分+今日=31エントリである', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([])
      mockPrisma.genre.findMany.mockResolvedValue([])
      mockPrisma.postHashtag.groupBy.mockResolvedValue([])
      mockPrisma.hashtag.findMany.mockResolvedValue([])
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { dailyEngagement: { date: string }[] }
      expect(data.dailyEngagement.length).toBe(31)
      // 最初のエントリは30日前、最後のエントリは今日
      const today = new Date().toISOString().split('T')[0]
      expect(data.dailyEngagement[data.dailyEngagement.length - 1].date).toBe(today)
    })
  })

  // ============================================================
  // 品質向上テスト: CSVエクスポートデータ精度
  // ============================================================
  describe('CSVエクスポートデータ精度', () => {
    it('CSVヘッダーが正しい日本語列名を持つ', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('users')
      const data = result as { csv: string }
      const header = data.csv.split('\n')[0]
      expect(header).toBe('ID,ニックネーム,メール,登録日,プレミアム,停止,投稿数,フォロワー数,フォロー数')
    })

    it('CSVの行数がユーザー数+1(ヘッダー)である', async () => {
      const mockUsers = Array.from({ length: 5 }, (_, i) => ({
        id: `user-${i}`,
        nickname: `ユーザー${i}`,
        email: `user${i}@example.com`,
        createdAt: new Date('2024-01-01'),
        isPremium: false,
        isSuspended: false,
        _count: { posts: 0, followers: 0, following: 0 },
      }))
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)

      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('users')
      const data = result as { csv: string }
      const lines = data.csv.split('\n')
      expect(lines.length).toBe(6) // 1 header + 5 data rows
    })

    it('CSVにプレミアム/停止状態が正しく含まれる', async () => {
      const mockUsers = [
        {
          id: 'premium-user',
          nickname: 'プレミアム',
          email: 'premium@example.com',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          isPremium: true,
          isSuspended: false,
          _count: { posts: 10, followers: 5, following: 3 },
        },
        {
          id: 'suspended-user',
          nickname: '停止済み',
          email: 'suspended@example.com',
          createdAt: new Date('2024-02-01T00:00:00.000Z'),
          isPremium: false,
          isSuspended: true,
          _count: { posts: 2, followers: 1, following: 0 },
        },
      ]
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)

      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('users')
      const data = result as { csv: string }
      const lines = data.csv.split('\n')
      // プレミアムユーザーの行: isPremium=true, isSuspended=false
      expect(lines[1]).toContain('true,false')
      // 停止ユーザーの行: isPremium=false, isSuspended=true
      expect(lines[2]).toContain('false,true')
    })

    it('特殊文字(カンマ)を含むニックネームがCSVに直接含まれる', async () => {
      const mockUsers = [
        {
          id: 'special-user',
          nickname: '盆栽,太郎',
          email: 'special@example.com',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          isPremium: false,
          isSuspended: false,
          _count: { posts: 0, followers: 0, following: 0 },
        },
      ]
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)

      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('users')
      const data = result as { csv: string }
      // カンマを含むニックネームがCSVに含まれていることを確認
      // (注: 現在の実装はCSVエスケープなしで直接埋め込み)
      expect(data.csv).toContain('盆栽,太郎')
    })

    it('未対応のexportタイプ "cohort" でエラーが返る', async () => {
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('cohort')
      expect(result).toHaveProperty('error')
      expect((result as { error: string }).error).toContain('未対応')
    })

    it('未対応のexportタイプ "content" でエラーが返る', async () => {
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('content')
      expect(result).toHaveProperty('error')
      expect((result as { error: string }).error).toContain('未対応')
    })
  })

  // ============================================================
  // 品質向上テスト: エッジケース
  // ============================================================
  describe('エッジケース', () => {
    it('投稿0件のユーザーのコホート分析でリテンションが空', async () => {
      const users = [
        { id: 'inactive-1', createdAt: new Date('2024-03-01') },
        { id: 'inactive-2', createdAt: new Date('2024-04-01') },
        { id: 'inactive-3', createdAt: new Date('2024-04-15') },
      ]
      mockPrisma.user.findMany.mockResolvedValue(users)
      mockPrisma.post.findMany.mockResolvedValue([])

      const { getCohortAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getCohortAnalysis()
      const data = result as {
        cohorts: { cohort: string; total: number }[]
        retention: unknown[]
      }
      // コホートは存在するがリテンションは空
      expect(data.cohorts.length).toBe(2)
      expect(data.cohorts[0].total).toBe(1) // 2024-03: 1人
      expect(data.cohorts[1].total).toBe(2) // 2024-04: 2人
      expect(data.retention).toEqual([])
    })

    it('ハッシュタグ0件の場合のコンテンツ分析でtopHashtagsが空', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([
        { genreId: 'g1', _count: { postId: 10 } },
      ])
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'g1', name: '黒松' },
      ])
      mockPrisma.postHashtag.groupBy.mockResolvedValue([])
      mockPrisma.hashtag.findMany.mockResolvedValue([])
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { getContentAnalysis } = await import('@/lib/actions/admin/analytics')
      const result = await getContentAnalysis()
      const data = result as { topHashtags: unknown[]; genreTrends: { name: string }[] }
      expect(data.topHashtags).toEqual([])
      expect(data.genreTrends.length).toBe(1)
      expect(data.genreTrends[0].name).toBe('黒松')
    })

    it('CSVのファイル名が今日の日付を含む', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      const { exportAnalyticsCSV } = await import('@/lib/actions/admin/analytics')
      const result = await exportAnalyticsCSV('users')
      const data = result as { filename: string }
      const today = new Date().toISOString().split('T')[0]
      expect(data.filename).toBe(`users_${today}.csv`)
    })
  })
})
