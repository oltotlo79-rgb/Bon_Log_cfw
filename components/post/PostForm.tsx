/**
 * 投稿フォームコンポーネント
 *
 * @module components/post/PostForm
 */

'use client'

import { useState, useRef, useEffect, memo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import {
  MSG_DRAFT_SAVE_FAILED,
  MSG_ERROR_FALLBACK,
  MSG_NETWORK_ERROR,
  MSG_POST_CHARACTER_OVERFLOW,
  MSG_POST_CONTENT_REQUIRED,
  MSG_POST_FAILED,
  MSG_POST_SUCCESS,
} from '@/lib/constants/messages'
import { Button } from '@/components/ui/button'
import { MentionTextarea } from '@/components/common/MentionTextarea'
import { createPost } from '@/lib/actions/post'
import { saveDraft } from '@/lib/actions/draft'
import { GenreSelector } from './GenreSelector'
import { PollForm } from './PollForm'
import { useMediaUpload } from './hooks/useMediaUpload'
import { MAX_POST_IMAGES_FREE, MAX_POST_VIDEOS_FREE, MAX_POST_CONTENT_FREE, DEFAULT_POLL_DURATION_SECONDS, DRAFT_AUTOSAVE_DELAY_MS, DRAFT_AUTOSAVE_SAVED_DISPLAY_MS } from '@/lib/constants/limits'
import { ROUTE_DRAFTS } from '@/lib/constants/routes'
import { FileText as FileTextIcon, Check as CheckIcon } from 'lucide-react'
import { SharedMediaUploadSection } from '@/components/common/SharedMediaUploadSection'
import { CharacterCountRing } from './CharacterCountRing'

type Genre = {
  id: string
  name: string
  category: string
}

type MembershipLimits = {
  maxPostLength: number
  maxImages: number
  maxVideos: number
}

type PostFormProps = {
  genres: Record<string, Genre[]>
  limits?: MembershipLimits
  draftCount?: number
  draftId?: string
}

const DEFAULT_LIMITS: MembershipLimits = {
  maxPostLength: MAX_POST_CONTENT_FREE,
  maxImages: MAX_POST_IMAGES_FREE,
  maxVideos: MAX_POST_VIDEOS_FREE,
}

const AutoSaveIndicator = memo(function AutoSaveIndicator({
  status,
  savedTime,
}: {
  status: 'idle' | 'saving' | 'saved' | 'error'
  savedTime: string
}) {
  if (status === 'idle') return null
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      {status === 'saving' ? (
        <>
          <span className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" />
          保存中...
        </>
      ) : status === 'error' ? (
        <span className="text-destructive">自動保存に失敗しました</span>
      ) : (
        <>
          <CheckIcon className="size-3" />
          自動保存しました {savedTime}
        </>
      )}
    </span>
  )
})

