'use client'

import { useState } from 'react'
import type { ImportableEvent } from '@/lib/actions/event-import'
import { PREFECTURES } from '@/lib/prefectures'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  MAX_EVENT_TITLE_LENGTH,
  MAX_EVENT_FIELD_LENGTH,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_URL_LENGTH,
} from '@/lib/constants/limits'

type EventEditFormModalProps = {
  event: ImportableEvent | null
  onSave: (event: ImportableEvent) => void
  onClose: () => void
}

/**
 * イベント編集モーダル
 *
 * EventImportClientから抽出された独立コンポーネント。
 * スクレイピングで取得したイベント情報を個別に編集するためのフォームを提供する。
 */
export function EventEditFormModal({ event, onSave, onClose }: EventEditFormModalProps) {
  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>イベント情報を編集</DialogTitle>
        </DialogHeader>
        {event && (
          <EventEditForm
            event={event}
            onSave={onSave}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * イベント編集フォーム（モーダル内部）
 */
function EventEditForm({
  event,
  onSave,
  onCancel,
}: {
  event: ImportableEvent
  onSave: (event: ImportableEvent) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState<ImportableEvent>(event)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const updateField = <K extends keyof ImportableEvent>(
    field: K,
    value: ImportableEvent[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const formatDateForInput = (dateStr: string | null): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toISOString().slice(0, 10)
  }

  const parseDateInput = (value: string): string | null => {
    if (!value) return null
    return new Date(value).toISOString()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">タイトル *</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => updateField('title', e.target.value)}
          required
          maxLength={MAX_EVENT_TITLE_LENGTH}
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">開始日 *</label>
          <input
            type="date"
            value={formatDateForInput(formData.startDate)}
            onChange={(e) => updateField('startDate', parseDateInput(e.target.value))}
            required
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">終了日</label>
          <input
            type="date"
            value={formatDateForInput(formData.endDate)}
            onChange={(e) => updateField('endDate', parseDateInput(e.target.value))}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">都道府県</label>
          <select
            value={formData.prefecture || ''}
            onChange={(e) => updateField('prefecture', e.target.value || null)}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">市区町村</label>
          <input
            type="text"
            value={formData.city || ''}
            onChange={(e) => updateField('city', e.target.value || null)}
            maxLength={MAX_EVENT_FIELD_LENGTH}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">会場</label>
        <input
          type="text"
          value={formData.venue || ''}
          onChange={(e) => updateField('venue', e.target.value || null)}
          maxLength={MAX_EVENT_FIELD_LENGTH}
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">主催者</label>
        <input
          type="text"
          value={formData.organizer || ''}
          onChange={(e) => updateField('organizer', e.target.value || null)}
          maxLength={MAX_EVENT_FIELD_LENGTH}
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">入場料</label>
          <input
            type="text"
            value={formData.admissionFee || ''}
            onChange={(e) => updateField('admissionFee', e.target.value || null)}
            placeholder="例: 無料、500円"
            maxLength={MAX_EVENT_FIELD_LENGTH}
            className="w-full px-3 py-2 border rounded-lg bg-background"
          />
        </div>
        <div className="flex items-center pt-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.hasSales}
              onChange={(e) => updateField('hasSales', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">即売あり</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">説明</label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          rows={4}
          maxLength={MAX_EVENT_DESCRIPTION_LENGTH}
          className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">外部URL</label>
        <input
          type="url"
          value={formData.externalUrl || ''}
          onChange={(e) => updateField('externalUrl', e.target.value || null)}
          maxLength={MAX_EVENT_URL_LENGTH}
          className="w-full px-3 py-2 border rounded-lg bg-background"
        />
      </div>

      <DialogFooter>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg hover:bg-muted"
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          保存
        </button>
      </DialogFooter>
    </form>
  )
}
