/**
 * 予約投稿フォームコンポーネント
 *
 * @module components/post/ScheduledPostForm
 */

'use client'

/**
 * React Hooks
 *
 * useState: フォームの状態管理
 * useRef: ファイル入力要素への参照
 */
import { useState, useEffect } from 'react'

/**
 * Next.js ナビゲーション
 * 予約投稿一覧への遷移に使用
 */
import { useRouter } from 'next/navigation'

/**
 * UIコンポーネント
 * shadcn/uiのButton, Textarea, Input, Labelを使用
 */
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Server Actions
 *
 * createScheduledPost: 予約投稿を作成
 * updateScheduledPost: 予約投稿を更新
 */
import { createScheduledPost, updateScheduledPost } from '@/lib/actions/scheduled-post'

/**
 * ジャンル選択コンポーネント
 */
import { GenreSelector } from './GenreSelector'

/**
 * メディアアップロードフック
 */
import { useMediaUpload } from './hooks/useMediaUpload'

/**
 * Lucide Reactアイコン
 *
 * Calendar: 日付選択アイコン
 * Clock: 時間選択アイコン
 */
import { Calendar, Clock } from 'lucide-react'

/**
 * 共通メディアアップロードセクションコンポーネント
 */
import { SharedMediaUploadSection } from '@/components/common/SharedMediaUploadSection'
import type { ScheduledPostFormProps } from './ScheduledPostForm.types'
import { MSG_ERROR_FALLBACK, MSG_SCHEDULED_DATE_FUTURE_REQUIRED, MSG_SCHEDULED_DATE_REQUIRED } from '@/lib/constants/messages'
import { ROUTE_SCHEDULED_POSTS } from '@/lib/constants/routes'

/**
 * 予約投稿フォームコンポーネント
 *
 * ## 機能
 * - テキスト入力と文字数カウント
 * - 画像・動画のアップロードとプレビュー
 * - ジャンル選択（複数選択可）
 * - 予約日時の指定（日付と時間を別々に入力）
 * - 新規作成と編集の両方に対応
 *
 * ## 状態管理
 * - content: 投稿テキスト
 * - selectedGenres: 選択されたジャンルID配列
 * - mediaFiles: アップロードされたメディアファイル配列
 * - scheduledDate/scheduledTime: 予約日時
 * - loading/uploading: ローディング状態
 * - error: エラーメッセージ
 *
 * ## 日時バリデーション
 * - 予約日時は現在時刻より未来である必要がある
 * - 日付の最小値は今日
 *
 * @param genres - カテゴリ別ジャンルデータ
 * @param limits - 会員種別による制限値
 * @param editData - 編集時の既存データ（新規作成時は省略）
 *
 * @example
 * ```tsx
 * // 新規作成
 * <ScheduledPostForm
 *   genres={{ '盆栽': [...] }}
 *   limits={{ maxPostLength: 1000, maxImages: 8, maxVideos: 4 }}
 * />
 *
 * // 編集
 * <ScheduledPostForm
 *   genres={{ '盆栽': [...] }}
 *   limits={{ maxPostLength: 1000, maxImages: 8, maxVideos: 4 }}
 *   editData={{
 *     id: 'scheduled123',
 *     content: '予約投稿のテスト',
 *     scheduledAt: new Date('2024-12-01T10:00:00'),
 *     genreIds: ['genre1'],
 *     media: [],
 *   }}
 * />
 * ```
 */
