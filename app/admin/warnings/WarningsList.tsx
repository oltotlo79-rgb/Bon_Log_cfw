'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { deactivateWarning } from '@/lib/actions/admin/warnings'
import { IssueWarningDialog } from './IssueWarningDialog'
import { buildUserPath } from '@/lib/constants/path-builders'
import { useToast } from '@/hooks/use-toast'

/** 警告レベルの日本語ラベル */
const levelLabels: Record<string, string> = {
  notice: '注意',
  warning: '警告',
  temp_suspend: '一時停止',
  permanent_ban: '永久BAN',
}

/** 警告レベルのバッジ色クラス */
const levelColors: Record<string, string> = {
  notice: 'bg-blue-100 text-blue-800',
  warning: 'bg-amber-100 text-amber-800',
  temp_suspend: 'bg-orange-100 text-orange-800',
  permanent_ban: 'bg-red-100 text-red-800',
}

/** 警告データの型 */
interface Warning {
  id: string
  userId: string
  level: string
  reason: string
  isActive: boolean
  expiresAt: Date | string | null
  createdAt: Date | string
  user: {
    id: string
    nickname: string
    email: string
    avatarUrl: string | null
  }
}

/** WarningsListコンポーネントのProps型 */
interface WarningsListProps {
  /** 警告一覧データ */
  warnings: Warning[]
  /** 総件数 */
  total: number
  /** 有効な警告数 */
  activeWarnings: number
  /** レベル別カウント */
  levelCounts: Record<string, number>
  /** フィルター: レベル */
  currentLevel?: string
  /** フィルター: 有効/無効 */
  currentIsActive?: string
  /** フィルター: 検索クエリ */
  currentSearch?: string
}

/**
 * 警告管理のメインコンポーネント
 * 統計カード、フィルター、テーブル、警告発行ダイアログを表示する。
 * ページネーションは親の page.tsx 側で <CursorPagination> として描画される。
 */
export function WarningsList({
  warnings,
  total,
  activeWarnings,
  levelCounts,
  currentLevel,
  currentIsActive,
  currentSearch,
}: WarningsListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  /** 警告を無効化する */
  const handleDeactivate = async (warningId: string) => {
    setDeactivatingId(warningId)
    const result = await deactivateWarning(warningId)
    setDeactivatingId(null)

    if (!result.success) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    toast({ title: '警告を無効化しました' })
    router.refresh()
  }

  /** 日付をフォーマットする */
  const formatDate = (date: Date | string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">警告管理</h1>
        <button
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          警告を発行
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">総警告数</p>
          <p className="text-2xl font-bold">{total}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">有効な警告</p>
          <p className="text-2xl font-bold text-orange-600">{activeWarnings}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">注意</p>
          <p className="text-2xl font-bold text-blue-600">{levelCounts.notice || 0}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">警告</p>
          <p className="text-2xl font-bold text-amber-600">{levelCounts.warning || 0}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">一時停止</p>
          <p className="text-2xl font-bold text-orange-600">{levelCounts.temp_suspend || 0}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">永久BAN</p>
          <p className="text-2xl font-bold text-red-600">{levelCounts.permanent_ban || 0}</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <form className="flex flex-wrap gap-4">
          <select
            name="level"
            defaultValue={currentLevel || ''}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">全レベル</option>
            <option value="notice">注意</option>
            <option value="warning">警告</option>
            <option value="temp_suspend">一時停止</option>
            <option value="permanent_ban">永久BAN</option>
          </select>

          <select
            name="isActive"
            defaultValue={currentIsActive || ''}
            className="px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">全ステータス</option>
            <option value="true">有効</option>
            <option value="false">無効</option>
          </select>

          <input
            name="search"
            type="text"
            placeholder="ユーザー検索（ニックネーム/メール）"
            defaultValue={currentSearch || ''}
            className="px-3 py-2 border rounded-lg bg-background min-w-[240px]"
          />

          <button
            type="submit"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            フィルター
          </button>
        </form>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium">ユーザー</th>
              <th className="text-left px-4 py-3 text-sm font-medium">レベル</th>
              <th className="text-left px-4 py-3 text-sm font-medium">理由</th>
              <th className="text-left px-4 py-3 text-sm font-medium">発行日</th>
              <th className="text-left px-4 py-3 text-sm font-medium">有効期限</th>
              <th className="text-left px-4 py-3 text-sm font-medium">ステータス</th>
              <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {warnings.map((warning) => (
              <tr key={warning.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link
                    href={buildUserPath(warning.user.id)}
                    className="flex items-center gap-2 hover:underline"
                  >
                    {warning.user.avatarUrl ? (
                      <Image
                        src={warning.user.avatarUrl}
                        alt={warning.user.nickname}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-muted rounded-full" />
                    )}
                    <div>
                      <span className="text-sm block">{warning.user.nickname}</span>
                      <span className="text-xs text-muted-foreground">{warning.user.email}</span>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${levelColors[warning.level] || 'bg-muted text-muted-foreground'}`}>
                    {levelLabels[warning.level] || warning.level}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm line-clamp-2 max-w-[300px]">
                    {warning.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(warning.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(warning.expiresAt)}
                </td>
                <td className="px-4 py-3">
                  {warning.isActive ? (
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                      有効
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
                      無効
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {warning.isActive ? (
                    <button
                      onClick={() => handleDeactivate(warning.id)}
                      disabled={deactivatingId === warning.id}
                      className="px-3 py-1 text-xs border rounded-lg hover:bg-muted disabled:opacity-50"
                    >
                      {deactivatingId === warning.id ? '処理中...' : '無効化'}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))}

            {warnings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  警告が見つかりません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <IssueWarningDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  )
}
