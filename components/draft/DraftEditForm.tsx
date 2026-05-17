/**
 * @file DraftEditForm.tsx
 * @description 下書き編集フォームコンポーネント
 *
 * このコンポーネントは、下書き投稿を編集するためのフォームUIを提供します。
 * テキスト編集、メディアアップロード、ジャンル選択、保存/投稿/削除の
 * 各機能を統合した編集画面です。
 *
 * @features
 * - テキスト編集（最大500文字、リアルタイム文字数カウント）
 * - 画像/動画のアップロード（画像は4枚まで、動画は1本）
 * - 画像の自動圧縮（クライアントサイド）
 * - アップロード進捗表示
 * - ジャンル選択（最大3つ）
 * - 下書き保存、投稿、削除の各アクション
 * - 大容量動画のR2直接アップロード対応
 *
 * @usage
 * ```tsx
 * <DraftEditForm draft={draftData} genres={genresByCategory} />
 * ```
 */
'use client'

/**
 * useState - コンポーネントの状態管理フック
 * フォーム入力値やローディング状態を管理
 */
/**
 * useRef - DOM要素への参照を保持するフック
 * ファイル入力要素への参照に使用
 */
import { useState, useRef, useEffect } from 'react'

/**
 * useRouter - Next.jsのルーターフック
 * ページ遷移とデータ再検証に使用
 */
import { useRouter } from 'next/navigation'

/**
 * useQueryClient - React Queryのキャッシュ操作フック
 * 投稿後にタイムラインキャッシュを無効化するために使用
 */
import { useQueryClient } from '@tanstack/react-query'

/**
 * Button - shadcn/uiのボタンコンポーネント
 * 各種アクションボタンに使用
 */
import { Button } from '@/components/ui/button'

/**
 * Textarea - shadcn/uiのテキストエリアコンポーネント
 * 投稿本文の入力に使用
 */
import { Textarea } from '@/components/ui/textarea'

/**
 * saveDraft - 下書き保存のServer Action
 * publishDraft - 下書きを投稿に変換するServer Action
 * deleteDraft - 下書き削除のServer Action
 */
import { saveDraft, publishDraft, deleteDraft } from '@/lib/actions/draft'

/**
 * GenreSelector - ジャンル選択コンポーネント
 * 投稿のジャンル分類を選択するUI
 */
import { GenreSelector } from '@/components/post/GenreSelector'

/**
 * メディアアップロードフック
 */
import { useMediaUpload } from '@/components/post/hooks/useMediaUpload'
import { MAX_BONSAI_RECORD_IMAGES, MAX_POST_CONTENT_FREE, DRAFT_AUTOSAVE_DELAY_MS, DRAFT_AUTOSAVE_SAVED_DISPLAY_MS } from '@/lib/constants/limits'
import { ROUTE_DRAFTS, ROUTE_FEED } from '@/lib/constants/routes'
import { SharedMediaUploadSection } from '@/components/common/SharedMediaUploadSection'
import { Check as CheckIcon, Trash2 as TrashIcon } from 'lucide-react'
import type { DraftEditFormProps } from './DraftEditForm.types'
import {
  MSG_DRAFT_DELETE_FAILED,
  MSG_DRAFT_POST_FAILED,
  MSG_DRAFT_PUBLISH_CONFIRM,
  MSG_DRAFT_SAVE_FAILED,
  MSG_ERROR_FALLBACK,
} from '@/lib/constants/messages'

/**
 * 下書き編集フォームコンポーネント
 *
 * 下書き投稿を編集するためのフルフィーチャーフォーム。
 * テキスト、メディア、ジャンルの編集と、保存/投稿/削除の各アクションを提供。
 *
 * @param props - コンポーネントプロパティ
 * @returns 編集フォームのReact要素
 */
