/**
 * 投稿フォームモーダルコンポーネント
 *
 * @module components/post/PostFormModal
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InkDropOverlay } from './InkDropOverlay'
import { usePostSubmit } from './hooks/usePostSubmit'
import { INK_CLEAR_TOTAL_DURATION } from '@/lib/constants/limits/ui'
import { GenreSelector } from './GenreSelector'
import { PollForm } from './PollForm'
import { useMediaUpload } from './hooks/useMediaUpload'
import { MediaPreviewGrid } from './MediaPreviewGrid'
import { BonsaiSelectorSection } from './form/BonsaiSelectorSection'
import {
  DEFAULT_POLL_DURATION_SECONDS,
  MAX_POST_CONTENT_FREE,
  MAX_POST_IMAGES_FREE,
  MAX_POST_VIDEOS_FREE,
} from '@/lib/constants/limits'
import { ROUTE_DRAFTS } from '@/lib/constants/routes'
import {
  MSG_POST_CHARACTER_OVERFLOW,
  MSG_POST_CONFIRM_DISCARD,
  MSG_POST_CONFIRM_DISCARD_TITLE,
  MSG_POST_UPLOAD_CANCEL_DESC,
  MSG_POST_UPLOAD_CANCEL_TITLE,
} from '@/lib/constants/messages'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ImageIcon, X as XIcon, FileText as FileTextIcon } from 'lucide-react'

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

type Bonsai = {
  id: string
  name: string
  species: string | null
}

type PostFormModalProps = {
  genres: Record<string, Genre[]>
  limits?: MembershipLimits
  isOpen: boolean
  onClose: () => void
  draftCount?: number
  bonsais?: Bonsai[]
}

const DEFAULT_LIMITS: MembershipLimits = {
  maxPostLength: MAX_POST_CONTENT_FREE,
  maxImages: MAX_POST_IMAGES_FREE,
  maxVideos: MAX_POST_VIDEOS_FREE,
}

export function PostFormModal({ genres, limits = DEFAULT_LIMITS, isOpen, onClose, draftCount = 0, bonsais = [] }: PostFormModalProps) {
  // 状態管理
  const [content, setContent] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [selectedBonsaiId, setSelectedBonsaiId] = useState<string>('')
  const [isPollActive, setIsPollActive] = useState(false)
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
  const [pollDuration, setPollDuration] = useState(DEFAULT_POLL_DURATION_SECONDS)
  const [inkDropActive, setInkDropActive] = useState(false)
  const [confirmType, setConfirmType] = useState<'upload' | 'discard' | null>(null)

  const { loading, savingDraft, error, setError, submitPost, saveAsDraft } = usePostSubmit()

  const {
    mediaFiles,
    setMediaFiles,
    uploading,
    setUploading,
    uploadProgress,
    setUploadProgress,
    handleFileSelect,
    removeMedia,
    abortControllerRef,
    fileInputRef,
  } = useMediaUpload({
    maxImages: limits.maxImages,
    maxVideos: limits.maxVideos,
    onError: setError,
  })

  const maxChars = limits.maxPostLength
  const remainingChars = maxChars - content.length

  // フォーム送信ハンドラ（オプティミスティックUI）
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (remainingChars < 0) {
      setError(MSG_POST_CHARACTER_OVERFLOW(-remainingChars))
      return
    }

    // 墨滴エフェクトを発火
    setInkDropActive(true)
    setTimeout(() => setInkDropActive(false), INK_CLEAR_TOTAL_DURATION)

    await submitPost(
      {
        content,
        selectedGenres,
        mediaFiles,
        isPollActive,
        pollOptions,
        pollDuration,
        selectedBonsaiId,
      },
      () => {
        setContent('')
        setSelectedGenres([])
        setMediaFiles([])
        setSelectedBonsaiId('')
        setIsPollActive(false)
        setPollOptions(['', ''])
        setPollDuration(DEFAULT_POLL_DURATION_SECONDS)
        onClose()
      }
    )
  }

  function resetForm() {
    setContent('')
    setSelectedGenres([])
    setMediaFiles([])
    setSelectedBonsaiId('')
    setIsPollActive(false)
    setPollOptions(['', ''])
    setPollDuration(DEFAULT_POLL_DURATION_SECONDS)
    setError(null)
    setUploading(false)
    setUploadProgress(0)
    abortControllerRef.current = null
    onClose()
  }

  // モーダルを閉じるハンドラ
  function handleClose() {
    if (uploading) {
      setConfirmType('upload')
    } else if (content.length > 0 || mediaFiles.length > 0) {
      setConfirmType('discard')
    } else {
      resetForm()
    }
  }

  function handleConfirmClose() {
    if (confirmType === 'upload') {
      abortControllerRef.current?.abort()
    }
    setConfirmType(null)
    resetForm()
  }

  function handleMediaButtonClick() {
    fileInputRef.current?.click()
  }

  // 下書き保存ハンドラ
  async function handleSaveDraft() {
    await saveAsDraft(
      { content, mediaFiles, selectedGenres },
      () => {
        setContent('')
        setSelectedGenres([])
        setMediaFiles([])
        onClose()
      }
    )
  }

  if (!isOpen) return <InkDropOverlay active={inkDropActive} />

  return (
    <>
    <InkDropOverlay active={inkDropActive} />
    <ConfirmDialog
      open={confirmType !== null}
      onOpenChange={(v) => { if (!v) setConfirmType(null) }}
      variant={confirmType === 'discard' ? 'discard' : 'warning'}
      title={confirmType === 'upload' ? MSG_POST_UPLOAD_CANCEL_TITLE : MSG_POST_CONFIRM_DISCARD_TITLE}
      description={confirmType === 'upload' ? MSG_POST_UPLOAD_CANCEL_DESC : MSG_POST_CONFIRM_DISCARD}
      confirmLabel={confirmType === 'upload' ? 'キャンセルする' : '破棄する'}
      onConfirm={handleConfirmClose}
    />
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="shrink-0 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            {draftCount > 0 && (
              <Link
                href={ROUTE_DRAFTS}
                onClick={onClose}
                className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                title="下書き一覧"
              >
                <FileTextIcon className="w-4 h-4" />
                <span className="hidden sm:inline">下書き一覧</span>
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
              onClick={handleSubmit}
              variant="bonsai"
              disabled={loading || uploading || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
              data-testid="post-submit-button"
            >
              {loading ? '投稿中...' : '投稿する'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-24 max-w-2xl mx-auto w-full">
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="いまどうしてる？"
            rows={6}
            maxLength={maxChars}
            autoFocus
            className="resize-none border-0 focus-visible:ring-0 p-0 text-lg flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="post-textarea"
          />

          <MediaPreviewGrid
            mediaFiles={mediaFiles}
            onRemove={removeMedia}
            uploading={uploading}
          />

          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
                onChange={handleFileSelect}
                multiple
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMediaButtonClick}
                disabled={uploading || mediaFiles.length >= (limits.maxImages + limits.maxVideos)}
              >
                <ImageIcon className="w-5 h-5" />
                <span className="ml-1 text-sm">画像/動画</span>
              </Button>
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
              {uploading && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-bonsai-green transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                </div>
              )}
            </div>

            <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {remainingChars}
            </span>
          </div>

          <BonsaiSelectorSection
            selectedBonsaiId={selectedBonsaiId || null}
            bonsaiList={bonsais}
            onChange={(id) => setSelectedBonsaiId(id ?? '')}
          />

          {isPollActive && (
            <div className="mt-4">
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

          <div className="mt-4">
            <GenreSelector
              genres={genres}
              selectedIds={selectedGenres}
              onChange={setSelectedGenres}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive mt-4">{error}</p>
          )}
        </form>
      </div>
    </div>
    </>
  )
}
