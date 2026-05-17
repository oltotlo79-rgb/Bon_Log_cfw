'use client'

/**
 * @file お知らせリストコンポーネント
 * @description お知らせの一覧表示・作成フォーム・有効/無効切替・削除を行うClient Component。
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Bell,
  Monitor,
  BellRing,
} from 'lucide-react'
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/actions/admin/announcements'

interface Announcement {
  id: string
  title: string
  content: string
  type: 'banner' | 'notification' | 'both'
  isActive: boolean
  startsAt: string
  endsAt: string | null
  createdAt: string
}

interface AnnouncementListProps {
  announcements: Announcement[]
}

/** タイプラベル */
const typeLabels: Record<string, string> = {
  banner: 'バナー',
  notification: '通知',
  both: '両方',
}

/** タイプバッジの色 */
const typeColors: Record<string, string> = {
  banner: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  notification: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  both: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
}

/** タイプアイコン */
const typeIcons: Record<string, typeof Bell> = {
  banner: Monitor,
  notification: Bell,
  both: BellRing,
}

export function AnnouncementList({ announcements }: AnnouncementListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // フォーム状態
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState<'banner' | 'notification' | 'both'>('banner')
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10))
  const [endsAt, setEndsAt] = useState('')

  const handleCreate = async () => {
    if (!title.trim()) {
      setFormError('タイトルを入力してください')
      return
    }
    setFormError(null)
    startTransition(async () => {
      const result = await createAnnouncement({
        title: title.trim(),
        content,
        type,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      })
      if (result && 'error' in result) {
        setFormError(result.error)
        return
      }
      setTitle('')
      setContent('')
      setType('banner')
      setEndsAt('')
      setShowForm(false)
      router.refresh()
    })
  }

  const handleToggleActive = (id: string, currentActive: boolean) => {
    startTransition(async () => {
      await updateAnnouncement(id, { isActive: !currentActive })
      router.refresh()
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('このお知らせを削除しますか?')) return
    startTransition(async () => {
      await deleteAnnouncement(id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* 作成ボタン */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-4 h-4" />
        新規作成
      </button>

      {/* 作成フォーム */}
      {showForm && (
        <div className="bg-card rounded-lg border p-4 space-y-4">
          <h3 className="font-semibold">お知らせを作成</h3>

          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">タイトル</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
                placeholder="お知らせタイトル"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">タイプ</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as 'banner' | 'notification' | 'both')}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
              >
                <option value="banner">バナー</option>
                <option value="notification">通知</option>
                <option value="both">両方</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">内容</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-foreground min-h-[100px]"
              placeholder="お知らせの内容を入力..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">開始日</label>
              <input
                type="date"
                value={startsAt}
                onChange={e => setStartsAt(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">終了日（任意）</label>
              <input
                type="date"
                value={endsAt}
                onChange={e => setEndsAt(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background text-foreground"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              作成
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* お知らせ一覧 */}
      <div className="bg-card rounded-lg border">
        {announcements.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            お知らせがありません
          </div>
        ) : (
          <div className="divide-y">
            {announcements.map(announcement => {
              const TypeIcon = typeIcons[announcement.type] || Bell
              return (
                <div
                  key={announcement.id}
                  className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{announcement.title}</h3>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[announcement.type]}`}
                      >
                        <TypeIcon className="w-3 h-3" />
                        {typeLabels[announcement.type]}
                      </span>
                      {announcement.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          有効
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400">
                          無効
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      開始: {new Date(announcement.startsAt).toLocaleDateString('ja-JP')}
                      {announcement.endsAt && (
                        <> / 終了: {new Date(announcement.endsAt).toLocaleDateString('ja-JP')}</>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleActive(announcement.id, announcement.isActive)}
                      disabled={isPending}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title={announcement.isActive ? '無効にする' : '有効にする'}
                    >
                      {announcement.isActive ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(announcement.id)}
                      disabled={isPending}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
