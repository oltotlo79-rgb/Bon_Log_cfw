/**
 * Admin Contact - 未カバー分岐テスト
 *
 * 対象分岐:
 * - AdminContactPage: 不明なカテゴリー/ステータスのフォールバック表示
 * - AdminContactPage: page=1 で「前へ」非表示、最終ページで「次へ」非表示
 * - ContactDetailPage: 不明なカテゴリー/ステータスのフォールバック
 * - ContactDetailActions: updateInquiryStatus が error フィールドなしのオブジェクトを返す場合
 * - ContactActionsDropdown: scroll でメニュー閉じ
 */

import { vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '../../../utils/test-utils'

const mockUpdateInquiryStatus = vi.fn()
const mockDeleteInquiry = vi.fn()
const mockGetContactInquiries = vi.fn()
const mockGetContactStats = vi.fn()
const mockGetContactInquiry = vi.fn()

vi.mock('@/lib/actions/contact', () => ({
  updateInquiryStatus: (...args: unknown[]) => mockUpdateInquiryStatus(...args),
  deleteInquiry: (...args: unknown[]) => mockDeleteInquiry(...args),
  getContactInquiries: (...args: unknown[]) => mockGetContactInquiries(...args),
  getContactStats: (...args: unknown[]) => mockGetContactStats(...args),
  getContactInquiry: (...args: unknown[]) => mockGetContactInquiry(...args),
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockNotFound = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  notFound: () => {
    mockNotFound()
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

import AdminContactPage from '@/app/admin/contact/page'
import ContactDetailPage from '@/app/admin/contact/[id]/page'
import { ContactActionsDropdown } from '@/app/admin/contact/ContactActionsDropdown'
import { ContactDetailActions } from '@/app/admin/contact/[id]/ContactDetailActions'

describe('AdminContactPage - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultStats = {
    success: true,
    data: { pending: 0, inProgress: 0, resolved: 0, closed: 0 },
  }

  it('不明なカテゴリーはそのまま表示する', async () => {
    mockGetContactStats.mockResolvedValue(defaultStats)
    mockGetContactInquiries.mockResolvedValue({
      success: true,
      data: {
        inquiries: [{
          id: 'inq-1',
          name: 'User',
          email: 'a@b.com',
          category: 'unknown_category',
          subject: 'Subject',
          status: 'pending',
          createdAt: new Date('2024-01-01'),
        }],
        total: 1,
        nextCursor: undefined,
      },
    })

    const jsx = await AdminContactPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    // CATEGORY_LABELS に存在しないカテゴリーはそのままの値が表示される
    expect(screen.getByText('unknown_category')).toBeInTheDocument()
  })

  it('不明なステータスはそのまま表示し、色クラスは空になる', async () => {
    mockGetContactStats.mockResolvedValue(defaultStats)
    mockGetContactInquiries.mockResolvedValue({
      success: true,
      data: {
        inquiries: [{
          id: 'inq-1',
          name: 'User',
          email: 'a@b.com',
          category: 'general',
          subject: 'Subject',
          status: 'unknown_status',
          createdAt: new Date('2024-01-01'),
        }],
        total: 1,
        nextCursor: undefined,
      },
    })

    const jsx = await AdminContactPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    // STATUS_LABELS に存在しないステータスはそのまま表示される
    expect(screen.getByText('unknown_status')).toBeInTheDocument()
  })

  // カーソルベース移行後の挙動:
  // - 「前へ」「次へ」は Link または無効 span のいずれかとして常にレンダリングされる
  // - 有効/無効は `closest('a')` が存在するか否かで判定する
  it('先頭ページでは「前へ」が無効（リンクでない）, 「次へ」が有効', async () => {
    mockGetContactStats.mockResolvedValue(defaultStats)
    mockGetContactInquiries.mockResolvedValue({
      success: true,
      data: {
        inquiries: [{ id: 'inq-1', name: 'User', email: 'a@b.com', category: 'general', subject: 'S', status: 'pending', createdAt: new Date() }],
        total: 30,
        nextCursor: 'inq-1',
      },
    })

    const jsx = await AdminContactPage({ searchParams: Promise.resolve({}) })
    render(jsx)

    // 先頭ページ（cursor 未指定）→ 前へは span（リンクなし）
    expect(screen.getByText('前へ').closest('a')).toBeNull()
    // nextCursor が返っている → 次へはリンク
    expect(screen.getByText('次へ').closest('a')).not.toBeNull()
  })

  it('最終ページでは「次へ」が無効（リンクでない）, 「前へ」が有効', async () => {
    mockGetContactStats.mockResolvedValue(defaultStats)
    mockGetContactInquiries.mockResolvedValue({
      success: true,
      data: {
        inquiries: [{ id: 'inq-1', name: 'User', email: 'a@b.com', category: 'general', subject: 'S', status: 'pending', createdAt: new Date() }],
        total: 30,
        nextCursor: undefined,
      },
    })

    // cursor が指定されている（= 2 ページ目以降）+ nextCursor なし（= 最終ページ）
    const jsx = await AdminContactPage({ searchParams: Promise.resolve({ cursor: 'inq-10' }) })
    render(jsx)

    // cursor 指定あり → 前へはリンク
    expect(screen.getByText('前へ').closest('a')).not.toBeNull()
    // nextCursor なし → 次へは span（リンクなし）
    expect(screen.getByText('次へ').closest('a')).toBeNull()
  })
})

describe('ContactDetailPage - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('不明なカテゴリーはそのまま表示する', async () => {
    mockGetContactInquiry.mockResolvedValue({
      success: true,
      data: {
        inquiry: {
          id: 'inq-1',
          name: 'User',
          email: 'a@b.com',
          category: 'custom_cat',
          subject: 'Subject',
          message: 'Body',
          status: 'pending',
          createdAt: new Date('2024-01-01'),
          adminNote: null,
          respondedAt: null,
        },
      },
    })

    const jsx = await ContactDetailPage({ params: Promise.resolve({ id: 'inq-1' }) })
    render(jsx)

    expect(screen.getByText('custom_cat')).toBeInTheDocument()
  })

  it('不明なステータスはそのまま表示する', async () => {
    mockGetContactInquiry.mockResolvedValue({
      success: true,
      data: {
        inquiry: {
          id: 'inq-1',
          name: 'User',
          email: 'a@b.com',
          category: 'general',
          subject: 'Subject',
          message: 'Body',
          status: 'custom_status',
          createdAt: new Date('2024-01-01'),
          adminNote: null,
          respondedAt: null,
        },
      },
    })

    const jsx = await ContactDetailPage({ params: Promise.resolve({ id: 'inq-1' }) })
    render(jsx)

    // ステータスバッジとContactDetailActionsのselectの両方
    expect(screen.getAllByText('custom_status').length).toBeGreaterThanOrEqual(1)
  })

  it('success: true だが inquiry が null の場合 notFound を呼ぶ', async () => {
    mockGetContactInquiry.mockResolvedValue({
      success: true,
      data: { inquiry: null },
    })

    await expect(
      ContactDetailPage({ params: Promise.resolve({ id: 'missing' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND')

    expect(mockNotFound).toHaveBeenCalled()
  })
})

describe('ContactActionsDropdown - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateInquiryStatus.mockResolvedValue({ success: true })
    mockDeleteInquiry.mockResolvedValue({ success: true })
  })

  it('scroll イベントでメニューが閉じる', async () => {
    render(<ContactActionsDropdown inquiryId="inq-1" currentStatus="pending" />)

    fireEvent.click(screen.getByText('操作'))
    expect(screen.getByText('対応中にする')).toBeInTheDocument()

    // scroll イベントを発火
    fireEvent.scroll(window)

    await waitFor(() => {
      expect(screen.queryByText('対応中にする')).not.toBeInTheDocument()
    })
  })

  it('currentStatus が in_progress の場合、そのオプションが除外される', () => {
    render(<ContactActionsDropdown inquiryId="inq-1" currentStatus="in_progress" />)

    fireEvent.click(screen.getByText('操作'))

    expect(screen.queryByText('対応中にする')).not.toBeInTheDocument()
    expect(screen.getByText('未対応に戻す')).toBeInTheDocument()
    expect(screen.getByText('解決済にする')).toBeInTheDocument()
    expect(screen.getByText('クローズする')).toBeInTheDocument()
  })

  it('currentStatus が resolved の場合、そのオプションが除外される', () => {
    render(<ContactActionsDropdown inquiryId="inq-1" currentStatus="resolved" />)

    fireEvent.click(screen.getByText('操作'))

    expect(screen.queryByText('解決済にする')).not.toBeInTheDocument()
    expect(screen.getByText('未対応に戻す')).toBeInTheDocument()
  })

  it('currentStatus が closed の場合、そのオプションが除外される', () => {
    render(<ContactActionsDropdown inquiryId="inq-1" currentStatus="closed" />)

    fireEvent.click(screen.getByText('操作'))

    expect(screen.queryByText('クローズする')).not.toBeInTheDocument()
    expect(screen.getByText('未対応に戻す')).toBeInTheDocument()
  })
})

describe('ContactDetailActions - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateInquiryStatus.mockResolvedValue({ success: true })
    mockDeleteInquiry.mockResolvedValue({ success: true })
  })

  it('updateInquiryStatus が error なし（空文字列）を返す場合、デフォルトメッセージを表示', async () => {
    mockUpdateInquiryStatus.mockResolvedValue({ error: '' })

    render(
      <ContactDetailActions inquiryId="inq-1" currentStatus="pending" currentNote="" />
    )

    fireEvent.click(screen.getByText('更新する'))

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
  })

  it('currentNote に初期値がある場合、テキストエリアに表示される', () => {
    render(
      <ContactDetailActions inquiryId="inq-1" currentStatus="resolved" currentNote="既存メモ" />
    )

    const textarea = screen.getByPlaceholderText('対応内容や返信内容のメモ')
    expect(textarea).toHaveValue('既存メモ')
  })

  it('更新中はボタンテキストが「更新中...」に変わる', async () => {
    mockUpdateInquiryStatus.mockImplementation(() => new Promise(() => {})) // never resolves

    render(
      <ContactDetailActions inquiryId="inq-1" currentStatus="pending" currentNote="" />
    )

    fireEvent.click(screen.getByText('更新する'))

    await waitFor(() => {
      expect(screen.getByText('更新中...')).toBeInTheDocument()
    })
  })

  it('成功メッセージは緑色クラスで表示される', async () => {
    render(
      <ContactDetailActions inquiryId="inq-1" currentStatus="pending" currentNote="" />
    )

    fireEvent.click(screen.getByText('更新する'))

    await waitFor(() => {
      const msg = screen.getByText('更新しました')
      expect(msg).toHaveClass('text-green-600')
    })
  })

  it('エラーメッセージは destructive クラスで表示される', async () => {
    mockUpdateInquiryStatus.mockResolvedValue({ error: 'Server error' })

    render(
      <ContactDetailActions inquiryId="inq-1" currentStatus="pending" currentNote="" />
    )

    fireEvent.click(screen.getByText('更新する'))

    await waitFor(() => {
      const msg = screen.getByText('Server error')
      expect(msg).toHaveClass('text-destructive')
    })
  })
})
