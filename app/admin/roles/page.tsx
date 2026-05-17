/**
 * @file 管理者ロール管理ページ
 * @description 管理者ユーザーの一覧表示・ロール変更・追加・削除を行う管理者ページ。
 * @route /admin/roles
 */

import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getAdminRoles } from '@/lib/actions/admin/roles'
import { ROLE_LABELS } from '@/lib/admin-permissions'
import type { AdminRole } from '@prisma/client'
import RolesTable from './RolesTable'
import { RoleAbilityDetails } from './RoleAbilityDetails'
import { Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '管理者ロール管理 - BON-LOG 管理',
}

/** ロールバッジの色（ダークモード対応） */
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  moderator: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  support: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  readonly: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400',
}

export default async function RolesPage() {
  const result = await getAdminRoles()

  if ('error' in result) {
    redirect(ROUTE_LOGIN)
  }

  const { admins } = result

  // ロール別の人数集計
  const roleCounts = admins.reduce<Record<string, number>>((acc, a) => {
    acc[a.role] = (acc[a.role] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6" />
        <div>
          <h1 className="text-2xl font-bold">管理者ロール管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理者の権限レベルを管理します
          </p>
        </div>
      </div>

      {/* ロール集計サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {(Object.entries(ROLE_LABELS) as [AdminRole, string][]).map(([role, label]) => (
          <div key={role} className="rounded-lg border bg-card p-3 text-center">
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[role]}`}>
              {label}
            </span>
            <p className="text-xs text-muted-foreground mt-2">
              {role === 'super_admin' && '全権限'}
              {role === 'admin' && '全権限'}
              {role === 'moderator' && 'モデレーション・ユーザー管理'}
              {role === 'support' && 'お問い合わせ・閲覧'}
              {role === 'readonly' && '閲覧のみ'}
            </p>
            <p className="text-lg font-bold mt-1">{roleCounts[role] || 0}</p>
          </div>
        ))}
      </div>

      {/* ロール別の権限詳細（できる/できないをカテゴリ別に表示） */}
      <RoleAbilityDetails />

      {/* 管理者一覧 */}
      <div className="rounded-lg border bg-card">
        <div className="p-4 border-b">
          <h2 className="font-semibold">管理者一覧（{admins.length}名）</h2>
        </div>
        <RolesTable admins={JSON.parse(JSON.stringify(admins))} />
      </div>
    </div>
  )
}
