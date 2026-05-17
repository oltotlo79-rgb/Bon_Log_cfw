'use client'

/**
 * @file 農薬テーブルコンポーネント
 * @description 農薬データの検索・フィルタリング・ページネーション付きテーブルと削除機能を提供するClient Component。
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Filter,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FlaskConical,
} from 'lucide-react'
import { deletePesticide } from '@/lib/actions/admin/pesticide-data'
import { ROUTE_ADMIN_PESTICIDE_DATA } from '@/lib/constants/routes'

/** 農薬アイテムの型定義 */
interface PesticideItem {
  id: string
  name: string
  registrationNumber: string | null
  pesticideType: string
  formulationName: string | null
  effectsCount: number
  ingredientsCount: number
  updatedAt: string
}

/** コンポーネントのProps型定義 */
interface PesticideTableProps {
  /** 農薬一覧 */
  pesticides: PesticideItem[]
  /** 現在の検索キーワード */
  search: string
  /** 現在の農薬種別フィルター */
  pesticideType: string
}

/** 農薬種別の日本語ラベル */
const PESTICIDE_TYPE_LABELS: Record<string, string> = {
  fungicide: '殺菌剤',
  insecticide: '殺虫剤',
  acaricide: '殺ダニ剤',
  compound: '複合剤',
  other: 'その他',
}

/** 農薬種別のバッジ色 */
const PESTICIDE_TYPE_COLORS: Record<string, string> = {
  fungicide: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  insecticide: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  acaricide: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  compound: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
}

/**
 * 農薬テーブルコンポーネント
 * 検索・フィルタリング・ページネーション・削除機能を提供する
 */
export function PesticideTable({
  pesticides,
  search,
  pesticideType,
}: PesticideTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [searchInput, setSearchInput] = useState(search)
  const [typeFilter, setTypeFilter] = useState(pesticideType)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /** URLパラメータを更新してページ遷移（フィルター変更時は先頭ページへ） */
  function applyFilters() {
    const params = new URLSearchParams()
    if (searchInput) params.set('search', searchInput)
    if (typeFilter) params.set('pesticideType', typeFilter)
    const qs = params.toString()
    startTransition(() => {
      router.push(`${ROUTE_ADMIN_PESTICIDE_DATA}${qs ? `?${qs}` : ''}`)
    })
  }

  /** フィルターをリセット */
  function resetFilters() {
    setSearchInput('')
    setTypeFilter('')
    startTransition(() => {
      router.push(ROUTE_ADMIN_PESTICIDE_DATA)
    })
  }

  /** 農薬を削除 */
  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除してもよろしいですか？この操作は取り消せません。`)) {
      return
    }
    setDeletingId(id)
    try {
      const result = await deletePesticide(id)
      if (result && 'error' in result) {
        alert(result.error)
      } else {
        startTransition(() => {
          router.refresh()
        })
      }
    } finally {
      setDeletingId(null)
    }
  }

  /** 日付をフォーマット */
  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">農薬一覧</h2>
        <Link
          href="/admin/pesticide-data/new"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          農薬を追加
        </Link>
      </div>

      {/* フィルター */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* 検索 */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="農薬名・登録番号で検索"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="w-full text-sm border rounded-md pl-8 pr-3 py-1.5 bg-background"
          />
        </div>

        {/* 種別フィルター */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm border rounded-md px-3 py-1.5 bg-background"
          >
            <option value="">全ての種別</option>
            <option value="insecticide">殺虫剤</option>
            <option value="fungicide">殺菌剤</option>
            <option value="acaricide">殺ダニ剤</option>
            <option value="compound">複合剤</option>
            <option value="other">その他</option>
          </select>
        </div>

        {/* フィルターボタン */}
        <button
          onClick={() => applyFilters()}
          disabled={isPending}
          className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '検索'}
        </button>

        <button
          onClick={resetFilters}
          disabled={isPending}
          className="text-sm border px-4 py-1.5 rounded-md hover:bg-muted disabled:opacity-50"
        >
          リセット
        </button>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">農薬名</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">登録番号</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">種別</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">剤型</th>
              <th className="text-center py-2 px-3 font-medium text-muted-foreground">効果</th>
              <th className="text-center py-2 px-3 font-medium text-muted-foreground">成分</th>
              <th className="text-left py-2 px-3 font-medium text-muted-foreground">更新日</th>
              <th className="text-right py-2 px-3 font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {pesticides.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  該当する農薬データはありません
                </td>
              </tr>
            ) : (
              pesticides.map((pesticide) => (
                <tr key={pesticide.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 px-3">
                    <Link
                      href={`/admin/pesticide-data/${pesticide.id}`}
                      className="font-medium hover:underline"
                    >
                      {pesticide.name}
                    </Link>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">
                    {pesticide.registrationNumber || '-'}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      PESTICIDE_TYPE_COLORS[pesticide.pesticideType] || PESTICIDE_TYPE_COLORS.other
                    }`}>
                      {PESTICIDE_TYPE_LABELS[pesticide.pesticideType] || pesticide.pesticideType}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground">
                    {pesticide.formulationName || '-'}
                  </td>
                  <td className="py-2 px-3 text-center">{pesticide.effectsCount}</td>
                  <td className="py-2 px-3 text-center">{pesticide.ingredientsCount}</td>
                  <td className="py-2 px-3 text-muted-foreground">{formatDate(pesticide.updatedAt)}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/pesticide-data/${pesticide.id}`}
                        className="p-1.5 hover:bg-muted rounded-md transition-colors"
                        title="編集"
                      >
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Link>
                      <button
                        onClick={() => handleDelete(pesticide.id, pesticide.name)}
                        disabled={deletingId === pesticide.id}
                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
                        title="削除"
                      >
                        {deletingId === pesticide.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  )
}