export function PostForm({ genres, limits = DEFAULT_LIMITS, draftCount = 0, draftId }: PostFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // 状態管理
  const [content, setContent] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPollActive, setIsPollActive] = useState(false)
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollDuration, setPollDuration] = useState(DEFAULT_POLL_DURATION_SECONDS)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [savedTime, setSavedTime] = useState('')

  // メディアアップロードフック
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

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef = useRef(false)

  const maxChars = limits.maxPostLength
  const remainingChars = maxChars - content.length

  // 送信可否の判定
  const canSubmit =
    (content.trim().length > 0 || mediaFiles.length > 0) &&
    selectedGenres.length > 0 &&
    !loading &&
    !uploading &&
    remainingChars >= 0

  // #9: 下書き自動保存（draftId がある場合のみ）
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }
    if (!draftId) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        const result = await saveDraft({
          id: draftId,
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
        setAutoSaveStatus('error')
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
  }, [content, selectedGenres, mediaFiles, draftId])

  // フォーム送信ハンドラ（オプティミスティックUI）
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (content.length === 0 && mediaFiles.length === 0) {
      setError(MSG_POST_CONTENT_REQUIRED)
      return
    }

    if (remainingChars < 0) {
      setError(MSG_POST_CHARACTER_OVERFLOW(-remainingChars))
      return
    }

    const formData = new FormData()
    formData.append('content', content)
    selectedGenres.forEach(id => formData.append('genreIds', id))
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })
    if (isPollActive && pollOptions.some(o => o.trim())) {
      formData.append('pollOptions', JSON.stringify(pollOptions.filter(o => o.trim())))
      formData.append('pollDuration', String(pollDuration))
    }

    // 送信前にスナップショットを取得（失敗時の復元用）。
    // フィールド追加時に保存と復元の両方を更新する必要があり同期忘れが起きやすかったため、
    // 1 つのオブジェクトと 1 つの restore() に集約する。
    const snapshot = {
      content,
      selectedGenres: [...selectedGenres],
      mediaFiles: [...mediaFiles],
      isPollActive,
      pollOptions: [...pollOptions],
      pollDuration,
    }
    const restoreSnapshot = () => {
      setContent(snapshot.content)
      setSelectedGenres(snapshot.selectedGenres)
      setMediaFiles(snapshot.mediaFiles)
      setIsPollActive(snapshot.isPollActive)
      setPollOptions(snapshot.pollOptions)
      setPollDuration(snapshot.pollDuration)
    }

    // 即座にフォームをリセット（オプティミスティックUI）
    setContent('')
    setSelectedGenres([])
    setMediaFiles([])
    setIsPollActive(false)
    setPollOptions(['', ''])
    setPollDuration(DEFAULT_POLL_DURATION_SECONDS)
    setError(null)
    setLoading(true)

    createPost(formData)
      .then(async (result) => {
        if (!result.success) {
          restoreSnapshot()
          toast({
            variant: 'destructive',
            title: MSG_POST_FAILED,
            description: result.error,
          })
        } else {
          toast({
            title: MSG_POST_SUCCESS,
          })
          await queryClient.invalidateQueries({ queryKey: ['timeline'] })
          router.refresh()
        }
      })
      .catch(() => {
        restoreSnapshot()
        toast({
          variant: 'destructive',
          title: MSG_POST_FAILED,
          description: MSG_NETWORK_ERROR,
        })
      })
      .finally(() => {
        setLoading(false)
      })
  }

  // 下書き保存ハンドラ
  async function handleSaveDraft() {
    if (content.length === 0 && mediaFiles.length === 0) {
      setError(MSG_POST_CONTENT_REQUIRED)
      return
    }

    setSavingDraft(true)
    setError(null)

    try {
      const result = await saveDraft({
        content: content || undefined,
        mediaUrls: mediaFiles.map((m) => m.url),
        genreIds: selectedGenres,
      })

      if ('error' in result) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
      } else {
        setContent('')
        setSelectedGenres([])
        setMediaFiles([])
        setError(null)
        router.push(ROUTE_DRAFTS)
      }
    } catch {
      setError(MSG_DRAFT_SAVE_FAILED)
    } finally {
      setSavingDraft(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-4">
      <MentionTextarea
        value={content}
        onChange={setContent}
        placeholder="いまどうしてる？ @でユーザーをメンション"
        rows={3}
        maxLength={maxChars}
        className="border-0 focus-visible:ring-0 p-0 text-base"
        aria-label="投稿内容を入力"
      />

      {/* メディアプレビュー */}
      <SharedMediaUploadSection
        mediaFiles={mediaFiles}
        uploading={uploading}
        uploadProgress={uploadProgress}
        onFileSelect={handleFileSelect}
        onRemove={removeMedia}
        fileInputRef={fileInputRef}
        maxTotal={limits.maxImages + limits.maxVideos}
        multiple
        previewClassName={`grid gap-2 mt-3 ${mediaFiles.length <= 1 ? '' : 'grid-cols-2'}`}
        buttonVariant="ghost"
      />

      {/* ジャンル選択 */}
      <div className="mt-3">
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {/* アンケート */}
      {isPollActive && (
        <div className="mt-3">
          <PollForm
            isActive={isPollActive}
            onToggle={() => setIsPollActive(false)}
            options={pollOptions}
            onOptionsChange={setPollOptions}
            duration={pollDuration}
            onDurationChange={setPollDuration}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive mt-3" role="alert">{error}</p>
      )}

      <div className="flex items-center justify-between mt-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          {!isPollActive && (
            <PollForm
              isActive={false}
              onToggle={() => setIsPollActive(true)}
              options={pollOptions}
              onOptionsChange={setPollOptions}
              duration={pollDuration}
              onDurationChange={setPollDuration}
            />
          )}
          {limits.maxPostLength > MAX_POST_CONTENT_FREE && (
            <span className="text-xs text-muted-foreground font-medium">Premium</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* #9: 自動保存インジケーター */}
          {draftId && (
            <AutoSaveIndicator status={autoSaveStatus} savedTime={savedTime} />
          )}
          {/* #11: 円形プログレスリング */}
          <CharacterCountRing current={content.length} max={maxChars} />
          {draftCount > 0 && (
            <Link
              href={ROUTE_DRAFTS}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              title="下書き一覧"
            >
              <FileTextIcon className="w-4 h-4" />
              <span className="hidden sm:inline">一覧</span>
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={savingDraft || uploading || (content.length === 0 && mediaFiles.length === 0)}
          >
            {savingDraft ? '保存中...' : '下書き保存'}
          </Button>
          <Button
            type="submit"
            variant="bonsai"
            disabled={!canSubmit}
            title={selectedGenres.length === 0 ? 'ジャンルを選択してください' : undefined}
          >
            {loading ? '投稿中...' : '投稿する'}
          </Button>
        </div>
      </div>
    </form>
  )
}
