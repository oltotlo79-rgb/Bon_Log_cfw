/**
 * 投稿送信・下書き保存の共通ロジックフック
 *
 * PostForm と PostFormModal で共有される投稿送信・下書き保存の
 * ロジックを集約する。オプティミスティックUI対応。
 *
 * @module components/post/hooks/usePostSubmit
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { createPost } from '@/lib/actions/post'
import { saveDraft } from '@/lib/actions/draft'
import { ROUTE_DRAFTS } from '@/lib/constants/routes'
import { DEFAULT_POLL_DURATION_SECONDS } from '@/lib/constants/limits'
import {
  MSG_DRAFT_SAVE_FAILED,
  MSG_ERROR_FALLBACK,
  MSG_NETWORK_ERROR,
  MSG_POST_CONTENT_REQUIRED,
  MSG_POST_FAILED,
  MSG_POST_SUCCESS,
} from '@/lib/constants/messages'

type MediaFile = {
  url: string
  type: string
}

type PostFormState = {
  content: string
  selectedGenres: string[]
  mediaFiles: MediaFile[]
  isPollActive: boolean
  pollOptions: string[]
  pollDuration: number
  selectedBonsaiId?: string
}

type UsePostSubmitOptions = {
  onSubmitStart?: () => void
  onSubmitComplete?: () => void
}

export function usePostSubmit(options: UsePostSubmitOptions = {}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submitPost = useCallback(
    async (state: PostFormState, resetForm: () => void) => {
      const { content, selectedGenres, mediaFiles, isPollActive, pollOptions, pollDuration, selectedBonsaiId } = state

      if (content.length === 0 && mediaFiles.length === 0) {
        setError(MSG_POST_CONTENT_REQUIRED)
        return
      }

      const formData = new FormData()
      formData.append('content', content)
      selectedGenres.forEach(id => formData.append('genreIds', id))
      mediaFiles.forEach(m => {
        formData.append('mediaUrls', m.url)
        formData.append('mediaTypes', m.type)
      })

      if (selectedBonsaiId) {
        formData.append('bonsaiId', selectedBonsaiId)
      }

      if (isPollActive && pollOptions.some(o => o.trim())) {
        formData.append('pollOptions', JSON.stringify(pollOptions.filter(o => o.trim())))
        formData.append('pollDuration', String(pollDuration))
      }

      // 送信前にコンテンツを保存（失敗時の復元用）
      const savedState = { ...state }

      options.onSubmitStart?.()
      resetForm()
      setError(null)
      setLoading(true)

      createPost(formData)
        .then(async (result) => {
          if (!result.success) {
            toast({
              variant: 'destructive',
              title: MSG_POST_FAILED,
              description: result.error,
            })
            // PostForm（インライン）では復元が必要だが、PostFormModal ではモーダルが閉じているため不要
            // 呼び出し元で savedState を使って復元する場合はコールバックを提供
          } else {
            toast({ title: MSG_POST_SUCCESS })
            await queryClient.invalidateQueries({ queryKey: ['timeline'] })
            router.refresh()
          }
        })
        .catch(() => {
          toast({
            variant: 'destructive',
            title: MSG_POST_FAILED,
            description: MSG_NETWORK_ERROR,
          })
        })
        .finally(() => {
          setLoading(false)
          options.onSubmitComplete?.()
        })

      return savedState
    },
    [router, queryClient, options]
  )

  const saveAsDraft = useCallback(
    async (state: Pick<PostFormState, 'content' | 'mediaFiles' | 'selectedGenres'>, onSuccess?: () => void) => {
      const { content, mediaFiles, selectedGenres } = state

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
          onSuccess?.()
          router.push(ROUTE_DRAFTS)
        }
      } catch {
        setError(MSG_DRAFT_SAVE_FAILED)
      } finally {
        setSavingDraft(false)
      }
    },
    [router]
  )

  return {
    loading,
    savingDraft,
    error,
    setError,
    submitPost,
    saveAsDraft,
    DEFAULT_POLL_DURATION_SECONDS,
  }
}
