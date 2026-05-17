'use client'

import { useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { createSegment } from '@/lib/actions/admin/segments'

/**
 * セグメントルールの型定義
 */
export type SegmentRule = {
  field: 'createdAt' | 'postCount' | 'isPremium' | 'isSuspended' | 'location' | 'followerCount'
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains' | 'is'
  value: string | number | boolean
}

/** 利用可能なフィールドの定義 */
const FIELD_OPTIONS: { value: SegmentRule['field']; label: string }[] = [
  { value: 'createdAt', label: '登録日' },
  { value: 'isPremium', label: 'プレミアム' },
  { value: 'isSuspended', label: '停止中' },
  { value: 'location', label: '地域' },
  { value: 'postCount', label: '投稿数' },
  { value: 'followerCount', label: 'フォロワー数' },
]

/** フィールドに応じた利用可能な演算子 */
function getOperatorsForField(field: SegmentRule['field']): { value: SegmentRule['operator']; label: string }[] {
  switch (field) {
    case 'createdAt':
      return [
        { value: 'gt', label: 'より後' },
        { value: 'lt', label: 'より前' },
        { value: 'gte', label: '以降' },
        { value: 'lte', label: '以前' },
      ]
    case 'isPremium':
    case 'isSuspended':
      return [{ value: 'is', label: 'である' }]
    case 'location':
      return [
        { value: 'contains', label: 'を含む' },
        { value: 'eq', label: 'と一致' },
      ]
    case 'postCount':
    case 'followerCount':
      return [
        { value: 'gt', label: 'より大きい' },
        { value: 'lt', label: 'より小さい' },
        { value: 'gte', label: '以上' },
        { value: 'lte', label: '以下' },
        { value: 'eq', label: 'と等しい' },
      ]
    default:
      return [{ value: 'eq', label: '等しい' }]
  }
}

/** フィールドに応じた値の入力タイプ */
function getInputType(field: SegmentRule['field']): string {
  switch (field) {
    case 'createdAt':
      return 'date'
    case 'isPremium':
    case 'isSuspended':
      return 'boolean'
    case 'postCount':
    case 'followerCount':
      return 'number'
    default:
      return 'text'
  }
}

type SegmentCreateFormProps = {
  onCreated: () => void
}

/**
 * セグメント作成フォーム
 *
 * SegmentBuilderから抽出された独立コンポーネント。
 * フィールド・演算子・値を組み合わせた条件をAND/ORで結合してセグメントを定義する。
 */
export function SegmentCreateForm({ onCreated }: SegmentCreateFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState<SegmentRule[]>([
    { field: 'createdAt', operator: 'gte', value: '' },
  ])
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addRule() {
    setRules([...rules, { field: 'createdAt', operator: 'gte', value: '' }])
  }

  function removeRule(index: number) {
    if (rules.length <= 1) return
    setRules(rules.filter((_, i) => i !== index))
  }

  function updateRule(index: number, updates: Partial<SegmentRule>) {
    setRules(rules.map((rule, i) => {
      if (i !== index) return rule
      const updated = { ...rule, ...updates }
      if (updates.field && updates.field !== rule.field) {
        const operators = getOperatorsForField(updates.field)
        const first = operators[0]
        if (first) {
          updated.operator = first.value
          updated.value = ''
        }
      }
      return updated
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('セグメント名を入力してください')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const processedRules = rules.map(rule => {
      const inputType = getInputType(rule.field)
      let value: string | number | boolean = rule.value
      if (inputType === 'boolean') {
        value = rule.value === 'true' || rule.value === true
      } else if (inputType === 'number') {
        value = Number(rule.value)
      }
      return { ...rule, value }
    })

    const result = await createSegment({
      name: name.trim(),
      description: description.trim() || undefined,
      conditions: { rules: processedRules, logic },
    })

    setIsSubmitting(false)

    if (result && 'error' in result) {
      setError(result.error)
      return
    }

    onCreated()
  }

  return (
    <form onSubmit={handleCreate} className="bg-card rounded-lg border p-6 space-y-4">
      <h3 className="text-lg font-semibold">新しいセグメント</h3>

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
          {error}
        </div>
      )}

      {/* セグメント名 */}
      <div>
        <label className="block text-sm font-medium mb-1">セグメント名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: アクティブユーザー"
          className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>

      {/* 説明 */}
      <div>
        <label className="block text-sm font-medium mb-1">説明</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="このセグメントの説明..."
          rows={2}
          className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {/* ロジック切り替え */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">条件の結合:</span>
        <div className="flex rounded-lg border overflow-hidden">
          <button
            type="button"
            onClick={() => setLogic('AND')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              logic === 'AND'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted'
            }`}
          >
            AND (すべて)
          </button>
          <button
            type="button"
            onClick={() => setLogic('OR')}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              logic === 'OR'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted'
            }`}
          >
            OR (いずれか)
          </button>
        </div>
      </div>

      {/* ルールビルダー */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">条件</label>
        {rules.map((rule, index) => {
          const operators = getOperatorsForField(rule.field)
          const inputType = getInputType(rule.field)

          return (
            <div key={index} className="flex items-center gap-2 flex-wrap">
              {index > 0 && (
                <span className="text-xs font-medium text-muted-foreground w-10 text-center">
                  {logic}
                </span>
              )}

              <select
                value={rule.field}
                onChange={(e) => updateRule(index, { field: e.target.value as SegmentRule['field'] })}
                className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {FIELD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              <select
                value={rule.operator}
                onChange={(e) => updateRule(index, { operator: e.target.value as SegmentRule['operator'] })}
                className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {operators.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {inputType === 'boolean' ? (
                <select
                  value={String(rule.value)}
                  onChange={(e) => updateRule(index, { value: e.target.value })}
                  className="px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="true">はい</option>
                  <option value="false">いいえ</option>
                </select>
              ) : (
                <input
                  type={inputType}
                  value={String(rule.value)}
                  onChange={(e) => updateRule(index, { value: e.target.value })}
                  placeholder="値を入力..."
                  className="flex-1 min-w-[120px] px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}

              {rules.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="p-2 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={addRule}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Plus className="w-3.5 h-3.5" />
          条件を追加
        </button>
      </div>

      {/* 送信 */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          作成
        </button>
      </div>
    </form>
  )
}
