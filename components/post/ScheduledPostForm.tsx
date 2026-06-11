/**
 * 予約投稿フォームコンポーネント
 *
 * @module components/post/ScheduledPostForm
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createScheduledPost, updateScheduledPost } from '@/lib/actions/scheduled-post'
import { GenreSelector } from './GenreSelector'
import { useMediaUpload } from './hooks/useMediaUpload'
import { Calendar, Clock } from 'lucide-react'
import { SharedMediaUploadSection } from '@/components/common/SharedMediaUploadSection'
import type { ScheduledPostFormProps } from './ScheduledPostForm.types'
import { MSG_ERROR_FALLBACK, MSG_SCHEDULED_DATE_FUTURE_REQUIRED, MSG_SCHEDULED_DATE_REQUIRED } from '@/lib/constants/messages'
import { ROUTE_SCHEDULED_POSTS } from '@/lib/constants/routes'

export function ScheduledPostForm({ genres, limits, editData }: ScheduledPostFormProps) {
  const router = useRouter()

  const [content, setContent] = useState(editData?.content || '')

  const [selectedGenres, setSelectedGenres] = useState<string[]>(editData?.genreIds || [])

  const [scheduledDate, setScheduledDate] = useState(
    editData?.scheduledAt
      ? new Date(editData.scheduledAt).toISOString().split('T')[0]
      : ''
  )

  const [scheduledTime, setScheduledTime] = useState(
    editData?.scheduledAt
      ? new Date(editData.scheduledAt).toTimeString().slice(0, 5)
      : ''
  )

  const [loading, setLoading] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const {
    mediaFiles,
    setMediaFiles,
    uploading,
    uploadProgress,
    handleFileSelect,
    removeMedia,
    fileInputRef,
  } = useMediaUpload({
    maxImages: limits.maxImages,
    maxVideos: limits.maxVideos,
    onError: setError,
  })

  useEffect(() => {
    if (editData?.media && editData.media.length > 0) {
      setMediaFiles(editData.media)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const maxChars = limits.maxPostLength

  const remainingChars = maxChars - content.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!scheduledDate || !scheduledTime) {
      setError(MSG_SCHEDULED_DATE_REQUIRED)
      setLoading(false)
      return
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)

    if (scheduledAt <= new Date()) {
      setError(MSG_SCHEDULED_DATE_FUTURE_REQUIRED)
      setLoading(false)
      return
    }

    const formData = new FormData()
    formData.append('content', content)
    formData.append('scheduledAt', scheduledAt.toISOString())
    selectedGenres.forEach(id => formData.append('genreIds', id))
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    const result = editData
      ? await updateScheduledPost(editData.id, formData)
      : await createScheduledPost(formData)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else {
      router.push(ROUTE_SCHEDULED_POSTS)
      router.refresh()
    }
  }

  const now = new Date()

  const minDate = now.toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-4 space-y-4">
      <div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="予約投稿の内容を入力..."
          rows={5}
          maxLength={maxChars}
          className="resize-none border-0 focus-visible:ring-0 p-0 text-base"
        />
        <div className="flex justify-end mt-1">
          <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {remainingChars} / {maxChars}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SharedMediaUploadSection
          mediaFiles={mediaFiles}
          uploading={uploading}
          uploadProgress={uploadProgress}
          onFileSelect={handleFileSelect}
          onRemove={removeMedia}
          fileInputRef={fileInputRef}
          maxTotal={limits.maxImages + limits.maxVideos}
          maxVideos={limits.maxVideos}
          buttonVariant="outline"
          buttonLabel="メディア追加"
          multiple
        />
        <span className="text-xs text-muted-foreground">
          画像: {mediaFiles.filter(m => m.type === 'image').length}/{limits.maxImages}枚
          {limits.maxVideos > 0 && (
            <>、動画: {mediaFiles.filter(m => m.type === 'video').length}/{limits.maxVideos}本</>
          )}
        </span>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">ジャンル</Label>
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      <div className="space-y-3 pt-4 border-t">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          予約日時
        </Label>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={minDate}
              required
            />
          </div>
          <div className="flex-1">
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          キャンセル
        </Button>
        <Button
          type="submit"
          variant="bonsai"
          disabled={loading || uploading || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0 || !scheduledDate || !scheduledTime}
        >
          {loading ? '保存中...' : editData ? '更新する' : '予約する'}
        </Button>
      </div>
    </form>
  )
}
