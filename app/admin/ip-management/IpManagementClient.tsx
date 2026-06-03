'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Search,
  Globe,
  Users,
  AlertTriangle,
  User,
} from 'lucide-react'

type DeviceRecord = {
  id: string
  ipAddress: string | null
  userId: string
  userAgent: string | null
  lastSeenAt: Date
  user: {
    id: string
    nickname: string
    email: string
    avatarUrl: string | null
    isSuspended: boolean
  } | null
}

type SuspiciousIp = {
  ipAddress: string
  userCount: number
  users: ({
    id: string
    nickname: string
    email: string
    avatarUrl: string | null
    isSuspended: boolean
    createdAt: Date
  } | undefined)[]
}

type IpManagementClientProps = {
  devices: DeviceRecord[]
  total: number
  suspiciousIps: SuspiciousIp[]
  search: string
}

/**
 * IPアドレス管理クライアントコンポーネント
 */
export function IpManagementClient({
  devices,
  total,
  suspiciousIps,
  search: initialSearch,
}: IpManagementClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState(initialSearch)

  /** 検索実行 */
  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    router.push(`/admin/ip-management?${params.toString()}`)
  }

  return (
    <div className="space-y-8">
      {suspiciousIps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-semibold">複数アカウント検出</h2>
            <span className="text-sm text-muted-foreground">
              ({suspiciousIps.length}件のIPアドレス)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suspiciousIps.map((item) => (
              <div
                key={item.ipAddress}
                className="bg-card rounded-lg border border-destructive/20 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-destructive" />
                  <span className="font-mono text-sm font-medium">{item.ipAddress}</span>
                  <span className="ml-auto px-2 py-0.5 text-xs bg-destructive/10 text-destructive rounded-full font-medium">
                    {item.userCount}アカウント
                  </span>
                </div>

                <div className="space-y-2">
                  {item.users.filter((u): u is NonNullable<typeof u> => !!u).map((user) => (
                    <Link
                      key={user.id}
                      href={`/admin/users/${user.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
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
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.nickname}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      {user.isSuspended && (
                        <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                          停止中
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          <h2 className="text-lg font-semibold">IPアドレス一覧</h2>
          <span className="text-sm text-muted-foreground">({total}件)</span>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="IPアドレスで検索..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            検索
          </button>
        </form>

        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">IPアドレス</th>
                  <th className="text-left px-4 py-3 font-medium">ユーザー</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">User Agent</th>
                  <th className="text-left px-4 py-3 font-medium">最終確認</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {devices.length > 0 ? (
                  devices.map((device, index) => (
                    <tr key={`${device.ipAddress}-${device.userId}-${index}`} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs">{device.ipAddress || '不明'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {device.user ? (
                          <Link
                            href={`/admin/users/${device.user.id}`}
                            className="flex items-center gap-2 hover:underline"
                          >
                            {device.user.avatarUrl ? (
                              <Image
                                src={device.user.avatarUrl}
                                alt={device.user.nickname}
                                width={24}
                                height={24}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                                <User className="w-3 h-3 text-muted-foreground" />
                              </div>
                            )}
                            <span className="text-sm">{device.user.nickname}</span>
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">不明</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                          {device.userAgent || '不明'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(device.lastSeenAt).toLocaleString('ja-JP')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
