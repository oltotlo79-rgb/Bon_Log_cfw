'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  Users,
  Calendar,
  Filter,
  X,
  Loader2,
} from 'lucide-react'
import { deleteSegment, evaluateSegment } from '@/lib/actions/admin/segments'
import { SegmentCreateForm } from './SegmentCreateForm'

type Segment = {
  id: string
  name: string
  description: string | null
  conditions: unknown
  createdAt: Date
  createdBy: string | null
}

type SegmentBuilderProps = {
  segments: Segment[]
}

function getRuleCount(conditions: unknown): number {
  if (conditions && typeof conditions === 'object' && 'rules' in conditions) {
    const cond = conditions as { rules: unknown[] }
    return Array.isArray(cond.rules) ? cond.rules.length : 0
  }
  return 0
}

/**
 * セグメントビルダーコンポーネント
 */
export function SegmentBuilder({ segments }: SegmentBuilderProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [evaluating, setEvaluating] = useState<string | null>(null)
  const [evaluateResults, setEvaluateResults] = useState<Record<string, number>>({})

  /** セグメント削除 */
  async function handleDelete(id: string) {
    if (!confirm('このセグメントを削除しますか?')) return
    await deleteSegment(id)
    router.refresh()
  }

  /** セグメント評価（該当ユーザー数を取得） */
  async function handleEvaluate(id: string) {
    setEvaluating(id)
    const result = await evaluateSegment(id)
    if (result && 'count' in result) {
      setEvaluateResults(prev => ({ ...prev, [id]: result.count }))
    }
    setEvaluating(null)
  }

  /** フォーム作成完了ハンドラ */
  function handleCreated() {
    setShowForm(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
        >
          {showForm ? (
            <>
              <X className="w-4 h-4" />
              キャンセル
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              セグメント作成
            </>
          )}
        </button>
      </div>

      {showForm && (
        <SegmentCreateForm
          onCreated={handleCreated}
        />
      )}

      <div className="bg-card rounded-lg border">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Filter className="w-4 h-4" />
          <h3 className="font-semibold">セグメント一覧</h3>
          <span className="text-sm text-muted-foreground">({segments.length}件)</span>
        </div>

        {segments.length > 0 ? (
          <div className="divide-y">
            {segments.map((segment) => {
              const ruleCount = getRuleCount(segment.conditions)

              return (
                <div key={segment.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium">{segment.name}</h4>
                      {segment.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {segment.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Filter className="w-3 h-3" />
                          条件: {ruleCount}件
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(segment.createdAt).toLocaleDateString('ja-JP')}
                        </span>
                        {evaluateResults[segment.id] !== undefined && (
                          <span className="inline-flex items-center gap-1 text-primary font-medium">
                            <Users className="w-3 h-3" />
                            該当: {evaluateResults[segment.id]}人
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleEvaluate(segment.id)}
                        disabled={evaluating === segment.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-muted disabled:opacity-50"
                      >
                        {evaluating === segment.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Users className="w-3.5 h-3.5" />
                        )}
                        評価
                      </button>

                      <button
                        onClick={() => handleDelete(segment.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="p-8 text-center text-muted-foreground">
            セグメントがありません
          </p>
        )}
      </div>

    </div>
  )
}
