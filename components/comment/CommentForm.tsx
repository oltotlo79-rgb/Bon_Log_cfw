'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { MentionTextarea } from '@/components/common/MentionTextarea'
import { createComment } from '@/lib/actions/comment'
import { useMediaUpload } from '@/components/post/hooks/useMediaUpload'
import {
  MAX_COMMENT_MEDIA,
  MAX_COMMENT_LENGTH,
  MAX_COMMENT_IMAGES,
  MAX_COMMENT_VIDEOS,
} from '@/lib/constants/limits'
import { SharedMediaUploadSection } from '@/components/common/SharedMediaUploadSection'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

type CommentFormProps = {
  postId: string
  parentId?: string
  onSuccess?: (content: string) => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export function CommentForm({
  postId,
  parentId,
  onSuccess,
  onCancel,
  placeholder = 'コメントを入力...',
  autoFocus = false,
}: CommentFormProps) {
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    mediaFiles,
    setMediaFiles,
    uploading,
    uploadProgress,
    handleFileSelect,
    removeMedia,
    fileInputRef,
  } = useMediaUpload({
    maxImages: MAX_COMMENT_IMAGES,
    maxVideos: MAX_COMMENT_VIDEOS,
    onError: setError,
  })

  const maxLength = MAX_COMMENT_LENGTH
  const remainingChars = maxLength - content.length
  const isOverLimit = remainingChars < 0
  const canSubmit = (content.trim().length > 0 || mediaFiles.length > 0) && !isOverLimit

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || isPending) return

    setError(null)

    const formData = new FormData()
    formData.append('postId', postId)
    formData.append('content', content)

    if (parentId) {
      formData.append('parentId', parentId)
    }

    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    startTransition(async () => {
      const result = await createComment(formData)

      if (!result.success) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      } else {
        const submittedContent = content
        setContent('')
        setMediaFiles([])
        onSuccess?.(submittedContent)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <MentionTextarea
          value={content}
          onChange={setContent}
          placeholder={placeholder}
          className="min-h-[80px] pr-16"
          disabled={isPending}
          autoFocus={autoFocus}
          maxLength={maxLength}
        />
        <div
          className={`absolute bottom-2 right-2 text-xs ${
            isOverLimit
              ? 'text-destructive'
              : 'text-muted-foreground'
          }`}
        >
          {remainingChars}
        </div>
      </div>

      <SharedMediaUploadSection
        mediaFiles={mediaFiles}
        uploading={uploading}
        uploadProgress={uploadProgress}
        onFileSelect={handleFileSelect}
        onRemove={removeMedia}
        fileInputRef={fileInputRef}
        maxTotal={MAX_COMMENT_MEDIA}
        disabled={isPending}
        multiple
      />

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-end">
        <div className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isPending}
            >
              キャンセル
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!canSubmit || isPending || uploading}
          >
            {isPending ? '送信中...' : parentId ? '返信する' : 'コメントする'}
          </Button>
        </div>
      </div>
    </form>
  )
}