export function DraftEditForm({ draft, genres }: DraftEditFormProps) {

  /**
   * Next.jsルーターインスタンス
   * ページ遷移とデータ再検証に使用
   */
  const router = useRouter()
  const queryClient = useQueryClient()

  /**
   * 投稿本文を管理
   * 初期値は下書きの現在の内容（nullの場合は空文字）
   */
  const [content, setContent] = useState(draft.content || '')

  /**
   * 選択されたジャンルIDの配列を管理
   * 初期値は下書きに紐づくジャンルのID
   */
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    draft.genres.map((g) => g.genreId)
  )

  /**
   * 保存処理中の状態を管理
   */
  const [saving, setSaving] = useState(false)

  /**
   * 投稿処理中の状態を管理
   */
  const [publishing, setPublishing] = useState(false)

  /**
   * 削除処理中の状態を管理
   */
  const [deleting, setDeleting] = useState(false)

  /**
   * エラーメッセージを管理
   * null: エラーなし、string: エラー内容
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * 自動保存ステータスを管理
   */
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  /**
   * 自動保存完了時刻を管理
   */
  const [savedTime, setSavedTime] = useState('')

  /**
   * メディアアップロードフック
   */
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
    maxVideos: 1,
    onError: setError,
  })

  // 既存の下書きメディアで初期化
  useEffect(() => {
    if (draft.media && draft.media.length > 0) {
      setMediaFiles(draft.media.map((m) => ({ url: m.url, type: m.type })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 自動保存デバウンスタイマーへの参照
   */
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * 自動保存完了表示タイマーへの参照
   */
  const savedDisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * 初回レンダリングスキップ用フラグ
   */
  const isMountedRef = useRef(false)

  /** 投稿本文の最大文字数 */
  const maxChars = MAX_POST_CONTENT_FREE

  /** 残り入力可能文字数 */
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, selectedGenres, mediaFiles])

  /**
   * 下書き保存ハンドラ
   *
   * 現在の編集内容を下書きとして保存し、
   * 成功したら下書き一覧ページに戻る
   */
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

  /**
   * 投稿ハンドラ
   *
   * 確認ダイアログ後、まず保存してから投稿に変換。
   * 成功したらフィードページに遷移。
   */
  async function handlePublish() {
    // 投稿確認ダイアログ
    if (!confirm(MSG_DRAFT_PUBLISH_CONFIRM)) return

    setPublishing(true)
    setError(null)

    // まず保存してから投稿（編集内容を反映するため）
    try {
      const saveResult = await saveDraft({
        id: draft.id,
        content: content || undefined,
        mediaUrls: mediaFiles.map((m) => m.url),
        genreIds: selectedGenres,
      })

      if ('error' in saveResult) {
        setError(saveResult.error ?? MSG_ERROR_FALLBACK)
        setPublishing(false)
        return
      }

      // 投稿に変換
      const result = await publishDraft(draft.id)

      if ('error' in result) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
      } else {
        await queryClient.invalidateQueries({ queryKey: ['timeline'] })
        router.push(ROUTE_FEED)
        router.refresh()
      }
    } catch {
      setError(MSG_DRAFT_POST_FAILED)
    } finally {
      setPublishing(false)
    }
  }

  /**
   * 削除ハンドラ
   *
   * 確認ダイアログ後、下書きを削除。
   * 成功したら下書き一覧ページに戻る。
   */
  async function handleDelete() {
    // 削除確認ダイアログ
    if (!confirm('この下書きを削除しますか？')) return

    setDeleting(true)
    try {
      const result = await deleteDraft(draft.id)
      if (!result.success) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      } else {
        router.push(ROUTE_DRAFTS)
        router.refresh()
      }
    } catch {
      setError(MSG_DRAFT_DELETE_FAILED)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* 本文入力テキストエリア */}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="いまどうしてる？"
        rows={5}
        maxLength={maxChars}
        className="resize-none"
      />

      {/* 文字数カウント表示・自動保存インジケーター */}
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

      {/* メディアアップロードセクション */}
      <div className="flex items-center gap-2 flex-wrap">
        <SharedMediaUploadSection
          mediaFiles={mediaFiles}
          uploading={uploading}
          uploadProgress={uploadProgress}
          onFileSelect={handleFileSelect}
          onRemove={removeMedia}
          fileInputRef={fileInputRef}
          maxTotal={MAX_BONSAI_RECORD_IMAGES}
          buttonVariant="outline"
          buttonLabel="画像を追加"
          multiple={false}
        />
      </div>

      {/* ジャンル選択セクション */}
      <div>
        <label className="block text-sm font-medium mb-2">ジャンル</label>
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {/* エラーメッセージ表示 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* アクションボタンセクション */}
      <div className="flex items-center justify-between pt-4 border-t">
        {/* 左側: 削除ボタン */}
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          <TrashIcon className="w-4 h-4 mr-2" />
          {deleting ? '削除中...' : '削除'}
        </Button>

        {/* 右側: 保存・投稿ボタン */}
        <div className="flex gap-2">
          {/* 下書き保存ボタン */}
          <Button
            type="button"
            variant="outline"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '下書き保存'}
          </Button>
          {/* 投稿ボタン - 内容がない場合や文字数オーバー時は無効化 */}
          <Button
            type="button"
            variant="bonsai"
            onClick={handlePublish}
            disabled={publishing || (content.length === 0 && mediaFiles.length === 0) || remainingChars < 0}
          >
            {publishing ? '投稿中...' : '投稿する'}
          </Button>
        </div>
      </div>
    </div>
  )
}
