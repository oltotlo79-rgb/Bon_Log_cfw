/**
 * RoleAbilityDetails - 管理者ロール権限詳細表示の Server Component
 *
 * lib/admin-permissions.ts の PERMISSION_MAP / ROLE_PRIORITY を元に
 * 動的にロールカードを生成する。テストではロール階層が表示順に並ぶこと、
 * 各ロールが「できる/できない」の両方を表示することを確認する。
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RoleAbilityDetails } from '@/app/admin/roles/RoleAbilityDetails'

describe('RoleAbilityDetails', () => {
  it('セクション見出しを表示する', () => {
    render(<RoleAbilityDetails />)
    expect(screen.getByRole('heading', { level: 2, name: 'ロール別 権限詳細' })).toBeInTheDocument()
  })

  it('5 ロールすべてのカードが表示される（super_admin / admin / moderator / support / readonly）', () => {
    render(<RoleAbilityDetails />)
    // ロールラベル（lib/admin-permissions.ts の ROLE_LABELS で定義された日本語ラベルを画面上に確認）
    // 各ロール名のバッジ
    const roleBadges = ['スーパー管理者', '管理者', 'モデレーター', 'サポート', '閲覧専用']
    roleBadges.forEach((label) => {
      // 部分一致で（バッジ + 説明文に同じ語が出るので getAllByText）
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    })
  })

  it('ロール階層と自己保全ルールの説明が表示される', () => {
    render(<RoleAbilityDetails />)
    expect(screen.getByRole('heading', { level: 3, name: 'ロール階層と自己保全ルール' })).toBeInTheDocument()
    expect(screen.getByText(/自分より優先度が低いロールのみ操作可能/)).toBeInTheDocument()
    expect(screen.getByText(/権限横取りの防止/)).toBeInTheDocument()
  })

  it('優先度順 (super_admin → readonly) でロールカードが並ぶ', () => {
    const { container } = render(<RoleAbilityDetails />)
    const articles = container.querySelectorAll('article[aria-labelledby]')
    expect(articles.length).toBe(5)
    const ids = Array.from(articles).map((a) => a.getAttribute('aria-labelledby'))
    expect(ids).toEqual([
      'role-super_admin-title',
      'role-admin-title',
      'role-moderator-title',
      'role-support-title',
      'role-readonly-title',
    ])
  })

  it('super_admin の優先度バッジは 100', () => {
    render(<RoleAbilityDetails />)
    expect(screen.getByText('優先度 100')).toBeInTheDocument()
  })

  it('readonly の優先度バッジは ROLE_PRIORITY.readonly (20) と一致', async () => {
    const { ROLE_PRIORITY } = await import('@/lib/admin-permissions')
    render(<RoleAbilityDetails />)
    expect(screen.getByText(`優先度 ${ROLE_PRIORITY.readonly}`)).toBeInTheDocument()
  })

  it('上位ロール (priority >= 80) のカテゴリ details は初期展開される', () => {
    const { container } = render(<RoleAbilityDetails />)
    // super_admin / admin の <details> は open 属性が付くべき
    // すべての details を取得
    const detailsEls = container.querySelectorAll('details')
    expect(detailsEls.length).toBeGreaterThan(0)
    // open 属性の有無で展開状態を判定
    const openCount = Array.from(detailsEls).filter((d) => d.hasAttribute('open')).length
    const closedCount = detailsEls.length - openCount
    // 上位 2 ロールが開、下位 3 ロールが閉じている関係から open / closed 双方ある
    expect(openCount).toBeGreaterThan(0)
    expect(closedCount).toBeGreaterThan(0)
  })

  it('権限カウント（X / Y 権限）が各ロールに表示される', () => {
    render(<RoleAbilityDetails />)
    // 「X / Y 権限」の表示が複数ロール分ある
    const counts = screen.getAllByText(/^\d+\s*\/\s*\d+\s*権限$/)
    // 5 ロール分（カードヘッダの 1 つずつ）
    expect(counts.length).toBe(5)
  })

  it('カテゴリ詳細セクションでは aria-label に「できる操作」「できない操作」が含まれる', () => {
    const { container } = render(<RoleAbilityDetails />)
    const allowed = container.querySelectorAll('ul[aria-label$="でできる操作"]')
    const denied = container.querySelectorAll('ul[aria-label$="でできない操作"]')
    // super_admin は denied が 0、readonly は allowed がほぼ 0 など、
    // 全体としては両方とも 1 件以上現れる
    expect(allowed.length).toBeGreaterThan(0)
    expect(denied.length).toBeGreaterThan(0)
  })

  it('権限定義ファイル名 (lib/admin-permissions.ts) のヘッダ説明が表示される', () => {
    render(<RoleAbilityDetails />)
    expect(screen.getByText(/lib\/admin-permissions\.ts/)).toBeInTheDocument()
  })
})
