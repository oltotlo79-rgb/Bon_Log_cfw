/**
 * 投稿編集フォーム。本文・ジャンル・メディアを編集して updatePost を呼ぶ。
 *
 * @module components/post/PostEditForm
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { MentionTextarea } from '@/components/common/MentionTextarea'
import { updatePost } from '@/lib/actions/post'
import { GenreSelector } from './GenreSelector'
import { useMediaUpload } from './hooks/useMediaUpload'
import { SharedMediaUploadSection } from '@/components/common/SharedMediaUploadSection'
import { CharacterCountRing } from './CharacterCountRing'
import type { MembershipLimits } from '@/lib/premium'
import { MSG_ERROR_FALLBACK, MSG_POST_UPDATED, MSG_POST_CONTENT_REQUIRED } from '@/lib/constants/messages'
import { buildPostPath } from '@/lib/constants/path-builders'
import { toast } from '@/hooks/use-toast'

type Genre = {
  id: string
  name: string
  category: string
}

type PostEditFormProps = {
  genres: Record<string, Genre[]>
  limits: MembershipLimits
  editData: {
    id: string
    content: string | null
    genreIds: string[]
    media: { url: string; type: string }[]
  }
}

export function PostEditForm({ genres, limits, editData }: PostEditFormProps) {
  const router = useRouter()
  const [content, setContent] = useState(editData.content || '')
  const [selectedGenres, setSelectedGenres] = useState<string[]>(editData.genreIds)
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

  // 既存メディアで初期化（初回マウント時のみ）
  useEffect(() => {
    if (editData.media.length > 0) {
      setMediaFiles(editData.media)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const maxChars = limits.maxPostLength
  const remainingChars = maxChars - content.length
  const postUrl = buildPostPath(editData.id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (content.trim().length === 0 && mediaFiles.length === 0) {
      setError(MSG_POST_CONTENT_REQUIRED)
      return
    }

    setLoading(true)

    const formData = new FormData()
    formData.append('content', content)
    selectedGenres.forEach((id) => formData.append('genreIds', id))
    mediaFiles.forEach((m) => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    const result = await updatePost(editData.id, formData)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
      return
    }

    toast({ description: MSG_POST_UPDATED })
    router.push(postUrl)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-4 space-y-4">
      <div>
        <MentionTextarea
          value={content}
          onChange={setContent}
          placeholder="投稿内容を入力..."
          rows={5}
          maxLength={maxChars}
          className="resize-none border-0 focus-visible:ring-0 p-0 text-base"
        />
        <div className="flex justify-end mt-1">
          <CharacterCountRing current={content.length} max={maxChars} />
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
          buttonVariant="outline"
          buttonLabel="メディア追加"
          multiple
        />
        <span className="text-xs text-muted-foreground">
          画像: {mediaFiles.filter((m) => m.type === 'image').length}/{limits.maxImages}枚,
          動画: {mediaFiles.filter((m) => m.type === 'video').length}/{limits.maxVideos}本
        </span>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">ジャンル</Label>
        <GenreSelector genres={genres} selectedIds={selectedGenres} onChange={setSelectedGenres} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => router.push(postUrl)} disabled={loading}>
          キャンセル
        </Button>
        <Button
          type="submit"
          variant="bonsai"
          disabled={loading || uploading || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
        >
          {loading ? '保存中...' : '更新する'}
        </Button>
      </div>
    </form>
  )
}
