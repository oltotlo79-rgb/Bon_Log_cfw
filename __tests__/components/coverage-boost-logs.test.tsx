

import { vi } from 'vitest'
/**
 * app/admin/logs/page.tsx カバレッジ補強テスト
 *
 * 以下の未カバー分岐を網羅する:
 * - log.details が JSON 文字列の場合（typeof log.details === 'string' パス）
 * - JSON.parse 失敗時の catch ブロック
 * - log.targetId が null の場合（"-" を表示）
 * - details に reason がある場合 / ない場合
 * - ページネーション: 前へ / 次へ の表示制御
 */

import React from 'react'
import { render, screen } from '../utils/test-utils'

const mockGetAdminLogs = vi.fn()
vi.mock('@/lib/actions/admin/logs', () => ({
  getAdminLogs: (...args: unknown[]) => mockGetAdminLogs(...args),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import AdminLogsPage from '@/app/admin/logs/page'

// ============================================================
// ヘルパー: ログデータを生成
// ============================================================

function createLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    action: 'delete_post',
    targetType: 'post',
    targetId: 'target-id-12345678',
    details: null,
    createdAt: new Date('2026-01-15T10:30:00Z'),
    admin: {
      user: {
        id: 'admin-user-1',
        nickname: '管理者太郎',
      },
    },
    ...overrides,
  }
}

// ============================================================
// テスト
// ============================================================

describe('AdminLogsPage - 未カバー分岐のカバレッジ補強', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // 1. details が JSON 文字列で reason を持つ場合
  // ----------------------------------------------------------
  it('details が有効な JSON 文字列の場合、reason を表示する', async () => {
    const log = createLog({
      id: 'log-json-string',
      details: '{"reason":"スパム投稿のため削除"}',
    })
    mockGetAdminLogs.mockResolvedValueOnce({ logs: [log], total: 1 })

    const Component = await AdminLogsPage({
      searchParams: Promise.resolve({ action: '', page: '1' }),
    })
    render(Component)

    expect(screen.getByText('スパム投稿のため削除')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 2. details が無効な JSON 文字列の場合（catch ブロック）
  // ----------------------------------------------------------
  it('details が無効な JSON 文字列の場合、パースに失敗して "-" を表示する', async () => {
    const log = createLog({
      id: 'log-invalid-json',
      details: 'this is not valid json',
      targetId: 'abcdefgh12345678',
    })
    mockGetAdminLogs.mockResolvedValueOnce({ logs: [log], total: 1 })

    const Component = await AdminLogsPage({
      searchParams: Promise.resolve({ action: '', page: '1' }),
    })
    render(Component)

    // 詳細列は reason が取れないので "-" を表示する
    // テーブルの詳細列を確認
    const cells = screen.getAllByText('-')
    expect(cells.length).toBeGreaterThan(0)
  })

  // ----------------------------------------------------------
  // 3. targetId が null の場合
  // ----------------------------------------------------------
  it('targetId が null の場合、対象ID列に "-" を表示する', async () => {
    const log = createLog({
      id: 'log-no-target',
      targetId: null,
      details: { reason: '理由あり' },
    })
    mockGetAdminLogs.mockResolvedValueOnce({ logs: [log], total: 1 })

    const Component = await AdminLogsPage({
      searchParams: Promise.resolve({ action: '', page: '1' }),
    })
    render(Component)

    // reason テキストは表示される
    expect(screen.getByText('理由あり')).toBeInTheDocument()

    // targetId が null なので code 要素は存在しない
    const codeElements = document.querySelectorAll('code')
    expect(codeElements.length).toBe(0)
  })

  // ----------------------------------------------------------
  // 4. details がオブジェクトで reason を持つ場合
  // ----------------------------------------------------------
  it('details がオブジェクトで reason を持つ場合、reason を表示する', async () => {
    const log = createLog({
      id: 'log-obj-reason',
      details: { reason: 'テスト理由です' },
    })
    mockGetAdminLogs.mockResolvedValueOnce({ logs: [log], total: 1 })

    const Component = await AdminLogsPage({
      searchParams: Promise.resolve({ action: '', page: '1' }),
    })
    render(Component)

    expect(screen.getByText('テスト理由です')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 5. details がオブジェクトだが reason を持たない場合
  // ----------------------------------------------------------
  it('details がオブジェクトで reason がない場合、詳細列は "-" を表示する', async () => {
    const log = createLog({
      id: 'log-obj-no-reason',
      details: { action: 'some_action', note: 'メモ' },
    })
    mockGetAdminLogs.mockResolvedValueOnce({ logs: [log], total: 1 })

    const Component = await AdminLogsPage({
      searchParams: Promise.resolve({ action: '', page: '1' }),
    })
    render(Component)

    // reason がないので詳細列に "-" が表示される
    const cells = screen.getAllByText('-')
    expect(cells.length).toBeGreaterThan(0)
  })

  // NOTE: page/total ベースのページネーション UI はカーソル方式への移行に伴い
  // AdminLogsPage から削除されたため、該当 skip テストは削除済み。

  // ----------------------------------------------------------
  // 9. details が null かつ targetId ありの場合（基本表示確認）
  // ----------------------------------------------------------
  it('details が null の場合、詳細列に "-" を表示し targetId は code 要素で表示する', async () => {
    const log = createLog({
      id: 'log-null-details',
      details: null,
      targetId: 'abcdefgh12345678',
    })
    mockGetAdminLogs.mockResolvedValueOnce({ logs: [log], total: 1 })

    const Component = await AdminLogsPage({
      searchParams: Promise.resolve({ action: '', page: '1' }),
    })
    render(Component)

    // targetId は最初の8文字 + "..." で表示される
    const codeElement = document.querySelector('code')
    expect(codeElement).not.toBeNull()
    expect(codeElement?.textContent).toBe('abcdefgh...')
  })

  // ----------------------------------------------------------
  // 10. ログが0件の場合
  // ----------------------------------------------------------
  it('ログが0件の場合、「ログが見つかりません」を表示する', async () => {
    mockGetAdminLogs.mockResolvedValueOnce({ logs: [], total: 0 })

    const Component = await AdminLogsPage({
      searchParams: Promise.resolve({ action: '', page: '1' }),
    })
    render(Component)

    expect(screen.getByText('ログが見つかりません')).toBeInTheDocument()
  })

  // ----------------------------------------------------------
  // 11. details の reason が文字列以外（number）の場合
  // ----------------------------------------------------------
  it('details.reason が文字列以外の場合、詳細列に "-" を表示する', async () => {
    const log = createLog({
      id: 'log-reason-not-string',
      details: { reason: 12345 },
    })
    mockGetAdminLogs.mockResolvedValueOnce({ logs: [log], total: 1 })

    const Component = await AdminLogsPage({
      searchParams: Promise.resolve({ action: '', page: '1' }),
    })
    render(Component)

    // reason が数値なので typeof details.reason === 'string' は false → "-" を表示
    const cells = screen.getAllByText('-')
    expect(cells.length).toBeGreaterThan(0)
  })
})
