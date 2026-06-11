/**
 * Admin Client Components tests
 *
 * Tests for admin panel client components that have 0% coverage.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'

// ============================================================
// Mock dependencies
// ============================================================

// Admin action mocks
vi.mock('@/lib/actions/admin/announcements', () => ({
  createAnnouncement: vi.fn().mockResolvedValue({ success: true }),
  updateAnnouncement: vi.fn().mockResolvedValue({ success: true }),
  deleteAnnouncement: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/admin/moderation', () => ({
  createNgWord: vi.fn().mockResolvedValue({ success: true }),
  deleteNgWord: vi.fn().mockResolvedValue({ success: true }),
  toggleNgWord: vi.fn().mockResolvedValue({ success: true }),
  reviewModerationItem: vi.fn().mockResolvedValue({ success: true }),
  bulkReviewModeration: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/admin/warnings', () => ({
  deactivateWarning: vi.fn().mockResolvedValue({ success: true }),
  issueWarning: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/admin/roles', () => ({
  updateAdminRole: vi.fn().mockResolvedValue({ success: true }),
  removeAdmin: vi.fn().mockResolvedValue({ success: true }),
  addAdmin: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/admin/segments', () => ({
  createSegment: vi.fn().mockResolvedValue({ success: true }),
  deleteSegment: vi.fn().mockResolvedValue({ success: true }),
  evaluateSegment: vi.fn().mockResolvedValue({ count: 42 }),
}))

vi.mock('@/lib/actions/admin/cms', () => ({
  createCmsPage: vi.fn().mockResolvedValue({ success: true }),
  updateCmsPage: vi.fn().mockResolvedValue({ success: true }),
  deleteCmsPage: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/admin/pesticide-data', () => ({
  deletePesticide: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/admin/premium', () => ({
  searchUserForPremium: vi.fn().mockResolvedValue({ users: [] }),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/lib/admin-permissions', () => ({
  ROLE_LABELS: {
    super_admin: 'Super Admin',
    admin: 'Admin',
    moderator: 'Moderator',
    support: 'Support',
    readonly: 'Read Only',
  },
}))

// Mock IssueWarningDialog since it's a separate component
vi.mock('@/app/admin/warnings/IssueWarningDialog', () => ({
  IssueWarningDialog: ({ isOpen }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? <div data-testid="warning-dialog">Warning Dialog</div> : null,
}))

// ============================================================
// Import components
// ============================================================
import { AnnouncementList } from '@/app/admin/announcements/AnnouncementList'
import { NgWordList } from '@/app/admin/ng-words/NgWordList'
import { ModerationQueueList } from '@/app/admin/moderation-queue/ModerationQueueList'
import { WarningsList } from '@/app/admin/warnings/WarningsList'
import RolesTable from '@/app/admin/roles/RolesTable'
import { SegmentBuilder } from '@/app/admin/segments/SegmentBuilder'
import { SecurityEventList } from '@/app/admin/security/SecurityEventList'
import { IpManagementClient } from '@/app/admin/ip-management/IpManagementClient'
import { CmsPageList } from '@/app/admin/content-management/CmsPageList'
import { PesticideTable } from '@/app/admin/pesticide-data/PesticideTable'

// ============================================================
// AnnouncementList
// ============================================================
describe('AnnouncementList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state', () => {
    render(<AnnouncementList announcements={[]} />)
    expect(screen.getByText('お知らせがありません')).toBeInTheDocument()
  })

  it('renders announcements with correct data', () => {
    const announcements = [
      {
        id: '1',
        title: 'テストお知らせ',
        content: '内容',
        type: 'banner' as const,
        isActive: true,
        startsAt: '2025-01-01T00:00:00Z',
        endsAt: '2025-12-31T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: '2',
        title: '通知テスト',
        content: '内容2',
        type: 'notification' as const,
        isActive: false,
        startsAt: '2025-01-01T00:00:00Z',
        endsAt: null,
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: '3',
        title: '両方テスト',
        content: '内容3',
        type: 'both' as const,
        isActive: true,
        startsAt: '2025-01-01T00:00:00Z',
        endsAt: null,
        createdAt: '2025-01-01T00:00:00Z',
      },
    ]
    render(<AnnouncementList announcements={announcements} />)
    expect(screen.getByText('テストお知らせ')).toBeInTheDocument()
    expect(screen.getByText('通知テスト')).toBeInTheDocument()
    expect(screen.getByText('バナー')).toBeInTheDocument()
    expect(screen.getByText('通知')).toBeInTheDocument()
    expect(screen.getByText('両方')).toBeInTheDocument()
    // Check active/inactive badges
    expect(screen.getAllByText('有効').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('無効')).toBeInTheDocument()
  })

  it('shows create form button', () => {
    render(<AnnouncementList announcements={[]} />)
    expect(screen.getByText('新規作成')).toBeInTheDocument()
  })
})

// ============================================================
// NgWordList
// ============================================================
describe('NgWordList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state', () => {
    render(
      <NgWordList
        words={[]}
        search=""
        category=""
      />
    )
    expect(screen.getByText('NGワードが見つかりません')).toBeInTheDocument()
  })

  it('renders words with categories', () => {
    const words = [
      {
        id: '1',
        word: 'bad-word',
        category: 'spam',
        isRegex: false,
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: '2',
        word: 'regex-pattern',
        category: 'harassment',
        isRegex: true,
        isActive: false,
        createdAt: '2025-01-01T00:00:00Z',
      },
    ]
    render(
      <NgWordList
        words={words}
        search=""
        category=""
      />
    )
    expect(screen.getByText('bad-word')).toBeInTheDocument()
    expect(screen.getByText('regex-pattern')).toBeInTheDocument()
    // Category labels appear in both the table and the filter dropdown
    expect(screen.getAllByText('スパム').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('ハラスメント').length).toBeGreaterThanOrEqual(1)
  })

  // NOTE: pagination UI は NgWordList から親ページの CursorPagination に移動したため、
  // 旧 total/page ベース skip テストは削除済み。

  it('shows add form elements', () => {
    render(
      <NgWordList
        words={[]}
        search=""
        category=""
      />
    )
    expect(screen.getByText('NGワードを追加')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('NGワードを入力')).toBeInTheDocument()
  })
})

// ============================================================
// ModerationQueueList
// ============================================================
describe('ModerationQueueList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state', () => {
    render(
      <ModerationQueueList
        items={[]}
      />
    )
    expect(screen.getByText('モデレーション対象が見つかりません')).toBeInTheDocument()
  })

  it('renders items with status badges', () => {
    const items = [
      {
        id: '1',
        targetType: 'post',
        targetId: 'post-1',
        status: 'pending',
        reason: 'スパム検出',
        matchedWords: ['スパム'],
        reviewedBy: null,
        reviewedAt: null,
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: '2',
        targetType: 'comment',
        targetId: 'comment-1',
        status: 'approved',
        reason: '手動確認',
        matchedWords: [],
        reviewedBy: 'admin-1',
        reviewedAt: '2025-01-02T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
      },
    ]
    render(
      <ModerationQueueList
        items={items}
      />
    )
    expect(screen.getByText('未対応')).toBeInTheDocument()
    expect(screen.getByText('承認済み')).toBeInTheDocument()
    expect(screen.getByText('スパム検出')).toBeInTheDocument()
    // Pending items should have approve/reject buttons
    expect(screen.getByText('承認')).toBeInTheDocument()
    expect(screen.getByText('却下')).toBeInTheDocument()
  })

  // NOTE: pagination UI は ModerationQueueList から親ページの CursorPagination へ移動したため、
  // 旧 totalPages/currentPage ベース skip テストは削除済み。

  it('renders target type labels correctly', () => {
    const items = [
      {
        id: '1',
        targetType: 'event',
        targetId: 'event-1',
        status: 'auto_flagged',
        reason: '自動検出',
        matchedWords: ['word1', 'word2'],
        reviewedBy: null,
        reviewedAt: null,
        createdAt: '2025-01-01T00:00:00Z',
      },
    ]
    render(
      <ModerationQueueList
        items={items}
      />
    )
    expect(screen.getByText('イベント')).toBeInTheDocument()
    expect(screen.getByText('word1')).toBeInTheDocument()
    expect(screen.getByText('word2')).toBeInTheDocument()
  })
})

// ============================================================
// WarningsList
// ============================================================
describe('WarningsList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state', () => {
    render(
      <WarningsList
        warnings={[]}
        total={0}
        activeWarnings={0}
        levelCounts={{}}
      />
    )
    expect(screen.getByText('警告が見つかりません')).toBeInTheDocument()
    expect(screen.getByText('警告管理')).toBeInTheDocument()
  })

  it('renders warnings with user info', () => {
    const warnings = [
      {
        id: 'w1',
        userId: 'u1',
        level: 'notice',
        reason: 'テスト理由',
        isActive: true,
        expiresAt: '2025-12-31T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
        user: {
          id: 'u1',
          nickname: 'テストユーザー',
          email: 'test@example.com',
          avatarUrl: null,
        },
      },
      {
        id: 'w2',
        userId: 'u2',
        level: 'permanent_ban',
        reason: '重大な違反',
        isActive: false,
        expiresAt: null,
        createdAt: '2025-01-01T00:00:00Z',
        user: {
          id: 'u2',
          nickname: 'ユーザー2',
          email: 'user2@example.com',
          avatarUrl: '/avatar.jpg',
        },
      },
    ]
    render(
      <WarningsList
        warnings={warnings}
        total={2}
        activeWarnings={1}
        levelCounts={{ notice: 1, permanent_ban: 1 }}
      />
    )
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    // "注意" appears multiple times (in table + filter dropdown)
    expect(screen.getAllByText('注意').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('永久BAN').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('テスト理由')).toBeInTheDocument()
    expect(screen.getByText('警告を発行')).toBeInTheDocument()
  })

  it('renders stats cards with correct counts', () => {
    render(
      <WarningsList
        warnings={[]}
        total={10}
        activeWarnings={3}
        levelCounts={{ notice: 2, warning: 3, temp_suspend: 1, permanent_ban: 4 }}
      />
    )
    expect(screen.getByText('総警告数')).toBeInTheDocument()
    expect(screen.getByText('有効な警告')).toBeInTheDocument()
  })
})

// ============================================================
// RolesTable
// ============================================================
describe('RolesTable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state', () => {
    render(<RolesTable admins={[]} />)
    expect(screen.getByText('管理者がいません')).toBeInTheDocument()
  })

  it('renders admin users with roles', () => {
    const admins = [
      {
        userId: 'u1',
        role: 'admin' as const,
        createdAt: '2025-01-01T00:00:00Z',
        user: {
          id: 'u1',
          nickname: '管理者ユーザー',
          email: 'admin@example.com',
          avatarUrl: null,
        },
      },
      {
        userId: 'u2',
        role: 'moderator' as const,
        createdAt: '2025-01-01T00:00:00Z',
        user: {
          id: 'u2',
          nickname: 'モデレーター',
          email: 'mod@example.com',
          avatarUrl: '/avatar.jpg',
        },
      },
    ]
    render(<RolesTable admins={admins} />)
    expect(screen.getByText('管理者ユーザー')).toBeInTheDocument()
    // 'モデレーター' appears in both the badge and role select dropdowns
    expect(screen.getAllByText('モデレーター').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
  })

  it('renders add admin form', () => {
    render(<RolesTable admins={[]} />)
    expect(screen.getByText('管理者を追加')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('ユーザーID')).toBeInTheDocument()
  })
})

// ============================================================
// SegmentBuilder
// ============================================================
describe('SegmentBuilder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state', () => {
    render(
      <SegmentBuilder
        segments={[]}
      />
    )
    expect(screen.getByText('セグメントがありません')).toBeInTheDocument()
    expect(screen.getByText('セグメント一覧')).toBeInTheDocument()
  })

  it('renders segments with rule counts', () => {
    const segments = [
      {
        id: 's1',
        name: 'アクティブユーザー',
        description: '毎月投稿するユーザー',
        conditions: { rules: [{ field: 'postCount', operator: 'gte', value: 10 }], logic: 'AND' },
        createdAt: new Date('2025-01-01'),
        createdBy: 'admin-1',
      },
      {
        id: 's2',
        name: '新規ユーザー',
        description: null,
        conditions: { rules: [], logic: 'AND' },
        createdAt: new Date('2025-02-01'),
        createdBy: null,
      },
    ]
    render(
      <SegmentBuilder
        segments={segments}
      />
    )
    expect(screen.getByText('アクティブユーザー')).toBeInTheDocument()
    expect(screen.getByText('毎月投稿するユーザー')).toBeInTheDocument()
    expect(screen.getByText('新規ユーザー')).toBeInTheDocument()
    expect(screen.getByText('(2件)')).toBeInTheDocument()
  })

  it('renders create button', () => {
    render(
      <SegmentBuilder segments={[]} />
    )
    expect(screen.getByText('セグメント作成')).toBeInTheDocument()
  })
})

// ============================================================
// SecurityEventList
// ============================================================
describe('SecurityEventList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state', () => {
    render(
      <SecurityEventList
        events={[]}
        eventType=""
        ipAddress=""
        dateFrom=""
        dateTo=""
      />
    )
    expect(screen.getByText('該当するイベントはありません')).toBeInTheDocument()
    expect(screen.getByText('セキュリティイベントログ')).toBeInTheDocument()
  })

  it('renders events with types', () => {
    const events = [
      {
        id: 'e1',
        eventType: 'failed_login',
        userId: 'user-123456789012',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: null,
        createdAt: '2025-01-01T12:00:00Z',
      },
      {
        id: 'e2',
        eventType: 'password_change',
        userId: null,
        ipAddress: null,
        userAgent: null,
        details: null,
        createdAt: '2025-01-02T12:00:00Z',
      },
    ]
    render(
      <SecurityEventList
        events={events}
        eventType=""
        ipAddress=""
        dateFrom=""
        dateTo=""
      />
    )
    // Event type labels appear in both the table and the filter dropdown
    expect(screen.getAllByText('ログイン失敗').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('パスワード変更').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('192.168.1.1')).toBeInTheDocument()
  })

  it('renders filter controls', () => {
    render(
      <SecurityEventList
        events={[]}
        eventType=""
        ipAddress=""
        dateFrom=""
        dateTo=""
      />
    )
    expect(screen.getByPlaceholderText('IPアドレスで検索')).toBeInTheDocument()
    expect(screen.getByText('リセット')).toBeInTheDocument()
  })
})

// ============================================================
// IpManagementClient
// ============================================================
describe('IpManagementClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty device list', () => {
    render(
      <IpManagementClient
        devices={[]}
        total={0}
        suspiciousIps={[]}
        search=""
      />
    )
    expect(screen.getByText('データがありません')).toBeInTheDocument()
    expect(screen.getByText('IPアドレス一覧')).toBeInTheDocument()
  })

  it('renders devices with user info', () => {
    const devices = [
      {
        id: 'd1',
        ipAddress: '10.0.0.1',
        userId: 'u1',
        userAgent: 'Chrome',
        lastSeenAt: new Date('2025-01-01'),
        user: {
          id: 'u1',
          nickname: 'テストユーザー',
          email: 'test@example.com',
          avatarUrl: null,
          isSuspended: false,
        },
      },
      {
        id: 'd2',
        ipAddress: null,
        userId: 'u2',
        userAgent: null,
        lastSeenAt: new Date('2025-01-02'),
        user: null,
      },
    ]
    render(
      <IpManagementClient
        devices={devices}
        total={2}
        suspiciousIps={[]}
        search=""
      />
    )
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    // null ipAddress renders as '不明'
    expect(screen.getAllByText('不明').length).toBeGreaterThanOrEqual(1)
  })

  it('renders suspicious IPs section', () => {
    const suspiciousIps = [
      {
        ipAddress: '192.168.1.100',
        userCount: 3,
        users: [
          {
            id: 'u1',
            nickname: 'ユーザー1',
            email: 'u1@test.com',
            avatarUrl: null,
            isSuspended: false,
            createdAt: new Date('2025-01-01'),
          },
          {
            id: 'u2',
            nickname: 'ユーザー2',
            email: 'u2@test.com',
            avatarUrl: '/avatar.jpg',
            isSuspended: true,
            createdAt: new Date('2025-01-01'),
          },
        ],
      },
    ]
    render(
      <IpManagementClient
        devices={[]}
        total={0}
        suspiciousIps={suspiciousIps}
        search=""
      />
    )
    expect(screen.getByText('複数アカウント検出')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.100')).toBeInTheDocument()
    expect(screen.getByText('3アカウント')).toBeInTheDocument()
    expect(screen.getByText('ユーザー1')).toBeInTheDocument()
    expect(screen.getByText('停止中')).toBeInTheDocument()
  })
})

// ============================================================
// CmsPageList
// ============================================================
describe('CmsPageList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state', () => {
    render(
      <CmsPageList pages={[]} total={0} currentCategory="" />
    )
    expect(screen.getByText('ページがありません')).toBeInTheDocument()
  })

  it('renders pages with category badges', () => {
    const pages = [
      {
        id: 'p1',
        slug: 'how-to-use',
        title: '使い方ガイド',
        content: '内容',
        category: 'help',
        version: 1,
        isPublished: true,
        publishedAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'p2',
        slug: 'terms',
        title: '利用規約',
        content: '規約内容',
        category: 'terms',
        version: 2,
        isPublished: false,
        publishedAt: null,
        updatedAt: '2025-02-01T00:00:00Z',
        createdAt: '2025-01-01T00:00:00Z',
      },
    ]
    render(
      <CmsPageList pages={pages} total={2} currentCategory="" />
    )
    expect(screen.getByText('使い方ガイド')).toBeInTheDocument()
    // '利用規約' appears in both table and filter buttons
    expect(screen.getAllByText('利用規約').length).toBeGreaterThanOrEqual(1)
    // 'ヘルプ' appears in table badge + filter buttons + create form
    expect(screen.getAllByText('ヘルプ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('公開中')).toBeInTheDocument()
    expect(screen.getByText('下書き')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('renders category filter buttons', () => {
    render(
      <CmsPageList pages={[]} total={0} currentCategory="" />
    )
    expect(screen.getByText('すべて')).toBeInTheDocument()
    // The filter buttons use categoryLabels
    expect(screen.getAllByText('ヘルプ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('FAQ').length).toBeGreaterThanOrEqual(1)
  })

  it('renders create button', () => {
    render(
      <CmsPageList pages={[]} total={0} currentCategory="" />
    )
    expect(screen.getByText('新規作成')).toBeInTheDocument()
  })
})

// ============================================================
// PesticideTable
// ============================================================
describe('PesticideTable', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders empty state', () => {
    render(
      <PesticideTable
        pesticides={[]}
        search=""
        pesticideType=""
      />
    )
    expect(screen.getByText('該当する農薬データはありません')).toBeInTheDocument()
    expect(screen.getByText('農薬一覧')).toBeInTheDocument()
  })

  it('renders pesticides with type badges', () => {
    const pesticides = [
      {
        id: 'pest-1',
        name: 'テスト殺菌剤',
        registrationNumber: 'REG-001',
        pesticideType: 'fungicide',
        formulationName: '水和剤',
        effectsCount: 5,
        ingredientsCount: 2,
        updatedAt: '2025-01-01T00:00:00Z',
      },
      {
        id: 'pest-2',
        name: 'テスト殺虫剤',
        registrationNumber: null,
        pesticideType: 'insecticide',
        formulationName: null,
        effectsCount: 0,
        ingredientsCount: 1,
        updatedAt: '2025-02-01T00:00:00Z',
      },
    ]
    render(
      <PesticideTable
        pesticides={pesticides}
        search=""
        pesticideType=""
      />
    )
    expect(screen.getByText('テスト殺菌剤')).toBeInTheDocument()
    expect(screen.getByText('テスト殺虫剤')).toBeInTheDocument()
    // Type labels appear in both the table badges and the filter dropdown
    expect(screen.getAllByText('殺菌剤').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('殺虫剤').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('REG-001')).toBeInTheDocument()
    expect(screen.getByText('水和剤')).toBeInTheDocument()
  })

  it('renders filter controls', () => {
    render(
      <PesticideTable
        pesticides={[]}
        search=""
        pesticideType=""
      />
    )
    expect(screen.getByPlaceholderText('農薬名・登録番号で検索')).toBeInTheDocument()
    expect(screen.getByText('リセット')).toBeInTheDocument()
    expect(screen.getByText('農薬を追加')).toBeInTheDocument()
  })

  // NOTE: pagination と件数 UI は PesticideTable から親ページへ移動したため、
  // 旧 skip テストは削除済み。
})
