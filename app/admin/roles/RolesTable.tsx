'use client'


import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { updateAdminRole, removeAdmin, addAdmin } from '@/lib/actions/admin/roles'
import { ROLE_LABELS } from '@/lib/admin-permissions'
import type { AdminRole } from '@prisma/client'
import {
  UserPlus,
  Trash2,
  Loader2,
} from 'lucide-react'

type AdminUser = {
  userId: string
  role: AdminRole
  createdAt: string
  user: {
    id: string
    nickname: string
    email: string
    avatarUrl: string | null
  }
}

/** ロールバッジの色（ダークモード対応） */
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  moderator: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  support: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  readonly: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400',
}

/** 日本語ラベル */
const ROLE_LABELS_JA: Record<string, string> = {
  super_admin: 'スーパー管理者',
  admin: '管理者',
  moderator: 'モデレーター',
  support: 'サポート',
  readonly: '閲覧専用',
}

const ROLES: AdminRole[] = ['super_admin', 'admin', 'moderator', 'support', 'readonly']

/** 文字列を AdminRole に安全に絞り込む型ガード */
function isAdminRole(value: string): value is AdminRole {
  return (ROLES as readonly string[]).includes(value)
}

export default function RolesTable({ admins }: { admins: AdminUser[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState<AdminRole>('readonly')
  const [error, setError] = useState<string | null>(null)

  const handleRoleChange = (userId: string, role: AdminRole) => {
    setLoadingId(userId)
    setError(null)
    startTransition(async () => {
      const result = await updateAdminRole(userId, role)
      if (result && 'error' in result) {
        setError(result.error)
      }
      setLoadingId(null)
      router.refresh()
    })
  }

  const handleRemove = (userId: string) => {
    if (!confirm('この管理者の権限を削除しますか?')) return
    setLoadingId(userId)
    setError(null)
    startTransition(async () => {
      const result = await removeAdmin(userId)
      if (result && 'error' in result) {
        setError(result.error)
      }
      setLoadingId(null)
      router.refresh()
    })
  }

  const handleAdd = () => {
    if (!newUserId.trim()) return
    setLoadingId('new')
    setError(null)
    startTransition(async () => {
      const result = await addAdmin(newUserId.trim(), newRole)
      if (result && 'error' in result) {
        setError(result.error)
      } else {
        setNewUserId('')
      }
      setLoadingId(null)
      router.refresh()
    })
  }

  return (
    <div>
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">ユーザー</th>
              <th className="px-4 py-3 font-medium">メール</th>
              <th className="px-4 py-3 font-medium">ロール</th>
              <th className="px-4 py-3 font-medium">追加日</th>
              <th className="px-4 py-3 font-medium text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((admin) => (
              <tr key={admin.userId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {admin.user.avatarUrl ? (
                      <Image
                        src={admin.user.avatarUrl}
                        alt="管理者アバター"
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {admin.user.nickname[0]}
                      </div>
                    )}
                    <span className="font-medium">{admin.user.nickname}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {admin.user.email}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[admin.role]}`}>
                    {ROLE_LABELS_JA[admin.role] || ROLE_LABELS[admin.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(admin.createdAt).toLocaleDateString('ja-JP')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <select
                      value={admin.role}
                      onChange={(e) => {
                        if (isAdminRole(e.target.value)) {
                          handleRoleChange(admin.userId, e.target.value)
                        }
                      }}
                      disabled={loadingId === admin.userId || isPending}
                      className="text-xs rounded-lg border px-2 py-1.5 bg-background text-foreground"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS_JA[r] || ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemove(admin.userId)}
                      disabled={loadingId === admin.userId || isPending}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors disabled:opacity-50"
                      title="管理者から削除"
                    >
                      {loadingId === admin.userId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {admins.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  管理者がいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t">
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <UserPlus className="w-4 h-4" />
          管理者を追加
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="ユーザーID"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] bg-background text-foreground"
          />
          <select
            value={newRole}
            onChange={(e) => {
              if (isAdminRole(e.target.value)) setNewRole(e.target.value)
            }}
            className="border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS_JA[r] || ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={loadingId === 'new' || isPending}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loadingId === 'new' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            追加
          </button>
        </div>
      </div>
    </div>
  )
}
