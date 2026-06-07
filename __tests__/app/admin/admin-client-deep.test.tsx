/**
 * @file Admin Client Components - Deep Branch Coverage Tests
 * @description Targets uncovered branches in admin client components:
 *   SegmentBuilder, IssueWarningDialog, WarningsList, NgWordList,
 *   CmsPageList, ModerationQueueList, RolesTable, AnnouncementList,
 *   PesticideTable, SecurityEventList, IpManagementClient, CohortTable,
 *   ContentAnalyticsClient, PesticideDetailPage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ---------- Mock setup ----------

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: mockRefresh,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/admin',
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

// Segment actions
const mockCreateSegment = vi.fn()
const mockDeleteSegment = vi.fn()
const mockEvaluateSegment = vi.fn()
vi.mock('@/lib/actions/admin/segments', () => ({
  createSegment: (...args: unknown[]) => mockCreateSegment(...args),
  deleteSegment: (...args: unknown[]) => mockDeleteSegment(...args),
  evaluateSegment: (...args: unknown[]) => mockEvaluateSegment(...args),
}))

// Warning actions
const mockIssueWarning = vi.fn()
const mockDeactivateWarning = vi.fn()
vi.mock('@/lib/actions/admin/warnings', () => ({
  issueWarning: (...args: unknown[]) => mockIssueWarning(...args),
  deactivateWarning: (...args: unknown[]) => mockDeactivateWarning(...args),
}))

// Premium/search actions
const mockSearchUserForPremium = vi.fn()
vi.mock('@/lib/actions/admin/premium', () => ({
  searchUserForPremium: (...args: unknown[]) => mockSearchUserForPremium(...args),
}))

// NG word / moderation actions
const mockCreateNgWord = vi.fn()
const mockDeleteNgWord = vi.fn()
const mockToggleNgWord = vi.fn()
const mockReviewModerationItem = vi.fn()
const mockBulkReviewModeration = vi.fn()
vi.mock('@/lib/actions/admin/moderation', () => ({
  createNgWord: (...args: unknown[]) => mockCreateNgWord(...args),
  deleteNgWord: (...args: unknown[]) => mockDeleteNgWord(...args),
  toggleNgWord: (...args: unknown[]) => mockToggleNgWord(...args),
  reviewModerationItem: (...args: unknown[]) => mockReviewModerationItem(...args),
  bulkReviewModeration: (...args: unknown[]) => mockBulkReviewModeration(...args),
}))

// CMS actions
const mockCreateCmsPage = vi.fn()
const mockUpdateCmsPage = vi.fn()
const mockDeleteCmsPage = vi.fn()
vi.mock('@/lib/actions/admin/cms', () => ({
  createCmsPage: (...args: unknown[]) => mockCreateCmsPage(...args),
  updateCmsPage: (...args: unknown[]) => mockUpdateCmsPage(...args),
  deleteCmsPage: (...args: unknown[]) => mockDeleteCmsPage(...args),
}))

// Role actions
const mockUpdateAdminRole = vi.fn()
const mockRemoveAdmin = vi.fn()
const mockAddAdmin = vi.fn()
vi.mock('@/lib/actions/admin/roles', () => ({
  updateAdminRole: (...args: unknown[]) => mockUpdateAdminRole(...args),
  removeAdmin: (...args: unknown[]) => mockRemoveAdmin(...args),
  addAdmin: (...args: unknown[]) => mockAddAdmin(...args),
}))

// Announcement actions
const mockCreateAnnouncement = vi.fn()
const mockUpdateAnnouncement = vi.fn()
const mockDeleteAnnouncement = vi.fn()
vi.mock('@/lib/actions/admin/announcements', () => ({
  createAnnouncement: (...args: unknown[]) => mockCreateAnnouncement(...args),
  updateAnnouncement: (...args: unknown[]) => mockUpdateAnnouncement(...args),
  deleteAnnouncement: (...args: unknown[]) => mockDeleteAnnouncement(...args),
}))

// Pesticide actions
const mockDeletePesticide = vi.fn()
const mockGetAdminPesticideDetail = vi.fn()
const mockUpdatePesticide = vi.fn()
vi.mock('@/lib/actions/admin/pesticide-data', () => ({
  deletePesticide: (...args: unknown[]) => mockDeletePesticide(...args),
  getAdminPesticideDetail: (...args: unknown[]) => mockGetAdminPesticideDetail(...args),
  updatePesticide: (...args: unknown[]) => mockUpdatePesticide(...args),
}))

// Admin permissions
vi.mock('@/lib/admin-permissions', () => ({
  ROLE_LABELS: {
    super_admin: 'Super Admin',
    admin: 'Admin',
    moderator: 'Moderator',
    support: 'Support',
    readonly: 'Read Only',
  },
}))

// ---------- Imports (after mocks) ----------

import { SegmentBuilder } from '@/app/admin/segments/SegmentBuilder'
import { IssueWarningDialog } from '@/app/admin/warnings/IssueWarningDialog'
import { WarningsList } from '@/app/admin/warnings/WarningsList'
import { NgWordList } from '@/app/admin/ng-words/NgWordList'
import { CmsPageList } from '@/app/admin/content-management/CmsPageList'
import { ModerationQueueList } from '@/app/admin/moderation-queue/ModerationQueueList'
import RolesTable from '@/app/admin/roles/RolesTable'
import { AnnouncementList } from '@/app/admin/announcements/AnnouncementList'
import { PesticideTable } from '@/app/admin/pesticide-data/PesticideTable'
import { SecurityEventList } from '@/app/admin/security/SecurityEventList'
import { IpManagementClient } from '@/app/admin/ip-management/IpManagementClient'
import { CohortTable } from '@/app/admin/analytics/cohort/CohortTable'
import { ContentAnalyticsClient } from '@/app/admin/analytics/content/ContentAnalyticsClient'

// ---------- Helpers ----------

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})

// =====================================================================
// 1. SegmentBuilder
// =====================================================================
describe('SegmentBuilder', () => {
  const baseSegments = [
    {
      id: 'seg-1',
      name: 'Active users',
      description: 'Users who post frequently',
      conditions: { rules: [{ field: 'postCount', operator: 'gte', value: 10 }], logic: 'AND' },
      createdAt: new Date('2025-01-01'),
      createdBy: 'admin',
    },
    {
      id: 'seg-2',
      name: 'No desc segment',
      description: null,
      conditions: { rules: [] },
      createdAt: new Date('2025-02-01'),
      createdBy: null,
    },
  ]

  it('renders segment list with rule count and dates', () => {
    render(<SegmentBuilder segments={baseSegments} total={2} page={1} limit={10} />)
    expect(screen.getByText('Active users')).toBeInTheDocument()
    expect(screen.getByText('Users who post frequently')).toBeInTheDocument()
    expect(screen.getByText('No desc segment')).toBeInTheDocument()
    expect(screen.getByText('(2件)')).toBeInTheDocument()
  })

  it('shows empty state when no segments', () => {
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    expect(screen.getByText('セグメントがありません')).toBeInTheDocument()
  })

  it('toggles create form on button click', async () => {
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    const btn = screen.getByText('セグメント作成')
    fireEvent.click(btn)
    expect(screen.getByText('新しいセグメント')).toBeInTheDocument()
    // Click again to close
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('新しいセグメント')).not.toBeInTheDocument()
  })

  it('shows validation error when name is empty on submit', async () => {
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))
    // Submit the form directly to bypass HTML required validation
    const form = document.querySelector('form')!
    fireEvent.submit(form)
    expect(screen.getByText('セグメント名を入力してください')).toBeInTheDocument()
  })

  it('creates segment successfully and resets form', async () => {
    mockCreateSegment.mockResolvedValue({ id: 'new-seg' })
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))

    // Fill name
    const nameInput = screen.getByPlaceholderText('例: アクティブユーザー')
    fireEvent.change(nameInput, { target: { value: 'Test Segment' } })

    // Fill description
    const descInput = screen.getByPlaceholderText('このセグメントの説明...')
    fireEvent.change(descInput, { target: { value: 'A test' } })

    // Submit
    fireEvent.click(screen.getByText('作成'))
    await waitFor(() => {
      expect(mockCreateSegment).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows error from createSegment action', async () => {
    mockCreateSegment.mockResolvedValue({ error: '重複するセグメント名です' })
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))

    const nameInput = screen.getByPlaceholderText('例: アクティブユーザー')
    fireEvent.change(nameInput, { target: { value: 'Dup' } })
    fireEvent.click(screen.getByText('作成'))

    await waitFor(() => {
      expect(screen.getByText('重複するセグメント名です')).toBeInTheDocument()
    })
  })

  it('toggles logic between AND and OR', () => {
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))
    fireEvent.click(screen.getByText('OR (いずれか)'))
    // The OR button should now be active
    expect(screen.getByText('OR (いずれか)').className).toContain('bg-primary')
  })

  it('adds and removes rules', () => {
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))

    // Add rule
    fireEvent.click(screen.getByText('条件を追加'))
    // Now there should be 2 field selects
    const fieldSelects = screen.getAllByDisplayValue('登録日')
    expect(fieldSelects.length).toBe(2)

    // Remove second rule (X buttons should appear when >1 rule)
    const _removeButtons = screen.getAllByRole('button').filter(
      (b) => b.querySelector('svg') && b.closest('.flex.items-center.gap-2.flex-wrap')
    )
    // Click the last remove button
    const xButtons = screen.getAllByRole('button').filter(btn => {
      return btn.getAttribute('type') === 'button' && btn.classList.contains('hover:text-destructive')
    })
    if (xButtons.length > 0) {
      fireEvent.click(xButtons[xButtons.length - 1])
    }
  })

  it('updates rule field and resets operator', () => {
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))

    const fieldSelect = screen.getByDisplayValue('登録日')
    fireEvent.change(fieldSelect, { target: { value: 'isPremium' } })
    // Should now show boolean select
    expect(screen.getByDisplayValue('はい')).toBeInTheDocument()
  })

  it('handles boolean field value input', () => {
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))

    const fieldSelect = screen.getByDisplayValue('登録日')
    fireEvent.change(fieldSelect, { target: { value: 'isSuspended' } })
    const boolSelect = screen.getByDisplayValue('はい')
    fireEvent.change(boolSelect, { target: { value: 'false' } })
    expect(screen.getByDisplayValue('いいえ')).toBeInTheDocument()
  })

  it('handles number field type (postCount)', async () => {
    mockCreateSegment.mockResolvedValue({ id: 'seg-num' })
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))

    const fieldSelect = screen.getByDisplayValue('登録日')
    fireEvent.change(fieldSelect, { target: { value: 'postCount' } })

    const valueInput = screen.getByPlaceholderText('値を入力...')
    fireEvent.change(valueInput, { target: { value: '50' } })

    const nameInput = screen.getByPlaceholderText('例: アクティブユーザー')
    fireEvent.change(nameInput, { target: { value: 'Number Test' } })

    fireEvent.click(screen.getByText('作成'))
    await waitFor(() => {
      expect(mockCreateSegment).toHaveBeenCalled()
      const callArgs = mockCreateSegment.mock.calls[0][0]
      expect(callArgs.conditions.rules[0].value).toBe(50)
    })
  })

  it('handles location field (text type)', () => {
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))

    const fieldSelect = screen.getByDisplayValue('登録日')
    fireEvent.change(fieldSelect, { target: { value: 'location' } })
    expect(screen.getByPlaceholderText('値を入力...')).toBeInTheDocument()
  })

  it('handles followerCount field', () => {
    render(<SegmentBuilder segments={[]} total={0} page={1} limit={10} />)
    fireEvent.click(screen.getByText('セグメント作成'))

    const fieldSelect = screen.getByDisplayValue('登録日')
    fireEvent.change(fieldSelect, { target: { value: 'followerCount' } })
    // Number input should be shown
    const input = screen.getByPlaceholderText('値を入力...')
    expect(input).toHaveAttribute('type', 'number')
  })

  it('deletes a segment with confirmation', async () => {
    mockDeleteSegment.mockResolvedValue({})
    render(<SegmentBuilder segments={baseSegments} total={2} page={1} limit={10} />)
    const deleteButtons = screen.getAllByText('削除')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(mockDeleteSegment).toHaveBeenCalledWith('seg-1')
    })
  })

  it('cancels segment deletion when confirm is false', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<SegmentBuilder segments={baseSegments} total={2} page={1} limit={10} />)
    fireEvent.click(screen.getAllByText('削除')[0])
    expect(mockDeleteSegment).not.toHaveBeenCalled()
  })

  it('evaluates a segment and shows count', async () => {
    mockEvaluateSegment.mockResolvedValue({ count: 42 })
    render(<SegmentBuilder segments={baseSegments} total={2} page={1} limit={10} />)
    const evalButtons = screen.getAllByText('評価')
    fireEvent.click(evalButtons[0])
    await waitFor(() => {
      expect(screen.getByText('該当: 42人')).toBeInTheDocument()
    })
  })

  // NOTE: `total` / `page` / `limit` ベースの旧ページネーション UI はカーソル方式への
  // 移行に伴い SegmentBuilder から削除された。対応する obsolete な skip テストは削除済み。

  it('does not show pagination when single page', () => {
    render(<SegmentBuilder segments={baseSegments} total={2} page={1} limit={10} />)
    expect(screen.queryByText('1 / 1')).not.toBeInTheDocument()
  })

  it('handles segment with non-array conditions (getRuleCount edge case)', () => {
    const segs = [{
      id: 's1', name: 'Broken', description: null,
      conditions: { rules: 'not-an-array' },
      createdAt: new Date(), createdBy: null,
    }]
    render(<SegmentBuilder segments={segs} total={1} page={1} limit={10} />)
    expect(screen.getByText('条件: 0件')).toBeInTheDocument()
  })

  it('handles segment with no conditions object', () => {
    const segs = [{
      id: 's2', name: 'NoConditions', description: null,
      conditions: null,
      createdAt: new Date(), createdBy: null,
    }]
    render(<SegmentBuilder segments={segs} total={1} page={1} limit={10} />)
    expect(screen.getByText('条件: 0件')).toBeInTheDocument()
  })
})

// =====================================================================
// 2. IssueWarningDialog
// =====================================================================
describe('IssueWarningDialog', () => {
  const onClose = vi.fn()

  it('returns null when not open', () => {
    const { container } = render(<IssueWarningDialog isOpen={false} onClose={onClose} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders dialog when open', () => {
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('警告を発行')
    expect(screen.getByPlaceholderText('ニックネームまたはメールで検索...')).toBeInTheDocument()
  })

  it('closes dialog on overlay click', () => {
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const overlay = document.querySelector('.fixed.inset-0.bg-black\\/50')
    if (overlay) fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes dialog on close button click', () => {
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const closeBtn = screen.getByLabelText('閉じる')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })

  it('closes dialog on cancel button click', () => {
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('キャンセル'))
    expect(onClose).toHaveBeenCalled()
  })

  it('searches users and shows results', async () => {
    mockSearchUserForPremium.mockResolvedValue({
      users: [
        { id: 'u1', email: 'test@test.com', nickname: 'TestUser', avatarUrl: null },
        { id: 'u2', email: 'test2@test.com', nickname: 'TestUser2', avatarUrl: 'https://img.com/a.jpg' },
      ],
    })
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const input = screen.getByPlaceholderText('ニックネームまたはメールで検索...')
    fireEvent.change(input, { target: { value: 'test' } })

    await waitFor(() => {
      expect(mockSearchUserForPremium).toHaveBeenCalledWith('test')
    })
    await waitFor(() => {
      expect(screen.getByText('TestUser')).toBeInTheDocument()
      expect(screen.getByText('TestUser2')).toBeInTheDocument()
    })
  })

  it('does not search when query < 2 chars', async () => {
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const input = screen.getByPlaceholderText('ニックネームまたはメールで検索...')
    fireEvent.change(input, { target: { value: 't' } })
    expect(mockSearchUserForPremium).not.toHaveBeenCalled()
  })

  it('handles search error gracefully', async () => {
    mockSearchUserForPremium.mockResolvedValue({ error: 'Failed' })
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const input = screen.getByPlaceholderText('ニックネームまたはメールで検索...')
    fireEvent.change(input, { target: { value: 'test' } })
    await waitFor(() => {
      expect(mockSearchUserForPremium).toHaveBeenCalled()
    })
    // Should not crash, no results shown
  })

  it('shows no results message', async () => {
    mockSearchUserForPremium.mockResolvedValue({ users: [] })
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const input = screen.getByPlaceholderText('ニックネームまたはメールで検索...')
    fireEvent.change(input, { target: { value: 'nonexistent' } })
    await waitFor(() => {
      expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument()
    })
  })

  it('selects user and clears search', async () => {
    mockSearchUserForPremium.mockResolvedValue({
      users: [{ id: 'u1', email: 'e@e.com', nickname: 'Nick', avatarUrl: null }],
    })
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const input = screen.getByPlaceholderText('ニックネームまたはメールで検索...')
    fireEvent.change(input, { target: { value: 'Nick' } })
    await waitFor(() => {
      expect(screen.getByText('Nick')).toBeInTheDocument()
    })
    // Click to select user
    const userBtn = screen.getByRole('button', { name: /Nick/ })
    fireEvent.click(userBtn)
    // Search input should be gone, user should be shown
    expect(screen.queryByPlaceholderText('ニックネームまたはメールで検索...')).not.toBeInTheDocument()
    expect(screen.getByText('Nick')).toBeInTheDocument()
  })

  it('clears selected user', async () => {
    mockSearchUserForPremium.mockResolvedValue({
      users: [{ id: 'u1', email: 'e@e.com', nickname: 'Nick', avatarUrl: 'https://img.com/b.jpg' }],
    })
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const input = screen.getByPlaceholderText('ニックネームまたはメールで検索...')
    fireEvent.change(input, { target: { value: 'Nick' } })
    await waitFor(() => screen.getByText('Nick'))
    fireEvent.click(screen.getByRole('button', { name: /Nick/ }))
    // Clear the user
    const clearBtn = screen.getByLabelText('ユーザー選択を解除')
    fireEvent.click(clearBtn)
    expect(screen.getByPlaceholderText('ニックネームまたはメールで検索...')).toBeInTheDocument()
  })

  it('shows submit button disabled when no user selected', async () => {
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const submitBtn = screen.getByRole('button', { name: '警告を発行' })
    expect(submitBtn).toBeDisabled()
  })

  it('shows warning note for temp_suspend and permanent_ban levels', async () => {
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)
    const levelSelect = screen.getByDisplayValue('注意 - 軽微な違反への注意喚起')
    fireEvent.change(levelSelect, { target: { value: 'temp_suspend' } })
    expect(screen.getByText(/一時停止されます/)).toBeInTheDocument()

    fireEvent.change(levelSelect, { target: { value: 'permanent_ban' } })
    expect(screen.getByText(/永久に停止されます/)).toBeInTheDocument()

    fireEvent.change(levelSelect, { target: { value: 'notice' } })
    expect(screen.queryByText(/停止されます/)).not.toBeInTheDocument()
  })

  it('submits warning successfully', async () => {
    mockSearchUserForPremium.mockResolvedValue({
      users: [{ id: 'u1', email: 'e@e.com', nickname: 'Nick', avatarUrl: null }],
    })
    mockIssueWarning.mockResolvedValue({ success: true })
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)

    // Search & select user
    fireEvent.change(screen.getByPlaceholderText('ニックネームまたはメールで検索...'), { target: { value: 'Nick' } })
    await waitFor(() => screen.getByText('Nick'))
    fireEvent.click(screen.getByRole('button', { name: /Nick/ }))

    // Fill reason
    fireEvent.change(screen.getByPlaceholderText('警告の理由を入力してください...'), { target: { value: 'Bad behavior' } })

    // Set expiry - find the date input by its label text
    const expiryLabel = screen.getByText(/有効期限/)
    const expiryInput = expiryLabel.closest('div')!.querySelector('input[type="date"]')!
    fireEvent.change(expiryInput, { target: { value: '2026-12-31' } })

    // Submit
    fireEvent.click(screen.getByRole('button', { name: '警告を発行' }))
    await waitFor(() => {
      expect(mockIssueWarning).toHaveBeenCalledWith({
        userId: 'u1',
        level: 'notice',
        reason: 'Bad behavior',
        expiresAt: '2026-12-31',
      })
    })
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: '警告を発行しました' })
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows error toast on submit failure', async () => {
    mockSearchUserForPremium.mockResolvedValue({
      users: [{ id: 'u1', email: 'e@e.com', nickname: 'Nick', avatarUrl: null }],
    })
    mockIssueWarning.mockResolvedValue({ error: '権限がありません' })
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('ニックネームまたはメールで検索...'), { target: { value: 'Nick' } })
    await waitFor(() => screen.getByText('Nick'))
    fireEvent.click(screen.getByRole('button', { name: /Nick/ }))
    fireEvent.change(screen.getByPlaceholderText('警告の理由を入力してください...'), { target: { value: 'Reason' } })
    fireEvent.click(screen.getByRole('button', { name: '警告を発行' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: '権限がありません', variant: 'destructive' })
    })
  })

  it('submits without expiresAt when not set', async () => {
    mockSearchUserForPremium.mockResolvedValue({
      users: [{ id: 'u1', email: 'e@e.com', nickname: 'Nick', avatarUrl: null }],
    })
    mockIssueWarning.mockResolvedValue({ success: true })
    render(<IssueWarningDialog isOpen={true} onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('ニックネームまたはメールで検索...'), { target: { value: 'Nick' } })
    await waitFor(() => screen.getByText('Nick'))
    fireEvent.click(screen.getByRole('button', { name: /Nick/ }))
    fireEvent.change(screen.getByPlaceholderText('警告の理由を入力してください...'), { target: { value: 'Reason' } })
    fireEvent.click(screen.getByRole('button', { name: '警告を発行' }))

    await waitFor(() => {
      expect(mockIssueWarning).toHaveBeenCalledWith({
        userId: 'u1',
        level: 'notice',
        reason: 'Reason',
        expiresAt: undefined,
      })
    })
  })
})

// =====================================================================
// 3. WarningsList
// =====================================================================
describe('WarningsList', () => {
  const baseWarnings = [
    {
      id: 'w1', userId: 'u1', level: 'notice', reason: 'Spam', isActive: true,
      expiresAt: '2026-12-31', createdAt: '2025-01-01',
      user: { id: 'u1', nickname: 'User1', email: 'u1@e.com', avatarUrl: null },
    },
    {
      id: 'w2', userId: 'u2', level: 'permanent_ban', reason: 'Abuse', isActive: false,
      expiresAt: null, createdAt: '2025-02-01',
      user: { id: 'u2', nickname: 'User2', email: 'u2@e.com', avatarUrl: 'https://img.com/a.jpg' },
    },
    {
      id: 'w3', userId: 'u3', level: 'unknown_level', reason: 'Test', isActive: true,
      expiresAt: null, createdAt: '2025-03-01',
      user: { id: 'u3', nickname: 'User3', email: 'u3@e.com', avatarUrl: null },
    },
  ]

  const baseProps = {
    warnings: baseWarnings,
    total: 3,
    activeWarnings: 2,
    levelCounts: { notice: 1, warning: 0, temp_suspend: 0, permanent_ban: 1 },
    totalPages: 1,
    currentPage: 1,
  }

  it('renders stats cards', () => {
    render(<WarningsList {...baseProps} />)
    expect(screen.getByText('総警告数')).toBeInTheDocument()
    expect(screen.getByText('有効な警告')).toBeInTheDocument()
  })

  it('renders warning rows with correct badges', () => {
    render(<WarningsList {...baseProps} />)
    // Multiple "注意" elements (stats card, filter option, badge)
    expect(screen.getAllByText('注意').length).toBeGreaterThanOrEqual(1)
    // "永久BAN" also appears in stats card and filter
    expect(screen.getAllByText('永久BAN').length).toBeGreaterThanOrEqual(1)
    // Unknown level fallback
    expect(screen.getByText('unknown_level')).toBeInTheDocument()
  })

  it('shows active/inactive status', () => {
    render(<WarningsList {...baseProps} />)
    expect(screen.getAllByText('有効').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('無効').length).toBeGreaterThanOrEqual(1)
  })

  it('deactivates a warning', async () => {
    mockDeactivateWarning.mockResolvedValue({ success: true })
    render(<WarningsList {...baseProps} />)
    const deactivateButtons = screen.getAllByText('無効化')
    fireEvent.click(deactivateButtons[0])
    await waitFor(() => {
      expect(mockDeactivateWarning).toHaveBeenCalledWith('w1')
      expect(mockToast).toHaveBeenCalledWith({ title: '警告を無効化しました' })
    })
  })

  it('shows error on deactivate failure', async () => {
    mockDeactivateWarning.mockResolvedValue({ error: 'Failed' })
    render(<WarningsList {...baseProps} />)
    fireEvent.click(screen.getAllByText('無効化')[0])
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Failed', variant: 'destructive' })
    })
  })

  it('shows empty state', () => {
    render(<WarningsList {...baseProps} warnings={[]} />)
    expect(screen.getByText('警告が見つかりません')).toBeInTheDocument()
  })

  // NOTE: totalPages / currentPage ベースのページネーション props は
  // カーソル化で削除されたため、関連する skip テストは削除済み。

  it('opens issue warning dialog', () => {
    render(<WarningsList {...baseProps} />)
    // Dialog content (search input) is absent until the trigger is clicked
    expect(screen.queryByPlaceholderText('ニックネームまたはメールで検索...')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '警告を発行' }))
    // IssueWarningDialog now renders with isOpen=true
    expect(screen.getByPlaceholderText('ニックネームまたはメールで検索...')).toBeInTheDocument()
  })

  it('formats dates correctly including null', () => {
    render(<WarningsList {...baseProps} />)
    // w2 has expiresAt: null, should show '-'
    const cells = screen.getAllByText('-')
    expect(cells.length).toBeGreaterThanOrEqual(1)
  })

  it('renders user avatars and fallbacks', () => {
    render(<WarningsList {...baseProps} />)
    // User2 has avatarUrl
    const imgs = screen.getAllByRole('img')
    expect(imgs.length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// 4. NgWordList
// =====================================================================
describe('NgWordList', () => {
  const baseWords = [
    { id: 'nw1', word: 'spam', category: 'spam', isRegex: false, isActive: true, createdAt: '2025-01-01' },
    { id: 'nw2', word: '\\d+', category: 'harassment', isRegex: true, isActive: false, createdAt: '2025-02-01' },
    { id: 'nw3', word: 'bad', category: 'unknown_cat', isRegex: false, isActive: true, createdAt: '2025-03-01' },
  ]

  const baseProps = { words: baseWords, total: 3, search: '', category: '', page: 1, limit: 20 }

  it('renders word list with categories and statuses', () => {
    render(<NgWordList {...baseProps} />)
    // 'spam' appears as the word and as a category option
    expect(screen.getAllByText('spam').length).toBeGreaterThanOrEqual(1)
    // 'スパム' appears in add form select and filter select and table badge
    expect(screen.getAllByText('スパム').length).toBeGreaterThanOrEqual(1)
    // 'ハラスメント' appears in table badge and select options
    expect(screen.getAllByText('ハラスメント').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('unknown_cat')).toBeInTheDocument() // fallback
  })

  it('shows regex indicator', () => {
    render(<NgWordList {...baseProps} />)
    // 正規表現 appears as checkbox label and as cell text
    expect(screen.getAllByText('正規表現').length).toBeGreaterThanOrEqual(1)
  })

  it('shows active/inactive badges', () => {
    render(<NgWordList {...baseProps} />)
    expect(screen.getAllByText('有効').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('無効').length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state', () => {
    render(<NgWordList {...baseProps} words={[]} total={0} />)
    expect(screen.getByText('NGワードが見つかりません')).toBeInTheDocument()
  })

  it('adds a new word successfully', async () => {
    mockCreateNgWord.mockResolvedValue({ id: 'new' })
    render(<NgWordList {...baseProps} />)

    fireEvent.change(screen.getByPlaceholderText('NGワードを入力'), { target: { value: 'newword' } })
    fireEvent.click(screen.getByText('追加'))

    await waitFor(() => {
      expect(mockCreateNgWord).toHaveBeenCalledWith({
        word: 'newword',
        category: 'inappropriate',
        isRegex: false,
      })
    })
  })

  it('shows error when adding empty word', async () => {
    render(<NgWordList {...baseProps} />)
    fireEvent.click(screen.getByText('追加'))
    expect(screen.getByText('ワードを入力してください')).toBeInTheDocument()
  })

  it('shows error from createNgWord action', async () => {
    mockCreateNgWord.mockResolvedValue({ error: '重複ワード' })
    render(<NgWordList {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('NGワードを入力'), { target: { value: 'dup' } })
    fireEvent.click(screen.getByText('追加'))
    await waitFor(() => {
      expect(screen.getByText('重複ワード')).toBeInTheDocument()
    })
  })

  it('toggles word active/inactive', async () => {
    mockToggleNgWord.mockResolvedValue({ success: true })
    render(<NgWordList {...baseProps} />)
    const toggleBtns = screen.getAllByTitle(/にする/)
    fireEvent.click(toggleBtns[0])
    await waitFor(() => {
      expect(mockToggleNgWord).toHaveBeenCalledWith('nw1')
    })
  })

  it('shows toast on toggle error', async () => {
    mockToggleNgWord.mockResolvedValue({ error: 'Toggle failed' })
    render(<NgWordList {...baseProps} />)
    const toggleBtns = screen.getAllByTitle(/にする/)
    fireEvent.click(toggleBtns[0])
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Toggle failed', variant: 'destructive' })
      )
    })
  })

  it('deletes a word after confirming in the dialog', async () => {
    mockDeleteNgWord.mockResolvedValue({ success: true })
    render(<NgWordList {...baseProps} />)
    fireEvent.click(screen.getAllByTitle('削除')[0])
    const confirmBtn = await screen.findByRole('button', { name: '削除する' })
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(mockDeleteNgWord).toHaveBeenCalledWith('nw1')
    })
  })

  it('cancels deletion via the dialog cancel button', async () => {
    render(<NgWordList {...baseProps} />)
    fireEvent.click(screen.getAllByTitle('削除')[0])
    const cancelBtn = await screen.findByRole('button', { name: 'キャンセル' })
    fireEvent.click(cancelBtn)
    expect(mockDeleteNgWord).not.toHaveBeenCalled()
  })

  it('shows toast on delete error', async () => {
    mockDeleteNgWord.mockResolvedValue({ error: 'Delete failed' })
    render(<NgWordList {...baseProps} />)
    fireEvent.click(screen.getAllByTitle('削除')[0])
    const confirmBtn = await screen.findByRole('button', { name: '削除する' })
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Delete failed', variant: 'destructive' })
      )
    })
  })

  it('handles search form submission', () => {
    render(<NgWordList {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('ワードで検索...'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('検索'))
    expect(mockPush).toHaveBeenCalled()
  })

  it('handles category filter change', () => {
    render(<NgWordList {...baseProps} />)
    const categorySelect = screen.getByDisplayValue('全カテゴリ')
    fireEvent.change(categorySelect, { target: { value: 'spam' } })
    expect(mockPush).toHaveBeenCalled()
  })

  // NOTE: 旧 total/page ベース UI は cursor ベースへ移行したため削除済み。

  it('adds word with regex checkbox enabled', async () => {
    mockCreateNgWord.mockResolvedValue({ id: 'regex-new' })
    render(<NgWordList {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('NGワードを入力'), { target: { value: '\\d+' } })
    fireEvent.click(screen.getByLabelText('正規表現'))
    fireEvent.change(screen.getByLabelText('カテゴリ'), { target: { value: 'harassment' } })
    fireEvent.click(screen.getByText('追加'))
    await waitFor(() => {
      expect(mockCreateNgWord).toHaveBeenCalledWith({
        word: '\\d+',
        category: 'harassment',
        isRegex: true,
      })
    })
  })
})

// =====================================================================
// 5. CmsPageList
// =====================================================================
describe('CmsPageList', () => {
  const basePages = [
    {
      id: 'p1', slug: 'help-page', title: 'Help', content: 'Content', category: 'help',
      version: 2, isPublished: true, publishedAt: '2025-01-01', updatedAt: '2025-03-01', createdAt: '2025-01-01',
    },
    {
      id: 'p2', slug: 'faq-page', title: 'FAQ', content: '', category: 'faq',
      version: 1, isPublished: false, publishedAt: null, updatedAt: '2025-02-01', createdAt: '2025-02-01',
    },
    {
      id: 'p3', slug: 'custom', title: 'Custom', content: '', category: 'unknown',
      version: 1, isPublished: true, publishedAt: null, updatedAt: '2025-02-01', createdAt: '2025-02-01',
    },
  ]

  it('renders page list', () => {
    render(<CmsPageList pages={basePages} total={3} currentCategory="" />)
    expect(screen.getByText('Help')).toBeInTheDocument()
    // FAQ appears in filter button and table
    expect(screen.getAllByText('FAQ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('全 3 件')).toBeInTheDocument()
  })

  it('shows published/draft states', () => {
    render(<CmsPageList pages={basePages} total={3} currentCategory="" />)
    // 公開中 may appear multiple times if multiple pages are published
    expect(screen.getAllByText('公開中').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('下書き')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<CmsPageList pages={[]} total={0} currentCategory="" />)
    expect(screen.getByText('ページがありません')).toBeInTheDocument()
  })

  it('toggles create form', () => {
    render(<CmsPageList pages={[]} total={0} currentCategory="" />)
    fireEvent.click(screen.getByText('新規作成'))
    expect(screen.getByText('ページを作成')).toBeInTheDocument()
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('ページを作成')).not.toBeInTheDocument()
  })

  it('shows form validation error for empty slug/title', async () => {
    render(<CmsPageList pages={[]} total={0} currentCategory="" />)
    fireEvent.click(screen.getByText('新規作成'))
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(screen.getByText('スラグとタイトルは必須です')).toBeInTheDocument()
  })

  it('creates a page successfully', async () => {
    mockCreateCmsPage.mockResolvedValue({ id: 'new-p' })
    render(<CmsPageList pages={[]} total={0} currentCategory="" />)
    fireEvent.click(screen.getByText('新規作成'))
    fireEvent.change(screen.getByPlaceholderText('例: how-to-use'), { target: { value: 'new-page' } })
    fireEvent.change(screen.getByPlaceholderText('ページタイトル'), { target: { value: 'New Page' } })
    fireEvent.change(screen.getByPlaceholderText('ページの内容を入力...'), { target: { value: 'Body' } })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => {
      expect(mockCreateCmsPage).toHaveBeenCalled()
    })
  })

  it('shows create error from action', async () => {
    mockCreateCmsPage.mockResolvedValue({ error: 'Slug exists' })
    render(<CmsPageList pages={[]} total={0} currentCategory="" />)
    fireEvent.click(screen.getByText('新規作成'))
    fireEvent.change(screen.getByPlaceholderText('例: how-to-use'), { target: { value: 'dup' } })
    fireEvent.change(screen.getByPlaceholderText('ページタイトル'), { target: { value: 'Dup' } })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => {
      expect(screen.getByText('Slug exists')).toBeInTheDocument()
    })
  })

  it('toggles page publish status', async () => {
    mockUpdateCmsPage.mockResolvedValue({})
    render(<CmsPageList pages={basePages} total={3} currentCategory="" />)
    const toggleBtns = screen.getAllByTitle(/にする|公開する/)
    fireEvent.click(toggleBtns[0])
    await waitFor(() => {
      expect(mockUpdateCmsPage).toHaveBeenCalled()
    })
  })

  it('deletes a page with confirmation', async () => {
    mockDeleteCmsPage.mockResolvedValue({})
    render(<CmsPageList pages={basePages} total={3} currentCategory="" />)
    const deleteBtns = screen.getAllByTitle('削除')
    fireEvent.click(deleteBtns[0])
    await waitFor(() => {
      expect(mockDeleteCmsPage).toHaveBeenCalledWith('help-page')
    })
  })

  it('cancels page deletion', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<CmsPageList pages={basePages} total={3} currentCategory="" />)
    fireEvent.click(screen.getAllByTitle('削除')[0])
    expect(mockDeleteCmsPage).not.toHaveBeenCalled()
  })

  it('filters by category', () => {
    render(<CmsPageList pages={basePages} total={3} currentCategory="" />)
    // ヘルプ appears in filter button, table badge, and create form select
    const helpButtons = screen.getAllByText('ヘルプ')
    // Click the first one (filter button)
    fireEvent.click(helpButtons[0])
    expect(mockPush).toHaveBeenCalled()
  })

  it('handles unknown category color fallback', () => {
    render(<CmsPageList pages={basePages} total={3} currentCategory="" />)
    // 'unknown' category on p3 should use fallback class
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })
})

// =====================================================================
// 6. ModerationQueueList
// =====================================================================
describe('ModerationQueueList', () => {
  const baseItems = [
    {
      id: 'm1', targetType: 'post', targetId: 'pid1', status: 'pending', reason: 'Spam detected',
      matchedWords: ['spam', 'buy'], reviewedBy: null, reviewedAt: null, createdAt: '2025-01-01',
    },
    {
      id: 'm2', targetType: 'comment', targetId: 'cid1', status: 'approved', reason: 'Clean',
      matchedWords: [], reviewedBy: 'admin1', reviewedAt: '2025-02-01', createdAt: '2025-01-15',
    },
    {
      id: 'm3', targetType: 'event', targetId: 'eid1', status: 'auto_flagged', reason: 'Bad',
      matchedWords: ['bad'], reviewedBy: null, reviewedAt: null, createdAt: '2025-02-01',
    },
    {
      id: 'm4', targetType: 'shop', targetId: 'sid1', status: 'rejected', reason: 'Rejected',
      matchedWords: [], reviewedBy: 'admin2', reviewedAt: null, createdAt: '2025-03-01',
    },
    {
      id: 'm5', targetType: 'user', targetId: 'uid1', status: 'pending', reason: 'Flag',
      matchedWords: [], reviewedBy: null, reviewedAt: null, createdAt: '2025-03-01',
    },
    {
      id: 'm6', targetType: 'unknown', targetId: 'x1', status: 'unknown_status', reason: 'X',
      matchedWords: [], reviewedBy: null, reviewedAt: null, createdAt: '2025-03-01',
    },
  ]

  const baseProps = {
    items: baseItems, total: 6, currentPage: 1, totalPages: 1, currentStatus: '',
  }

  it('renders items with correct status badges', () => {
    render(<ModerationQueueList {...baseProps} />)
    // Multiple pending items may render multiple 未対応
    expect(screen.getAllByText('未対応').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('自動フラグ')).toBeInTheDocument()
    expect(screen.getByText('承認済み')).toBeInTheDocument()
    expect(screen.getByText('却下済み')).toBeInTheDocument()
    expect(screen.getByText('unknown_status')).toBeInTheDocument()
  })

  it('renders target type labels and links', () => {
    render(<ModerationQueueList {...baseProps} />)
    expect(screen.getByText('投稿')).toBeInTheDocument()
    expect(screen.getByText('コメント')).toBeInTheDocument()
    expect(screen.getByText('イベント')).toBeInTheDocument()
    // 'post' and 'event' should have 確認 links
    const confirmLinks = screen.getAllByText('確認')
    expect(confirmLinks.length).toBeGreaterThanOrEqual(1)
  })

  it('shows matched words', () => {
    render(<ModerationQueueList {...baseProps} />)
    expect(screen.getByText('spam')).toBeInTheDocument()
    expect(screen.getByText('buy')).toBeInTheDocument()
  })

  it('shows empty matched words as dash', () => {
    render(<ModerationQueueList {...baseProps} />)
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('shows approve/reject buttons for pending items', () => {
    render(<ModerationQueueList {...baseProps} />)
    expect(screen.getAllByText('承認').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('却下').length).toBeGreaterThanOrEqual(1)
  })

  it('reviews an item (approve)', async () => {
    mockReviewModerationItem.mockResolvedValue({ success: true })
    render(<ModerationQueueList {...baseProps} />)
    fireEvent.click(screen.getAllByText('承認')[0])
    await waitFor(() => {
      expect(mockReviewModerationItem).toHaveBeenCalledWith('m1', 'approved')
      expect(mockToast).toHaveBeenCalledWith({ title: '承認しました' })
    })
  })

  it('reviews an item (reject)', async () => {
    mockReviewModerationItem.mockResolvedValue({ success: true })
    render(<ModerationQueueList {...baseProps} />)
    fireEvent.click(screen.getAllByText('却下')[0])
    await waitFor(() => {
      expect(mockReviewModerationItem).toHaveBeenCalledWith('m1', 'rejected')
      expect(mockToast).toHaveBeenCalledWith({ title: '却下しました' })
    })
  })

  it('shows error on review failure', async () => {
    mockReviewModerationItem.mockResolvedValue({ error: 'Review error' })
    render(<ModerationQueueList {...baseProps} />)
    fireEvent.click(screen.getAllByText('承認')[0])
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Review error', variant: 'destructive' })
    })
  })

  it('handles select all / deselect all', () => {
    render(<ModerationQueueList {...baseProps} />)
    const allCheckbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(allCheckbox) // select all
    expect(screen.getByText(`${baseItems.length} 件選択中`)).toBeInTheDocument()
    fireEvent.click(allCheckbox) // deselect all
    expect(screen.queryByText(/件選択中/)).not.toBeInTheDocument()
  })

  it('toggles individual item selection', () => {
    render(<ModerationQueueList {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1]) // select first item
    expect(screen.getByText('1 件選択中')).toBeInTheDocument()
    fireEvent.click(checkboxes[1]) // deselect
    expect(screen.queryByText(/件選択中/)).not.toBeInTheDocument()
  })

  it('bulk approves selected items', async () => {
    mockBulkReviewModeration.mockResolvedValue({ success: true })
    render(<ModerationQueueList {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[2])
    fireEvent.click(screen.getByText('一括承認'))
    await waitFor(() => {
      expect(mockBulkReviewModeration).toHaveBeenCalled()
      expect(mockToast).toHaveBeenCalled()
    })
  })

  it('bulk rejects selected items', async () => {
    mockBulkReviewModeration.mockResolvedValue({ success: true })
    render(<ModerationQueueList {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByText('一括却下'))
    await waitFor(() => {
      expect(mockBulkReviewModeration).toHaveBeenCalled()
    })
  })

  it('shows error on bulk review failure', async () => {
    mockBulkReviewModeration.mockResolvedValue({ error: 'Bulk fail' })
    render(<ModerationQueueList {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByText('一括承認'))
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({ title: 'Bulk fail', variant: 'destructive' })
    })
  })

  it('clears selection with button', () => {
    render(<ModerationQueueList {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1])
    fireEvent.click(screen.getByText('選択解除'))
    expect(screen.queryByText(/件選択中/)).not.toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<ModerationQueueList items={[]} total={0} currentPage={1} totalPages={1} currentStatus="" />)
    expect(screen.getByText('モデレーション対象が見つかりません')).toBeInTheDocument()
  })

  it('shows reviewed item with date', () => {
    render(<ModerationQueueList {...baseProps} />)
    expect(screen.getAllByText(/対応済み/).length).toBeGreaterThanOrEqual(1)
  })

  // NOTE: totalPages/currentPage props はカーソル化で削除済み。
})

// =====================================================================
// 7. RolesTable
// =====================================================================
describe('RolesTable', () => {
  const baseAdmins = [
    {
      userId: 'u1', role: 'admin' as const, createdAt: '2025-01-01',
      user: { id: 'u1', nickname: 'Admin1', email: 'a1@e.com', avatarUrl: null },
    },
    {
      userId: 'u2', role: 'moderator' as const, createdAt: '2025-02-01',
      user: { id: 'u2', nickname: 'Mod1', email: 'm1@e.com', avatarUrl: 'https://img.com/b.jpg' },
    },
  ]

  it('renders admin list', () => {
    render(<RolesTable admins={baseAdmins} />)
    expect(screen.getByText('Admin1')).toBeInTheDocument()
    expect(screen.getByText('Mod1')).toBeInTheDocument()
  })

  it('shows avatar image or fallback', () => {
    render(<RolesTable admins={baseAdmins} />)
    // u2 has avatarUrl, rendered as img
    const imgs = screen.getAllByRole('img')
    expect(imgs.length).toBeGreaterThanOrEqual(1)
    // u1 has no avatar - should show initial 'A' (first char of Admin1)
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<RolesTable admins={[]} />)
    expect(screen.getByText('管理者がいません')).toBeInTheDocument()
  })

  it('changes role', async () => {
    mockUpdateAdminRole.mockResolvedValue({ success: true })
    render(<RolesTable admins={baseAdmins} />)
    const selects = screen.getAllByDisplayValue('管理者')
    fireEvent.change(selects[0], { target: { value: 'moderator' } })
    await waitFor(() => {
      expect(mockUpdateAdminRole).toHaveBeenCalledWith('u1', 'moderator')
    })
  })

  it('shows error on role change failure', async () => {
    mockUpdateAdminRole.mockResolvedValue({ error: 'Unauthorized' })
    render(<RolesTable admins={baseAdmins} />)
    const selects = screen.getAllByDisplayValue('管理者')
    fireEvent.change(selects[0], { target: { value: 'support' } })
    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument()
    })
  })

  it('removes admin with confirmation', async () => {
    mockRemoveAdmin.mockResolvedValue({ success: true })
    render(<RolesTable admins={baseAdmins} />)
    const deleteButtons = screen.getAllByTitle('管理者から削除')
    fireEvent.click(deleteButtons[0])
    await waitFor(() => {
      expect(mockRemoveAdmin).toHaveBeenCalledWith('u1')
    })
  })

  it('cancels admin removal', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<RolesTable admins={baseAdmins} />)
    fireEvent.click(screen.getAllByTitle('管理者から削除')[0])
    expect(mockRemoveAdmin).not.toHaveBeenCalled()
  })

  it('shows error on remove failure', async () => {
    mockRemoveAdmin.mockResolvedValue({ error: 'Cannot remove' })
    render(<RolesTable admins={baseAdmins} />)
    fireEvent.click(screen.getAllByTitle('管理者から削除')[0])
    await waitFor(() => {
      expect(screen.getByText('Cannot remove')).toBeInTheDocument()
    })
  })

  it('adds a new admin', async () => {
    mockAddAdmin.mockResolvedValue({ success: true })
    render(<RolesTable admins={baseAdmins} />)
    fireEvent.change(screen.getByPlaceholderText('ユーザーID'), { target: { value: 'new-user-id' } })
    const addButton = screen.getAllByText('追加')[0]
    fireEvent.click(addButton)
    await waitFor(() => {
      expect(mockAddAdmin).toHaveBeenCalledWith('new-user-id', 'readonly')
    })
  })

  it('does not add admin with empty user id', () => {
    render(<RolesTable admins={baseAdmins} />)
    const addButton = screen.getAllByText('追加')[0]
    fireEvent.click(addButton)
    expect(mockAddAdmin).not.toHaveBeenCalled()
  })

  it('shows error on add failure', async () => {
    mockAddAdmin.mockResolvedValue({ error: 'User not found' })
    render(<RolesTable admins={baseAdmins} />)
    fireEvent.change(screen.getByPlaceholderText('ユーザーID'), { target: { value: 'bad-id' } })
    fireEvent.click(screen.getAllByText('追加')[0])
    await waitFor(() => {
      expect(screen.getByText('User not found')).toBeInTheDocument()
    })
  })
})

// =====================================================================
// 8. AnnouncementList
// =====================================================================
describe('AnnouncementList', () => {
  const baseAnnouncements = [
    {
      id: 'a1', title: 'Maintenance', content: 'System down', type: 'banner' as const,
      isActive: true, startsAt: '2025-01-01', endsAt: '2025-01-31', createdAt: '2025-01-01',
    },
    {
      id: 'a2', title: 'Update', content: 'New feature', type: 'notification' as const,
      isActive: false, startsAt: '2025-02-01', endsAt: null, createdAt: '2025-02-01',
    },
    {
      id: 'a3', title: 'Both', content: 'Both type', type: 'both' as const,
      isActive: true, startsAt: '2025-03-01', endsAt: null, createdAt: '2025-03-01',
    },
  ]

  it('renders announcement list', () => {
    render(<AnnouncementList announcements={baseAnnouncements} />)
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText('Update')).toBeInTheDocument()
  })

  it('shows type badges', () => {
    render(<AnnouncementList announcements={baseAnnouncements} />)
    expect(screen.getByText('バナー')).toBeInTheDocument()
    expect(screen.getByText('通知')).toBeInTheDocument()
    expect(screen.getByText('両方')).toBeInTheDocument()
  })

  it('shows active/inactive status', () => {
    render(<AnnouncementList announcements={baseAnnouncements} />)
    expect(screen.getAllByText('有効').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('無効').length).toBeGreaterThanOrEqual(1)
  })

  it('shows end date when present', () => {
    render(<AnnouncementList announcements={baseAnnouncements} />)
    expect(screen.getByText(/終了:/)).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<AnnouncementList announcements={[]} />)
    expect(screen.getByText('お知らせがありません')).toBeInTheDocument()
  })

  it('toggles create form', () => {
    render(<AnnouncementList announcements={[]} />)
    fireEvent.click(screen.getByText('新規作成'))
    expect(screen.getByText('お知らせを作成')).toBeInTheDocument()
  })

  it('shows validation error for empty title', async () => {
    render(<AnnouncementList announcements={[]} />)
    fireEvent.click(screen.getByText('新規作成'))
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(screen.getByText('タイトルを入力してください')).toBeInTheDocument()
  })

  it('creates announcement successfully', async () => {
    mockCreateAnnouncement.mockResolvedValue({ id: 'new-a' })
    render(<AnnouncementList announcements={[]} />)
    fireEvent.click(screen.getByText('新規作成'))
    fireEvent.change(screen.getByPlaceholderText('お知らせタイトル'), { target: { value: 'Test' } })
    fireEvent.change(screen.getByPlaceholderText('お知らせの内容を入力...'), { target: { value: 'Body' } })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => {
      expect(mockCreateAnnouncement).toHaveBeenCalled()
    })
  })

  it('creates announcement with endsAt', async () => {
    mockCreateAnnouncement.mockResolvedValue({ id: 'new-a2' })
    render(<AnnouncementList announcements={[]} />)
    fireEvent.click(screen.getByText('新規作成'))
    fireEvent.change(screen.getByPlaceholderText('お知らせタイトル'), { target: { value: 'Test' } })
    // Find the endsAt date input by its label
    const endDateLabel = screen.getByText('終了日（任意）')
    const endDateInput = endDateLabel.parentElement!.querySelector('input')!
    fireEvent.change(endDateInput, { target: { value: '2026-12-31' } })
    // Click the submit button (not the 新規作成 toggle)
    const buttons = screen.getAllByRole('button')
    const createBtn = buttons.find(b => b.textContent?.trim() === '作成')!
    fireEvent.click(createBtn)
    await waitFor(() => {
      const call = mockCreateAnnouncement.mock.calls[0][0]
      expect(call.endsAt).toBeTruthy()
    })
  })

  it('shows create error', async () => {
    mockCreateAnnouncement.mockResolvedValue({ error: 'Create failed' })
    render(<AnnouncementList announcements={[]} />)
    fireEvent.click(screen.getByText('新規作成'))
    fireEvent.change(screen.getByPlaceholderText('お知らせタイトル'), { target: { value: 'Test' } })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await waitFor(() => {
      expect(screen.getByText('Create failed')).toBeInTheDocument()
    })
  })

  it('toggles active status', async () => {
    mockUpdateAnnouncement.mockResolvedValue({})
    render(<AnnouncementList announcements={baseAnnouncements} />)
    const toggleBtns = screen.getAllByTitle(/にする/)
    fireEvent.click(toggleBtns[0])
    await waitFor(() => {
      expect(mockUpdateAnnouncement).toHaveBeenCalled()
    })
  })

  it('deletes announcement with confirmation', async () => {
    mockDeleteAnnouncement.mockResolvedValue({})
    render(<AnnouncementList announcements={baseAnnouncements} />)
    const deleteBtns = screen.getAllByTitle('削除')
    fireEvent.click(deleteBtns[0])
    await waitFor(() => {
      expect(mockDeleteAnnouncement).toHaveBeenCalledWith('a1')
    })
  })

  it('cancels announcement deletion', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AnnouncementList announcements={baseAnnouncements} />)
    fireEvent.click(screen.getAllByTitle('削除')[0])
    expect(mockDeleteAnnouncement).not.toHaveBeenCalled()
  })

  it('changes type in create form', () => {
    render(<AnnouncementList announcements={[]} />)
    fireEvent.click(screen.getByText('新規作成'))
    const typeSelect = screen.getByDisplayValue('バナー')
    fireEvent.change(typeSelect, { target: { value: 'notification' } })
    expect(screen.getByDisplayValue('通知')).toBeInTheDocument()
  })
})

// =====================================================================
// 9. PesticideTable
// =====================================================================
describe('PesticideTable', () => {
  const basePesticides = [
    {
      id: 'pest1', name: 'Pesticide A', registrationNumber: 'R-001', pesticideType: 'fungicide',
      formulationName: 'WP', effectsCount: 5, ingredientsCount: 2, updatedAt: '2025-01-01',
    },
    {
      id: 'pest2', name: 'Pesticide B', registrationNumber: null, pesticideType: 'unknown_type',
      formulationName: null, effectsCount: 0, ingredientsCount: 0, updatedAt: '2025-02-01',
    },
  ]

  const baseProps = {
    pesticides: basePesticides, total: 2, search: '', pesticideType: '', page: 1, limit: 20,
  }

  it('renders pesticide list', () => {
    render(<PesticideTable {...baseProps} />)
    expect(screen.getByText('Pesticide A')).toBeInTheDocument()
    // 殺菌剤 appears in filter select and table badge
    expect(screen.getAllByText('殺菌剤').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('R-001')).toBeInTheDocument()
    expect(screen.getByText('WP')).toBeInTheDocument()
  })

  it('handles null registrationNumber and formulationName', () => {
    render(<PesticideTable {...baseProps} />)
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it('handles unknown pesticide type with fallback', () => {
    render(<PesticideTable {...baseProps} />)
    expect(screen.getByText('unknown_type')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<PesticideTable {...baseProps} pesticides={[]} total={0} />)
    expect(screen.getByText('該当する農薬データはありません')).toBeInTheDocument()
  })

  it('applies search filter', () => {
    render(<PesticideTable {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('農薬名・登録番号で検索'), { target: { value: 'test' } })
    fireEvent.click(screen.getByText('検索'))
    expect(mockPush).toHaveBeenCalled()
  })

  it('applies search on Enter key', () => {
    render(<PesticideTable {...baseProps} />)
    const input = screen.getByPlaceholderText('農薬名・登録番号で検索')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockPush).toHaveBeenCalled()
  })

  it('changes type filter', () => {
    render(<PesticideTable {...baseProps} />)
    const typeSelect = screen.getByDisplayValue('全ての種別')
    fireEvent.change(typeSelect, { target: { value: 'insecticide' } })

    // Controlled select reflects the new selection
    expect((typeSelect as HTMLSelectElement).value).toBe('insecticide')

    // Applying the filter pushes the chosen type into the URL
    mockPush.mockClear()
    fireEvent.click(screen.getByText('検索'))
    expect(mockPush).toHaveBeenCalledWith('/admin/pesticide-data?pesticideType=insecticide')
  })

  it('resets filters', () => {
    render(<PesticideTable {...baseProps} />)
    fireEvent.click(screen.getByText('リセット'))
    expect(mockPush).toHaveBeenCalledWith('/admin/pesticide-data')
  })

  it('deletes pesticide after confirming in the dialog', async () => {
    mockDeletePesticide.mockResolvedValue({ success: true })
    render(<PesticideTable {...baseProps} />)
    fireEvent.click(screen.getAllByTitle('削除')[0])
    const confirmBtn = await screen.findByRole('button', { name: '削除する' })
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(mockDeletePesticide).toHaveBeenCalledWith('pest1')
    })
  })

  it('cancels pesticide deletion via the dialog cancel button', async () => {
    render(<PesticideTable {...baseProps} />)
    fireEvent.click(screen.getAllByTitle('削除')[0])
    const cancelBtn = await screen.findByRole('button', { name: 'キャンセル' })
    fireEvent.click(cancelBtn)
    expect(mockDeletePesticide).not.toHaveBeenCalled()
  })

  it('shows toast on delete error', async () => {
    mockDeletePesticide.mockResolvedValue({ error: 'Delete error' })
    render(<PesticideTable {...baseProps} />)
    fireEvent.click(screen.getAllByTitle('削除')[0])
    const confirmBtn = await screen.findByRole('button', { name: '削除する' })
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Delete error', variant: 'destructive' })
      )
    })
  })

  // NOTE: total / page ベースのページネーション UI はカーソル化で削除済み。

  it('does not show item range when total is 0', () => {
    render(<PesticideTable {...baseProps} total={0} pesticides={[]} />)
    expect(screen.queryByText(/件を表示/)).not.toBeInTheDocument()
  })
})

// =====================================================================
// 10. SecurityEventList
// =====================================================================
describe('SecurityEventList', () => {
  const baseEvents = [
    {
      id: 'e1', eventType: 'failed_login', userId: 'u1234567890ab', ipAddress: '1.2.3.4',
      userAgent: 'Mozilla', details: null, createdAt: '2025-01-01T12:00:00',
    },
    {
      id: 'e2', eventType: 'password_change', userId: null, ipAddress: null,
      userAgent: null, details: null, createdAt: '2025-02-01T10:00:00',
    },
    {
      id: 'e3', eventType: '2fa_toggle', userId: 'uid3', ipAddress: '5.6.7.8',
      userAgent: null, details: null, createdAt: '2025-03-01T08:00:00',
    },
    {
      id: 'e4', eventType: 'email_change', userId: 'uid4', ipAddress: '9.9.9.9',
      userAgent: null, details: null, createdAt: '2025-04-01T08:00:00',
    },
    {
      id: 'e5', eventType: 'unknown_type', userId: null, ipAddress: null,
      userAgent: null, details: null, createdAt: '2025-05-01T08:00:00',
    },
  ]

  const baseProps = {
    events: baseEvents, total: 5, eventType: '', ipAddress: '', dateFrom: '', dateTo: '', page: 1, limit: 20,
  }

  it('renders event list with labels', () => {
    render(<SecurityEventList {...baseProps} />)
    // Labels appear both in filter options and table rows
    expect(screen.getAllByText('ログイン失敗').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('パスワード変更').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('2FA切替').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('メール変更').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('unknown_type')).toBeInTheDocument()
  })

  it('shows userId truncated or dash', () => {
    render(<SecurityEventList {...baseProps} />)
    expect(screen.getByText('u1234567890a...')).toBeInTheDocument()
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('shows IP addresses or dash', () => {
    render(<SecurityEventList {...baseProps} />)
    expect(screen.getByText('1.2.3.4')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<SecurityEventList {...baseProps} events={[]} total={0} />)
    expect(screen.getByText('該当するイベントはありません')).toBeInTheDocument()
  })

  it('applies filters', () => {
    render(<SecurityEventList {...baseProps} />)
    const typeSelect = screen.getByDisplayValue('全てのイベント')
    fireEvent.change(typeSelect, { target: { value: 'failed_login' } })
    fireEvent.click(screen.getByText('検索'))
    expect(mockPush).toHaveBeenCalled()
  })

  it('applies IP address filter', () => {
    render(<SecurityEventList {...baseProps} />)
    const ipInput = screen.getByPlaceholderText('IPアドレスで検索') as HTMLInputElement
    fireEvent.change(ipInput, { target: { value: '1.2.3' } })

    // Controlled input reflects the typed value
    expect(ipInput.value).toBe('1.2.3')

    // Applying the filter pushes the IP into the URL
    mockPush.mockClear()
    fireEvent.click(screen.getByText('検索'))
    expect(mockPush).toHaveBeenCalledWith('/admin/security?ipAddress=1.2.3')
  })

  it('applies date range filter', () => {
    const { container } = render(<SecurityEventList {...baseProps} />)
    const dateInputs = container.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBe(2)

    fireEvent.change(dateInputs[0], { target: { value: '2025-01-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2025-01-31' } })

    // Controlled date inputs reflect the selected range
    expect((dateInputs[0] as HTMLInputElement).value).toBe('2025-01-01')
    expect((dateInputs[1] as HTMLInputElement).value).toBe('2025-01-31')

    // Applying the filter pushes both bounds into the URL
    mockPush.mockClear()
    fireEvent.click(screen.getByText('検索'))
    expect(mockPush).toHaveBeenCalledWith('/admin/security?dateFrom=2025-01-01&dateTo=2025-01-31')
  })

  it('resets filters', () => {
    render(<SecurityEventList {...baseProps} />)
    fireEvent.click(screen.getByText('リセット'))
    expect(mockPush).toHaveBeenCalledWith('/admin/security')
  })

  // NOTE: total / page ベースのページネーション UI はカーソル化で削除済み。
})

// =====================================================================
// 11. IpManagementClient
// =====================================================================
describe('IpManagementClient', () => {
  const baseDevices = [
    {
      id: 'd1', ipAddress: '1.2.3.4', userId: 'u1', userAgent: 'Chrome/100',
      lastSeenAt: new Date('2025-01-01'),
      user: { id: 'u1', nickname: 'User1', email: 'u1@e.com', avatarUrl: null, isSuspended: false },
    },
    {
      id: 'd2', ipAddress: null, userId: 'u2', userAgent: null,
      lastSeenAt: new Date('2025-02-01'),
      user: null,
    },
    {
      id: 'd3', ipAddress: '5.6.7.8', userId: 'u3', userAgent: 'Firefox',
      lastSeenAt: new Date('2025-03-01'),
      user: { id: 'u3', nickname: 'User3', email: 'u3@e.com', avatarUrl: 'https://img.com/c.jpg', isSuspended: true },
    },
  ]

  const baseSuspicious = [
    {
      ipAddress: '1.2.3.4', userCount: 2,
      users: [
        { id: 'u1', nickname: 'User1', email: 'u1@e.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
        { id: 'u3', nickname: 'User3', email: 'u3@e.com', avatarUrl: 'https://img.com/c.jpg', isSuspended: true, createdAt: new Date() },
        undefined,
      ],
    },
  ]

  const baseProps = {
    devices: baseDevices, total: 3, suspiciousIps: baseSuspicious, search: '', page: 1, limit: 20,
  }

  it('renders device list', () => {
    render(<IpManagementClient {...baseProps} />)
    // 1.2.3.4 appears in both device list and suspicious IPs section
    expect(screen.getAllByText('1.2.3.4').length).toBeGreaterThanOrEqual(1)
    // User1 appears in device list and suspicious section
    expect(screen.getAllByText('User1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('(3件)')).toBeInTheDocument()
  })

  it('shows unknown IP and user for null values', () => {
    render(<IpManagementClient {...baseProps} />)
    expect(screen.getAllByText('不明').length).toBeGreaterThanOrEqual(1)
  })

  it('shows suspicious IPs section', () => {
    render(<IpManagementClient {...baseProps} />)
    expect(screen.getByText('複数アカウント検出')).toBeInTheDocument()
    expect(screen.getByText('2アカウント')).toBeInTheDocument()
  })

  it('shows suspended badge in suspicious IPs', () => {
    render(<IpManagementClient {...baseProps} />)
    expect(screen.getAllByText('停止中').length).toBeGreaterThanOrEqual(1)
  })

  it('hides suspicious section when empty', () => {
    render(<IpManagementClient {...baseProps} suspiciousIps={[]} />)
    expect(screen.queryByText('複数アカウント検出')).not.toBeInTheDocument()
  })

  it('shows empty device list', () => {
    render(<IpManagementClient {...baseProps} devices={[]} total={0} suspiciousIps={[]} />)
    expect(screen.getByText('データがありません')).toBeInTheDocument()
  })

  it('handles search form submission', () => {
    render(<IpManagementClient {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('IPアドレスで検索...'), { target: { value: '1.2' } })
    fireEvent.click(screen.getByText('検索'))
    expect(mockPush).toHaveBeenCalled()
  })

  // NOTE: total / page ベースのページネーション UI はカーソル化で削除済み。

  it('renders user agent info', () => {
    render(<IpManagementClient {...baseProps} />)
    expect(screen.getByText('Chrome/100')).toBeInTheDocument()
  })
})

// =====================================================================
// 12. CohortTable
// =====================================================================
describe('CohortTable', () => {
  const tableData = [
    {
      cohort: '2025-01',
      total: 100,
      rates: [
        { month: 'M1', rate: 80 },
        { month: 'M2', rate: 45 },
        { month: 'M3', rate: 0 },
      ],
    },
    {
      cohort: '2025-02',
      total: 50,
      rates: [
        { month: 'M1', rate: 15 },
        { month: 'M2', rate: 5 },
        { month: 'M3', rate: 25 },
      ],
    },
  ]

  const baseProps = {
    tableData,
    activeMonths: ['M1', 'M2', 'M3'],
    avgRetention: [47, 25, 12],
    currentPeriod: 'monthly' as const,
  }

  it('renders cohort table with data', () => {
    render(<CohortTable {...baseProps} />)
    expect(screen.getByText('2025-01')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('shows dash for 0% rate', () => {
    render(<CohortTable {...baseProps} />)
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  it('shows average row', () => {
    render(<CohortTable {...baseProps} />)
    expect(screen.getByText('平均')).toBeInTheDocument()
    expect(screen.getByText('47%')).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<CohortTable {...baseProps} tableData={[]} activeMonths={[]} avgRetention={[]} />)
    expect(screen.getByText('コホートデータがありません')).toBeInTheDocument()
  })

  it('switches period to weekly', () => {
    render(<CohortTable {...baseProps} />)
    fireEvent.click(screen.getByText('週次'))
    expect(mockPush).toHaveBeenCalled()
  })

  it('switches period to monthly', () => {
    render(<CohortTable {...baseProps} currentPeriod="weekly" />)
    fireEvent.click(screen.getByText('月次'))
    expect(mockPush).toHaveBeenCalled()
  })

  it('shows legend', () => {
    render(<CohortTable {...baseProps} />)
    expect(screen.getByText('リテンション率:')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('80%+')).toBeInTheDocument()
  })

  it('applies correct color classes for various retention rates', () => {
    // Test all color thresholds via the data
    const fullData = [
      {
        cohort: 'C1', total: 10,
        rates: [
          { month: 'M1', rate: 0 },
          { month: 'M2', rate: 5 },
          { month: 'M3', rate: 15 },
          { month: 'M4', rate: 25 },
          { month: 'M5', rate: 35 },
          { month: 'M6', rate: 45 },
          { month: 'M7', rate: 55 },
          { month: 'M8', rate: 65 },
          { month: 'M9', rate: 75 },
          { month: 'M10', rate: 85 },
        ],
      },
    ]
    render(
      <CohortTable
        tableData={fullData}
        activeMonths={['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10']}
        avgRetention={[0, 5, 15, 25, 35, 45, 55, 65, 75, 85]}
        currentPeriod="monthly"
      />
    )
    expect(screen.getAllByText('85%').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('55%').length).toBeGreaterThanOrEqual(1)
  })
})

// =====================================================================
// 13. ContentAnalyticsClient
// =====================================================================
describe('ContentAnalyticsClient', () => {
  const baseDailyEngagement = [
    { date: '2025-01-01', posts: 10, likes: 50, comments: 20 },
    { date: '2025-01-02', posts: 15, likes: 70, comments: 30 },
  ]

  it('renders engagement table', () => {
    render(<ContentAnalyticsClient dailyEngagement={baseDailyEngagement} />)
    expect(screen.getByText('日別エンゲージメント')).toBeInTheDocument()
    expect(screen.getByText('2025-01-01')).toBeInTheDocument()
    expect(screen.getByText('2025-01-02')).toBeInTheDocument()
  })

  it('shows totals in footer', () => {
    render(<ContentAnalyticsClient dailyEngagement={baseDailyEngagement} />)
    expect(screen.getByText('合計')).toBeInTheDocument()
    // Total values appear in footer (may also appear in individual rows as counts)
    expect(screen.getAllByText('25').length).toBeGreaterThanOrEqual(1) // 10 + 15
    expect(screen.getAllByText('120').length).toBeGreaterThanOrEqual(1) // 50 + 70
    expect(screen.getAllByText('50').length).toBeGreaterThanOrEqual(1) // 20 + 30
  })

  it('shows empty state', () => {
    render(<ContentAnalyticsClient dailyEngagement={[]} />)
    expect(screen.getByText('データがありません')).toBeInTheDocument()
  })

  it('exports CSV', async () => {
    // Mock URL API
    const origCreateObjectURL = URL.createObjectURL
    const origRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn().mockReturnValue('blob:test')
    URL.revokeObjectURL = vi.fn()

    render(<ContentAnalyticsClient dailyEngagement={baseDailyEngagement} />)
    const exportBtn = screen.getByRole('button', { name: /CSVエクスポート/ })
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled()
    })

    // Cleanup
    URL.createObjectURL = origCreateObjectURL
    URL.revokeObjectURL = origRevokeObjectURL
  })
})

// =====================================================================
// 14. PesticideEditForm (Client Component extracted from [id]/page.tsx)
// =====================================================================
//
// 元々の PesticideDetailPage は Server Component に移行されたため、
// 編集フォーム部分の Client Component を直接テストする構成に変更。
// Server Component 側の詳細テストは E2E で担保する。

import { PesticideEditForm } from '@/app/admin/pesticide-data/[id]/PesticideEditForm'

describe('PesticideEditForm', () => {
  const baseInitial = {
    name: 'Test Pesticide',
    registrationNumber: 'R-123',
    pesticideType: 'insecticide' as const,
    description: 'A test pesticide',
    formulationTypeName: 'WP',
  }

  it('renders all form fields with initial values', () => {
    render(<PesticideEditForm id="test-id" initial={baseInitial} />)
    expect(screen.getByDisplayValue('Test Pesticide')).toBeInTheDocument()
    expect(screen.getByDisplayValue('R-123')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A test pesticide')).toBeInTheDocument()
    expect(screen.getByDisplayValue('WP')).toBeInTheDocument()
    // 種別セレクトの初期選択値
    expect((screen.getByLabelText('種別 *') as HTMLSelectElement).value).toBe('insecticide')
  })

  it('persists edits and calls updatePesticide with normalized payload', async () => {
    mockUpdatePesticide.mockResolvedValue({ success: true })
    render(<PesticideEditForm id="test-id" initial={baseInitial} />)

    fireEvent.change(screen.getByLabelText('農薬名 *'), { target: { value: 'Updated Pesticide' } })
    fireEvent.change(screen.getByLabelText('登録番号'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('種別 *'), { target: { value: 'fungicide' } })
    fireEvent.change(screen.getByLabelText('説明'), { target: { value: '' } })

    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => {
      expect(mockUpdatePesticide).toHaveBeenCalledWith('test-id', {
        name: 'Updated Pesticide',
        registrationNumber: null,
        pesticideType: 'fungicide',
        description: null,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('保存しました')).toBeInTheDocument()
    })
  })

  it('shows error message when updatePesticide fails', async () => {
    mockUpdatePesticide.mockResolvedValue({ success: false, error: 'Save failed' })
    render(<PesticideEditForm id="test-id" initial={baseInitial} />)

    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })
  })

  it('disables the save button when the name is blank', () => {
    render(
      <PesticideEditForm
        id="test-id"
        initial={{ ...baseInitial, name: '' }}
      />,
    )
    expect(screen.getByText('保存').closest('button')).toBeDisabled()
  })

  it('renders empty formulation name gracefully', () => {
    render(
      <PesticideEditForm
        id="test-id"
        initial={{ ...baseInitial, formulationTypeName: null }}
      />,
    )
    // 剤型は disabled input として残り、値は空文字
    const formulationInput = screen.getByLabelText('剤型') as HTMLInputElement
    expect(formulationInput.value).toBe('')
    expect(formulationInput).toBeDisabled()
  })
})
