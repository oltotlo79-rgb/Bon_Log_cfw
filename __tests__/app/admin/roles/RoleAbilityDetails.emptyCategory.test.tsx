/**
 * app/admin/roles/RoleAbilityDetails.tsx
 *
 * `CATEGORY_ORDER.map` 内の `if (allowed.length === 0 && denied.length === 0) return null`
 * は、現行の ACTION_META（全カテゴリに >=1 アクションが定義されている）では
 * 実データ上到達できない防御的分岐。将来 ACTION_META からカテゴリのアクションが
 * すべて削除された場合に「空カテゴリの details を描画しない」という正しい
 * 防御的挙動を検証するため、getRoleCapabilities のみをモックしてこのケースを再現する。
 * ROLE_LABELS 等は実物を使い、コンポーネント自体はモックしない。
 */
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/admin-permissions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/admin-permissions')>(
    '@/lib/admin-permissions',
  )
  return {
    ...actual,
    getRoleCapabilities: (role: import('@prisma/client').AdminRole) => {
      const real = actual.getRoleCapabilities(role)
      // super_admin の 'system' カテゴリだけ空にして、防御的な early-return を誘発する
      if (role === 'super_admin') {
        return { ...real, system: { allowed: [], denied: [] } }
      }
      return real
    },
  }
})

import { RoleAbilityDetails } from '@/app/admin/roles/RoleAbilityDetails'

describe('RoleAbilityDetails - 空カテゴリの防御的分岐', () => {
  it('allowed/deniedが両方とも空のカテゴリはdetailsとして描画されない', () => {
    const { container } = render(<RoleAbilityDetails />)

    const superAdminArticle = container.querySelector(
      'article[aria-labelledby="role-super_admin-title"]',
    )
    expect(superAdminArticle).not.toBeNull()

    // system カテゴリの見出し（CATEGORY_LABELS.system）が super_admin カード内に存在しないこと
    const systemLabel = screen.getAllByText('システム設定').find((el) =>
      superAdminArticle?.contains(el),
    )
    expect(systemLabel).toBeUndefined()

    // 他ロール（admin 以下）は通常通り system カテゴリの details を持つ
    const adminArticle = container.querySelector('article[aria-labelledby="role-admin-title"]')
    const adminSystemLabel = screen.getAllByText('システム設定').find((el) =>
      adminArticle?.contains(el),
    )
    expect(adminSystemLabel).toBeDefined()
  })
})
