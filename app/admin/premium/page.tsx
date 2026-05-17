import Link from 'next/link'
import Image from 'next/image'
import { Crown as CrownIcon, Search as SearchIcon } from 'lucide-react'
import { getPremiumUsers, getPremiumStats, getAdminPremiumStatus } from '@/lib/actions/admin/premium'
import { PremiumActionsDropdown } from './PremiumActionsDropdown'
import { AdminPremiumToggle } from './AdminPremiumToggle'
import {
  DEFAULT_PAGE_LIMIT,
  PREMIUM_EXPIRING_WARN_DAYS,
  ONE_DAY_MS,
} from '@/lib/constants/limits'
import { ROUTE_ADMIN_PREMIUM } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

export const metadata = {
  title: 'プレミアム会員管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    search?: string
    cursor?: string
    trail?: string
  }>
}

export default async function AdminPremiumPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ''
  const { cursor, trail } = parseAdminCursor(params)

  const [usersResult, statsResult, adminStatusResult] = await Promise.all([
    getPremiumUsers({ search: search || undefined, limit: DEFAULT_PAGE_LIMIT, cursor }),
    getPremiumStats(),
    getAdminPremiumStatus(),
  ])

  const users = 'error' in usersResult ? [] : usersResult.users
  const total = 'error' in usersResult ? 0 : usersResult.total
  const nextCursor = 'error' in usersResult ? undefined : usersResult.nextCursor
  const stats = 'error' in statsResult ? null : statsResult
  const adminStatus = 'error' in adminStatusResult ? null : adminStatusResult

  // 期限判定はレンダー外で 1 回だけ計算する (各行で `new Date()` を作らないため)。
  const now = new Date()
  const expiryWarningThreshold = new Date(now.getTime() + PREMIUM_EXPIRING_WARN_DAYS * ONE_DAY_MS)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CrownIcon className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">プレミアム会員管理</h1>
        </div>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      {adminStatus && (
        <AdminPremiumToggle isPremium={adminStatus.isPremium} />
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">総プレミアム会員</p>
            <p className="text-2xl font-bold">{stats.totalPremiumUsers}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">今月の新規</p>
            <p className="text-2xl font-bold">{stats.newThisMonth}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{PREMIUM_EXPIRING_WARN_DAYS}日以内に期限切れ</p>
            <p className="text-2xl font-bold text-muted-foreground">{stats.expiringIn7Days}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">総売上（概算）</p>
            <p className="text-2xl font-bold">¥{(stats.totalRevenue || 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border p-4">
        <form className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                placeholder="ニックネーム・メールアドレスで検索"
                defaultValue={search}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            検索
          </button>
        </form>
      </div>

      <div className="bg-card rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">ユーザー</th>
              <th className="text-left px-4 py-3 text-sm font-medium">メール</th>
              <th className="text-left px-4 py-3 text-sm font-medium">プレミアム開始</th>
              <th className="text-left px-4 py-3 text-sm font-medium">有効期限</th>
              <th className="text-left px-4 py-3 text-sm font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((user: typeof users[number]) => {
              const isExpiringSoon = user.premiumExpiresAt &&
                new Date(user.premiumExpiresAt) < expiryWarningThreshold
              const isExpired = user.premiumExpiresAt &&
                new Date(user.premiumExpiresAt) < now

              return (
                <tr key={user.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={buildUserPath(user.id)}
                      className="flex items-center gap-3 hover:underline"
                    >
                      {user.avatarUrl ? (
                        <Image
                          src={user.avatarUrl}
                          alt={user.nickname}
                          width={32}
                          height={32}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-muted rounded-full" />
                      )}
                      <span className="font-medium">{user.nickname}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ja-JP') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {user.premiumExpiresAt ? (
                      <span className={isExpiringSoon ? 'text-muted-foreground font-medium' : ''}>
                        {new Date(user.premiumExpiresAt).toLocaleDateString('ja-JP')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">無期限</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isExpired ? (
                      <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                        期限切れ
                      </span>
                    ) : user.stripeSubscriptionId ? (
                      <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                        Stripe連携
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded-full">
                        手動付与
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <PremiumActionsDropdown
                      userId={user.id}
                      userName={user.nickname}
                      isPremium={user.isPremium}
                      premiumExpiresAt={user.premiumExpiresAt}
                    />
                  </td>
                </tr>
              )
            })}

            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  プレミアム会員が見つかりません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        baseUrl={ROUTE_ADMIN_PREMIUM}
        filters={{ search }}
      />
    </div>
  )
}
