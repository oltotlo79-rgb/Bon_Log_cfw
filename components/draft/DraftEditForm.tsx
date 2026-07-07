/**
 * @module components/draft/DraftEditForm
 */
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { saveDraft, publishDraft, deleteDraft } from '@/lib/actions/draft'
import { GenreSelector } from '@/components/post/GenreSelector'
import { useMediaUpload } from '@/components/post/hooks/useMediaUpload'
import {
  MAX_BONSAI_RECORD_IMAGES,
  MAX_POST_CONTENT_FREE,
  DRAFT_AUTOSAVE_DELAY_MS,
  DRAFT_AUTOSAVE_SAVED_DISPLAY_MS,
  MAX_POST_VIDEOS_FREE,
  MAX_POST_VIDEOS_PREMIUM,
} from '@/lib/constants/limits'
import { ROUTE_DRAFTS, ROUTE_FEED } from '@/lib/constants/routes'
import { SharedMediaUploadSection } from '@/components/common/SharedMediaUploadSection'
import { Check as CheckIcon, Trash2 as TrashIcon } from 'lucide-react'
import type { DraftEditFormProps } from './DraftEditForm.types'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  MSG_DRAFT_DELETE_CONFIRM_DESC,
  MSG_DRAFT_DELETE_CONFIRM_TITLE,
  MSG_DRAFT_PUBLISH_CONFIRM_DESC,
  MSG_DRAFT_PUBLISH_CONFIRM_TITLE,
  MSG_DRAFT_SAVE_FAILED,
  MSG_ERROR_FALLBACK,
} from '@/lib/constants/messages'
import { usePremium } from '@/components/premium/PremiumContext'

export function DraftEditForm({ draft, genres }: DraftEditFormProps) {

  const router = useRouter()
  const queryClient = useQueryClient()
  const isPremium = usePremium()

  const maxVideos = isPremium ? MAX_POST_VIDEOS_PREMIUM : MAX_POST_VIDEOS_FREE

  const [content, setContent] = useState(draft.content || '')
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    draft.genres.map((g) => g.genreId)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedTime, setSavedTime] = useState('')

  const {
    mediaFiles,
    setMediaFiles,
    uploading,
    uploadProgress,
    handleFileSelect,
    removeMedia,
    fileInputRef,
  } = useMediaUpload({
    maxImages: MAX_BONSAI_RECORD_IMAGES,
    maxVideos,
    onError: setError,
  })

  // 既存の下書きメディアで初期化
  useEffect(() => {
    if (draft.media && draft.media.length > 0) {
      setMediaFiles(draft.media.map((m) => ({ url: m.url, type: m.type })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 初回マウント時のみ既存メディアで初期化するため空配列固定
  }, [])

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(false)

  const maxChars = MAX_POST_CONTENT_FREE
  const remainingChars = maxChars - content.length

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        const result = await saveDraft({
          id: draft.id,
          content: content || undefined,
          mediaUrls: mediaFiles.map((m) => m.url),
          genreIds: selectedGenres,
        })
        if (!('error' in result)) {
          const now = new Date()
          setSavedTime(
            `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          )
          setAutoSaveStatus('saved')
          if (savedDisplayTimerRef.current) {
            clearTimeout(savedDisplayTimerRef.current)
          }
          savedDisplayTimerRef.current = setTimeout(() => {
            setAutoSaveStatus('idle')
          }, DRAFT_AUTOSAVE_SAVED_DISPLAY_MS)
        } else {
          setAutoSaveStatus('idle')
        }
      } catch {
        setAutoSaveStatus('idle')
      }
    }, DRAFT_AUTOSAVE_DELAY_MS)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
      if (savedDisplayTimerRef.current) {
        clearTimeout(savedDisplayTimerRef.current)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 自動保存は content/selectedGenres/mediaFiles のみに反応させ、タイマー ref は依存に含めない
  }, [content, selectedGenres, mediaFiles])

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      const result = await saveDraft({
        id: draft.id,
        content: content || undefined,
        mediaUrls: mediaFiles.map((m) => m.url),
        genreIds: selectedGenres,
      })

      if ('error' in result) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
      } else {
        router.push(ROUTE_DRAFTS)
        router.refresh()
      }
    } catch {
      setError(MSG_DRAFT_SAVE_FAILED)
    } finally {
      setSaving(false)
    }
  }

  async function handlePublishConfirm() {
    setError(null)

    // 編集内容を反映するため、投稿変換前に保存する
    const saveResult = await saveDraft({
      id: draft.id,
      content: content || undefined,
      mediaUrls: mediaFiles.map((m) => m.url),
      genreIds: selectedGenres,
    })

    if ('error' in saveResult) {
      throw new Error(saveResult.error ?? MSG_ERROR_FALLBACK)
    }

    const result = await publishDraft(draft.id)

    if ('error' in result) {
      throw new Error(result.error ?? MSG_ERROR_FALLBACK)
    }

    await queryClient.invalidateQueries({ queryKey: ['timeline'] })
    router.push(ROUTE_FEED)
    router.refresh()
  }

  async function handleDeleteConfirm() {
    const result = await deleteDraft(draft.id)
    if (!result.success) {
      throw new Error(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
    }
    router.push(ROUTE_DRAFTS)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="いまどうしてる？"
        rows={5}
        maxLength={maxChars}
        className="resize-none"
      />

      <div className="flex items-center justify-between">
        {autoSaveStatus !== 'idle' ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {autoSaveStatus === 'saving' ? (
              <>
                <span className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" />
                保存中...
              </>
            ) : (
              <>
                <CheckIcon className="size-3" />
                自動保存しました {savedTime}
              </>
            )}
          </span>
        ) : (
          <span />
        )}
        <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {remainingChars}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SharedMediaUploadSection
          mediaFiles={mediaFiles}
          uploading={uploading}
          uploadProgress={uploadProgress}
          onFileSelect={handleFileSelect}
          onRemove={removeMedia}
          fileInputRef={fileInputRef}
          maxTotal={MAX_BONSAI_RECORD_IMAGES + maxVideos}
          maxVideos={maxVideos}
          buttonVariant="outline"
          buttonLabel={maxVideos > 0 ? 'メディアを追加' : '画像を追加'}
          multiple={false}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">ジャンル</label>
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <ConfirmDialog
          trigger={
            <Button type="button" variant="destructive">
              <TrashIcon className="w-4 h-4 mr-2" />
              削除
            </Button>
          }
          variant="destructive"
          title={MSG_DRAFT_DELETE_CONFIRM_TITLE}
          description={MSG_DRAFT_DELETE_CONFIRM_DESC}
          confirmLabel="削除する"
          onConfirm={handleDeleteConfirm}
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '下書き保存'}
          </Button>
          <ConfirmDialog
            open={publishConfirmOpen}
            onOpenChange={setPublishConfirmOpen}
            variant="warning"
            title={MSG_DRAFT_PUBLISH_CONFIRM_TITLE}
            description={MSG_DRAFT_PUBLISH_CONFIRM_DESC}
            confirmLabel="投稿する"
            onConfirm={handlePublishConfirm}
          />
          <Button
            type="button"
            variant="bonsai"
            onClick={() => setPublishConfirmOpen(true)}
            disabled={(content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
          >
            投稿する
          </Button>
        </div>
      </div>
    </div>
  )
}
