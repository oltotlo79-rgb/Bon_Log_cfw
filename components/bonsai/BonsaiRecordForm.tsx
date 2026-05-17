/** このファイルは盆栽の成長記録を投稿するためのフォームを提供します。 */

'use client'

// React のフック: 状態管理とDOM参照に使用
import { useState, useRef } from 'react'
// Next.js のルーター: データリフレッシュに使用
import { useRouter } from 'next/navigation'
// Server Action: 成長記録を追加するサーバーサイド関数
import { addBonsaiRecord } from '@/lib/actions/bonsai'
// Next.js の画像最適化コンポーネント
import Image from 'next/image'
// 画像圧縮ユーティリティ: クライアントサイドで画像を圧縮
import { prepareFileForUpload, MAX_IMAGE_SIZE } from '@/lib/client-image-compression'
import { MAX_BONSAI_RECORD_IMAGES, DEFAULT_COMPRESSION_MAX_SIZE_MB, MAX_IMAGE_DIMENSION } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK, MSG_IMAGE_SIZE_LIMIT } from '@/lib/constants/messages'

/**
 * BonsaiRecordFormコンポーネントのProps型定義
 */
interface BonsaiRecordFormProps {
  /** 記録を追加する対象の盆栽ID */
  bonsaiId: string
}

/**
 * カメラアイコン（画像追加ボタン用）
 * @param className - カスタムCSSクラス
 */
function CameraIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  )
}

/**
 * バツ印アイコン（画像削除ボタン用）
 * @param className - カスタムCSSクラス
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/**
 * 盆栽成長記録投稿フォームコンポーネント
 *
 * テキストと画像を組み合わせて成長記録を投稿できます。
 * 画像はクライアントサイドで圧縮してからアップロードされます。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.bonsaiId - 記録を追加する対象の盆栽ID
 */
export function BonsaiRecordForm({ bonsaiId }: BonsaiRecordFormProps) {
  // ルーターインスタンス: データリフレッシュに使用
  const router = useRouter()

  /**
   * 送信処理中かどうかのフラグ
   * true: 送信中（ボタン無効化）、false: 待機状態
   */
  const [loading, setLoading] = useState(false)

  /**
   * エラーメッセージの状態
   * null: エラーなし、string: エラーメッセージを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * テキスト入力内容の状態
   * 成長の様子や作業内容を記録
   */
  const [content, setContent] = useState('')

  /**
   * 選択された画像の状態
   * file: 元のファイル、preview: プレビュー用のBlobURL
   */
  const [images, setImages] = useState<{ file: File; preview: string }[]>([])

  /**
   * ファイル入力要素への参照
   * 画像選択後にinputをリセットするために使用
   */
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 画像選択時のイベントハンドラ
   *
   * 処理フロー:
   * 1. 選択されたファイルのサイズをチェック
   * 2. 有効なファイルのプレビューURLを生成
   * 3. 既存の画像と合わせて最大4枚まで追加
   * 4. ファイル入力をリセット
   *
   * @param e - ファイル選択イベント
   */
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    // ファイルサイズの検証
    const validFiles: File[] = []
    for (const file of Array.from(files)) {
      // MAX_IMAGE_SIZEを超えるファイルはスキップ
      if (file.size > MAX_IMAGE_SIZE) {
        setError(MSG_IMAGE_SIZE_LIMIT(MAX_IMAGE_SIZE / 1024 / 1024, file.size / 1024 / 1024, file.name))
        continue
      }
      validFiles.push(file)
    }

    // 有効なファイルのプレビューURLを生成
    const newImages = validFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }))

    // 既存の画像と合わせて最大4枚まで
    setImages((prev) => [...prev, ...newImages].slice(0, MAX_BONSAI_RECORD_IMAGES))

    // ファイル入力をリセット（同じファイルを再選択可能にする）
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * 画像削除時のイベントハンドラ
   *
   * 指定されたインデックスの画像を削除し、
   * BlobURLを解放してメモリリークを防止
   *
   * @param index - 削除する画像のインデックス
   */
  const removeImage = (index: number) => {
    setImages((prev) => {
      const newImages = [...prev]
      // BlobURLを解放（メモリリーク防止）
      const target = newImages[index]
      if (target) URL.revokeObjectURL(target.preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  /**
   * フォーム送信時のイベントハンドラ
   *
   * 処理フロー:
   * 1. 入力検証（テキストまたは画像が必要）
   * 2. 各画像を圧縮してアップロード
   * 3. 圧縮率をコンソールに出力（デバッグ用）
   * 4. 成長記録をServer Actionで保存
   * 5. 成功時はフォームをリセット
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // 入力検証: テキストまたは画像のいずれかが必要
    if (!content.trim() && images.length === 0) {
      setError('テキストまたは画像を入力してください')
      return
    }

    // 送信処理開始
    setLoading(true)
    setError(null)

    try {
      // 各画像を圧縮してアップロード
      const imageUrls: string[] = []
      for (const image of images) {
        // クライアントサイドで画像を圧縮
        const compressedFile = await prepareFileForUpload(image.file, {
          maxSizeMB: DEFAULT_COMPRESSION_MAX_SIZE_MB,
          maxWidthOrHeight: MAX_IMAGE_DIMENSION,
        })

        // 圧縮した画像をサーバーにアップロード
        const formData = new FormData()
        formData.append('file', compressedFile)

        const response = await fetch('/api/upload/avatar', {
          method: 'POST',
          body: formData,
        })
        const result = await response.json()
        if (result.url) {
          imageUrls.push(result.url)
        }
      }

      // Server Actionで成長記録を保存
      const result = await addBonsaiRecord({
        bonsaiId,
        content: content.trim() || undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      })

      if ('error' in result) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
        return
      }

      // 成功時はフォームをリセット
      setContent('')
      setImages([])
      // ページデータをリフレッシュして新しい記録を表示
      router.refresh()
    } catch {
      // 予期しないエラーの場合
      setError('エラーが発生しました')
    } finally {
      // 送信処理完了
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* エラーメッセージ表示エリア */}
      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* テキスト入力エリア */}
      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="成長の様子や作業内容を記録..."
        />
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          ※ここに記録した内容はタイムラインには投稿されません。タイムラインで任意のマイ盆栽を引用して投稿することで、タイムラインに投稿しつつマイ盆栽の記録にも残すことができます。
        </p>
      </div>

      {/* 選択された画像のプレビュー表示 */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((image, index) => (
            <div key={index} className="relative w-20 h-20">
              <Image
                src={image.preview}
                alt={`画像 ${index + 1}`}
                fill
                className="object-cover rounded-lg"
              />
              {/* 画像削除ボタン */}
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* アクションエリア: 画像追加と送信ボタン */}
      <div className="flex items-center justify-between">
        <div>
          {/* 非表示のファイル入力 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
            id="record-images"
          />
          {/* 画像追加ラベル（ファイル入力のトリガー） */}
          <label
            htmlFor="record-images"
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${
              images.length >= MAX_BONSAI_RECORD_IMAGES ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <CameraIcon className="w-5 h-5" />
            <span className="text-sm">画像を追加</span>
          </label>
          {/* 画像枚数制限の説明 */}
          <p className="text-xs text-muted-foreground mt-1">最大4枚まで</p>
        </div>

        {/* 記録送信ボタン */}
        <button
          type="submit"
          disabled={loading || (!content.trim() && images.length === 0)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? '保存中...' : '記録する'}
        </button>
      </div>
    </form>
  )
}
