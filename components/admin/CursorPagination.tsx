import Link from 'next/link'
import { buildAdminQueryString } from '@/lib/utils/admin-cursor'

type Props = {
  /** 現在のページの cursor（先頭ページでは undefined） */
  cursor: string | undefined
  /** 過去に経由した cursor のリスト（古い順） */
  trail: string[]
  /** サーバーから返された次ページの cursor。undefined なら次ページなし */
  nextCursor: string | undefined
  /** 総件数（表示用。カウントが取得できない場合は undefined） */
  total?: number
  /** ページのベースパス（例: "/admin/logs"） */
  baseUrl: string
  /** cursor/trail 以外で URL に保持したいフィルタパラメータ */
  filters?: Record<string, string | undefined>
}

/**
 * 管理画面用の「前へ / 次へ」ナビゲーション。
 *
 * - 戻る: `trail` の末尾を pop して cursor に戻す
 * - 進む: 現在の cursor を trail に push し、nextCursor を新 cursor に
 * - 先頭ページでは「前へ」を非表示
 * - 次ページがない時は「次へ」を非表示
 */
export function CursorPagination({ cursor, trail, nextCursor, total, baseUrl, filters }: Props) {
  const isFirstPage = cursor === undefined
  const hasNext = nextCursor !== undefined

  // 「前へ」: trail 末尾を pop → cursor に
  const prevHref = !isFirstPage
    ? `${baseUrl}${buildAdminQueryString({
        ...filters,
        cursor: trail.length > 0 ? trail[trail.length - 1] : undefined,
        trail: trail.slice(0, -1).join(',') || undefined,
      })}`
    : null

  // 「次へ」: 現 cursor を trail に push → nextCursor に
  const nextHref = hasNext
    ? `${baseUrl}${buildAdminQueryString({
        ...filters,
        cursor: nextCursor,
        trail: [...trail, cursor || ''].filter(Boolean).join(',') || undefined,
      })}`
    : null

  if (!prevHref && !nextHref && total === undefined) return null

  return (
    <div className="flex items-center justify-center gap-4">
      {prevHref ? (
        <Link href={prevHref} className="px-3 py-1 border rounded hover:bg-muted">
          前へ
        </Link>
      ) : (
        <span className="px-3 py-1 border rounded text-muted-foreground cursor-not-allowed opacity-50">
          前へ
        </span>
      )}

      {total !== undefined && (
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      )}

      {nextHref ? (
        <Link href={nextHref} className="px-3 py-1 border rounded hover:bg-muted">
          次へ
        </Link>
      ) : (
        <span className="px-3 py-1 border rounded text-muted-foreground cursor-not-allowed opacity-50">
          次へ
        </span>
      )}
    </div>
  )
}
