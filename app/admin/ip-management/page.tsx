/**
 * @file 管理者用IPアドレス管理ページ
 * @description IPアドレスの一覧表示と、同一IPからの複数アカウント検出を行う管理者ページ。
 *              自作自演や不正アカウントの検出に使用する。
 * @route /admin/ip-management
 */

import { Suspense } from 'react'
import { getIpAddresses, detectMultiAccounts } from '@/lib/actions/admin/ip-management'
import { IpManagementClient } from './IpManagementClient'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

/**
 * ページメタデータの定義
 */
export const metadata = {
  title: 'IPアドレス管理 - BON-LOG 管理',
}

/**
 * 動的レンダリングを強制（常に最新データを表示）
 */
export const dynamic = 'force-dynamic'

/**
 * ページコンポーネントのProps型定義
 */
interface PageProps {
  searchParams: Promise<{
    search?: string
    cursor?: string
    trail?: string
  }>
}

/**
 * 管理者用IPアドレス管理ページコンポーネント
 * IPアドレス一覧と複数アカウント検出結果を表示する
 */
export default async function IpManagementPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ''
  const { cursor, trail } = parseAdminCursor(params)

  const [ipResult, multiAccountResult] = await Promise.all([
    getIpAddresses({ search: search || undefined, limit: DEFAULT_PAGE_LIMIT, cursor }),
    detectMultiAccounts(),
  ])

  const devices = 'devices' in ipResult ? ipResult.devices : []
  const total = 'total' in ipResult ? ipResult.total : 0
  const nextCursor = 'nextCursor' in ipResult ? ipResult.nextCursor : undefined
  const suspiciousIps = 'suspiciousIps' in multiAccountResult ? multiAccountResult.suspiciousIps : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">IPアドレス管理</h1>
      </div>

      <Suspense fallback={<div className="animate-pulse h-96 bg-muted rounded-lg" />}>
        <IpManagementClient
          devices={devices}
          total={total}
          suspiciousIps={suspiciousIps}
          search={search}
        />
      </Suspense>

      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        total={total}
        baseUrl="/admin/ip-management"
        filters={{ search }}
      />
    </div>
  )
}
