'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { restoreContent, deleteHiddenContent } from '@/lib/actions/admin/hidden'
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  type ContentType,
} from '@/lib/constants/report'
import { useToast } from '@/hooks/use-toast'

interface HiddenItem {
  type: ContentType
  id: string
  content: string | null
  createdBy: { id: string; nickname: string; avatarUrl: string | null }
  hiddenAt: Date | null
  reportCount: number
}

export function HiddenContentList({ items }: { items: HiddenItem[] }) {
  const { toast } = useToast()
  const [filter, setFilter] = useState<ContentType | 'all'>('all')
  const [processingId, setProcessingId] = useState<string | null>(null)

  const filteredItems = filter === 'all'
    ? items
    : items.filter((item: HiddenItem) => item.type === filter)

  async function handleRestore(type: ContentType, id: string) {
    if (!confirm('このコンテンツを再表示しますか？')) return

    setProcessingId(id)
    try {
      const result = await restoreContent(type, id)
      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' })
      }
    } finally {
      setProcessingId(null)
    }
  }

  async function handleDelete(type: ContentType, id: string) {
    if (!confirm('このコンテンツを完全に削除しますか？この操作は取り消せません。')) return

    setProcessingId(id)
    try {
      const result = await deleteHiddenContent(type, id)
      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' })
      }
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          すべて ({items.length})
        </Button>
        {(['post', 'comment', 'event', 'shop', 'review'] as const).map((type) => {
          const count = items.filter((item: HiddenItem) => item.type === type).length
          if (count === 0) return null
          return (
            <Button
              key={type}
              variant={filter === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(type)}
            >
              {CONTENT_TYPE_LABELS[type]} ({count})
            </Button>
          )
        })}
      </div>

      <div className="space-y-4">
        {filteredItems.map((item: HiddenItem) => (
          <div key={`${item.type}-${item.id}`} className="bg-card border rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CONTENT_TYPE_COLORS[item.type]}`}>
                    {CONTENT_TYPE_LABELS[item.type]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    通報数: {item.reportCount}件
                  </span>
                </div>

                <p className="text-sm mb-2 line-clamp-3">
                  {item.content || '(内容なし)'}
                </p>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>作成者: {item.createdBy.nickname}</span>
                  <span>|</span>
                  <span>
                    非表示: {item.hiddenAt
                      ? new Date(item.hiddenAt).toLocaleString('ja-JP')
                      : '不明'
                    }
                  </span>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRestore(item.type, item.id)}
                  disabled={processingId === item.id}
                >
                  {processingId === item.id ? '処理中...' : '再表示'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(item.type, item.id)}
                  disabled={processingId === item.id}
                >
                  {processingId === item.id ? '処理中...' : '削除'}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          該当するコンテンツはありません
        </div>
      )}
    </div>
  )
}
