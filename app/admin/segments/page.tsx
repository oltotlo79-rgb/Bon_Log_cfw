import { Suspense } from 'react'
import { getSegments } from '@/lib/actions/admin/segments'
import { SegmentBuilder } from './SegmentBuilder'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

export const metadata = {
  title: 'ユーザーセグメント - BON-LOG 管理',
}

/**
 * 動的レンダリングを強制
 */
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    cursor?: string
    trail?: string
  }>
}

/**
 * 管理者用ユーザーセグメント管理ページコンポーネント
 */
export default async function SegmentsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { cursor, trail } = parseAdminCursor(params)

  const result = await getSegments({ limit: DEFAULT_PAGE_LIMIT, cursor })

  const segments = 'segments' in result ? result.segments : []
  const total = 'total' in result ? result.total : 0
  const nextCursor = 'nextCursor' in result ? result.nextCursor : undefined

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ユーザーセグメント</h1>
      </div>

      <Suspense fallback={<div className="animate-pulse h-96 bg-muted rounded-lg" />}>
        <SegmentBuilder segments={segments} />
      </Suspense>

      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        total={total}
        baseUrl="/admin/segments"
      />
    </div>
  )
}
