/**
 * @module components/event/EventForm
 */

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent, updateEvent } from '@/lib/actions/event'
import { PREFECTURES } from '@/lib/prefectures'
import { MAX_EVENT_TITLE_LENGTH } from '@/lib/constants/limits'
import { buildEventPath } from '@/lib/constants/path-builders'
import { FormError } from '@/components/common/FormError'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

type EventFormInitialData = {
  id: string
  title: string
  startDate: Date
  endDate: Date | null
  prefecture: string | null
  city: string | null
  venue: string | null
  organizer: string | null
  fee: string | null
  hasSales: boolean
  description: string | null
  externalUrl: string | null
}

// discriminated union により mode で initialData の有無を型レベルに表現し、
// サブミットハンドラ内での非 null アサーションを不要にする
type EventFormProps =
  | { mode: 'create'; initialData?: never }
  | { mode: 'edit'; initialData: EventFormInitialData }

function formatDateForInput(date: Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  return d.toISOString().slice(0, 16)
}

export function EventForm({ mode, initialData }: EventFormProps) {
  const router = useRouter()

  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState(initialData?.title || '')
  const [startDate, setStartDate] = useState(formatDateForInput(initialData?.startDate || null))
  const [endDate, setEndDate] = useState(formatDateForInput(initialData?.endDate || null))
  const [prefecture, setPrefecture] = useState(initialData?.prefecture || '')
  const [city, setCity] = useState(initialData?.city || '')
  const [venue, setVenue] = useState(initialData?.venue || '')
  const [organizer, setOrganizer] = useState(initialData?.organizer || '')
  const [fee, setFee] = useState(initialData?.fee || '')
  const [hasSales, setHasSales] = useState(initialData?.hasSales || false)
  const [description, setDescription] = useState(initialData?.description || '')
  const [externalUrl, setExternalUrl] = useState(initialData?.externalUrl || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData()
    formData.append('title', title)
    formData.append('startDate', startDate)
    if (endDate) formData.append('endDate', endDate)
    formData.append('prefecture', prefecture)
    if (city) formData.append('city', city)
    if (venue) formData.append('venue', venue)
    if (organizer) formData.append('organizer', organizer)
    if (fee) formData.append('fee', fee)
    formData.append('hasSales', hasSales.toString())
    if (description) formData.append('description', description)
    if (externalUrl) formData.append('externalUrl', externalUrl)

    startTransition(async () => {
      // discriminated union により mode で initialData の型が絞り込まれる
      if (mode === 'edit') {
        const result = await updateEvent(initialData.id, formData)
        if (!result.success) {
          setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
          return
        }
        router.push(buildEventPath(initialData.id))
        router.refresh()
        return
      }

      const result = await createEvent(formData)
      if (!result.success) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
        return
      }
      if (result.data?.eventId) {
        router.push(buildEventPath(result.data.eventId))
      }
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormError message={error} />

      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={MAX_EVENT_TITLE_LENGTH}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例：第30回 全国盆栽展"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium mb-1">
            開始日時 <span className="text-red-500">*</span>
          </label>
          <input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium mb-1">
            終了日時
          </label>
          <input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="prefecture" className="block text-sm font-medium mb-1">
            都道府県 <span className="text-red-500">*</span>
          </label>
          <select
            id="prefecture"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
          <label htmlFor="city" className="block text-sm font-medium mb-1">
            市区町村
          </label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="例：さいたま市大宮区"
          />
        </div>
      </div>

      <div>
        <label htmlFor="venue" className="block text-sm font-medium mb-1">
          会場名
        </label>
        <input
          id="venue"
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例：大宮盆栽美術館"
        />
      </div>

      <div>
        <label htmlFor="organizer" className="block text-sm font-medium mb-1">
          主催者
        </label>
        <input
          id="organizer"
          type="text"
          value={organizer}
          onChange={(e) => setOrganizer(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例：全日本盆栽協会"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="fee" className="block text-sm font-medium mb-1">
            入場料
          </label>
          <input
            id="fee"
            type="text"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="例：無料、500円、1,000円"
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input
            id="hasSales"
            type="checkbox"
            checked={hasSales}
            onChange={(e) => setHasSales(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="hasSales" className="text-sm font-medium">
            即売あり
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          詳細説明
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="イベントの詳細説明を入力してください"
        />
      </div>

      <div>
        <label htmlFor="externalUrl" className="block text-sm font-medium mb-1">
          外部リンク
        </label>
        <input
          id="externalUrl"
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="https://example.com"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-2 border rounded-lg hover:bg-muted transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? '保存中...' : mode === 'create' ? '登録する' : '更新する'}
        </button>
      </div>
    </form>
  )
}