export function ScheduledPostForm({ genres, limits, editData }: ScheduledPostFormProps) {

  /**
   * Next.jsルーター
   * 予約完了後の遷移や戻るボタンに使用
   */
  const router = useRouter()

  /**
   * 投稿テキストの内容
   * 編集時は既存の内容で初期化
   */
  const [content, setContent] = useState(editData?.content || '')

  /**
   * 選択されたジャンルのID配列
   * 編集時は既存の選択で初期化
   */
  const [selectedGenres, setSelectedGenres] = useState<string[]>(editData?.genreIds || [])

  /**
   * 予約日（YYYY-MM-DD形式）
   * 編集時は既存の日付で初期化
   */
  const [scheduledDate, setScheduledDate] = useState(
    editData?.scheduledAt
      ? new Date(editData.scheduledAt).toISOString().split('T')[0]
      : ''
  )

  /**
   * 予約時間（HH:MM形式）
   * 編集時は既存の時間で初期化
   */
  const [scheduledTime, setScheduledTime] = useState(
    editData?.scheduledAt
      ? new Date(editData.scheduledAt).toTimeString().slice(0, 5)
      : ''
  )

  /**
   * 投稿送信中のローディング状態
   */
  const [loading, setLoading] = useState(false)

  /**
   * エラーメッセージ（nullの場合はエラーなし）
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * メディアアップロードフック
   * 編集時は既存のメディアで初期化
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
    maxImages: limits.maxImages,
    maxVideos: limits.maxVideos,
    onError: setError,
  })

  // 編集時に既存メディアで初期化
  useEffect(() => {
    if (editData?.media && editData.media.length > 0) {
      setMediaFiles(editData.media)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 最大文字数
   */
  const maxChars = limits.maxPostLength

  /**
   * 残り文字数
   */
  const remainingChars = maxChars - content.length

  /**
   * フォーム送信時のハンドラ
   *
   * ## 処理フロー
   * 1. 予約日時のバリデーション
   * 2. FormDataを構築
   * 3. Server Actionで予約投稿を作成/更新
   * 4. 成功時: 予約投稿一覧に遷移
   * 5. 失敗時: エラーメッセージを表示
   *
   * @param e - フォームのsubmitイベント
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    /**
     * 予約日時の検証
     */
    if (!scheduledDate || !scheduledTime) {
      setError(MSG_SCHEDULED_DATE_REQUIRED)
      setLoading(false)
      return
    }

    /**
     * 日付と時間を結合してDateオブジェクトを作成
     */
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`)

    /**
     * 未来の日時かチェック
     */
    if (scheduledAt <= new Date()) {
      setError(MSG_SCHEDULED_DATE_FUTURE_REQUIRED)
      setLoading(false)
      return
    }

    /**
     * FormDataを構築
     */
    const formData = new FormData()
    formData.append('content', content)
    formData.append('scheduledAt', scheduledAt.toISOString())
    selectedGenres.forEach(id => formData.append('genreIds', id))
    mediaFiles.forEach(m => {
      formData.append('mediaUrls', m.url)
      formData.append('mediaTypes', m.type)
    })

    /**
     * 編集時はupdateScheduledPost、新規作成時はcreateScheduledPostを呼び出す
     */
    const result = editData
      ? await updateScheduledPost(editData.id, formData)
      : await createScheduledPost(formData)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else {
      /**
       * 成功時: 予約投稿一覧に遷移
       */
      router.push(ROUTE_SCHEDULED_POSTS)
      router.refresh()
    }
  }

  /**
   * 現在の日時
   */
  const now = new Date()

  /**
   * 日付入力の最小値（今日）
   */
  const minDate = now.toISOString().split('T')[0]

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-4 space-y-4">
      {/* テキスト入力エリア */}
      <div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="予約投稿の内容を入力..."
          rows={5}
          maxLength={maxChars}
          className="resize-none border-0 focus-visible:ring-0 p-0 text-base"
        />
        {/* 文字数カウンター */}
        <div className="flex justify-end mt-1">
          <span className={`text-sm ${remainingChars < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {remainingChars} / {maxChars}
          </span>
        </div>
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
          maxTotal={limits.maxImages + limits.maxVideos}
          buttonVariant="outline"
          buttonLabel="メディア追加"
          multiple
        />
        {/* 現在の添付数表示 */}
        <span className="text-xs text-muted-foreground">
          画像: {mediaFiles.filter(m => m.type === 'image').length}/{limits.maxImages}枚,
          動画: {mediaFiles.filter(m => m.type === 'video').length}/{limits.maxVideos}本
        </span>
      </div>

      {/* ジャンル選択 */}
      <div>
        <Label className="text-sm font-medium mb-2 block">ジャンル</Label>
        <GenreSelector
          genres={genres}
          selectedIds={selectedGenres}
          onChange={setSelectedGenres}
        />
      </div>

      {/* 予約日時 */}
      <div className="space-y-3 pt-4 border-t">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          予約日時
        </Label>
        <div className="flex gap-3">
          {/* 日付入力 */}
          <div className="flex-1">
            <Input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={minDate}
              required
            />
          </div>
          {/* 時間入力 */}
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

      {/* エラーメッセージ */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* アクションボタン */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        {/* キャンセルボタン */}
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          キャンセル
        </Button>
        {/* 予約/更新ボタン */}
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
