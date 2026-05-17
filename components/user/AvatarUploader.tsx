/**
 * アバター画像アップローダーコンポーネント
 *
 * @module components/user/AvatarUploader
 */

'use client'

/**
 * React useState Hook
 * プレビュー画像、ローディング状態、エラー状態の管理に使用
 *
 * React useRef Hook
 * ファイル入力要素への参照を保持するために使用
 */
import { useState, useRef } from 'react'

/**
 * Next.js Imageコンポーネント
 * アバター画像の最適化表示に使用
 */
import Image from 'next/image'

/**
 * Next.js useRouter Hook
 * アップロード成功後にページをリフレッシュして最新状態を反映するために使用
 */
import { useRouter } from 'next/navigation'

/**
 * shadcn/ui Buttonコンポーネント
 * 画像変更ボタンに使用
 */
import { Button } from '@/components/ui/button'

/**
 * クライアントサイド画像圧縮ユーティリティ
 * - prepareFileForUpload: 画像を指定サイズに圧縮
 * - formatFileSize: ファイルサイズを人間が読める形式にフォーマット
 */
import { prepareFileForUpload } from '@/lib/client-image-compression'
import { AVATAR_COMPRESSION_MAX_SIZE_MB, AVATAR_MAX_DIMENSION } from '@/lib/constants/limits'

/**
 * lucide-react アイコン
 *
 * Camera: 画像変更ボタン用のカメラアイコン
 */
import { Camera as CameraIcon } from 'lucide-react'

/**
 * AvatarUploaderコンポーネントのprops型
 *
 * @property currentUrl - 現在のアバター画像URL（nullの場合はイニシャル表示）
 * @property nickname - ユーザーのニックネーム（イニシャル表示に使用）
 */
type AvatarUploaderProps = {
  currentUrl: string | null
  nickname: string
}

/**
 * アバター画像アップローダーコンポーネント
 *
 * ## 機能
 * - 画像ファイルを選択してアップロード
 * - アップロード前に画像を圧縮（通信量削減）
 * - アップロード中はローディングスピナーを表示
 * - 成功時はページをリフレッシュして最新画像を表示
 * - エラー時はエラーメッセージを表示
 *
 * ## UI構成
 * - 左: 丸いアバター画像（またはイニシャル）
 * - 右: 「画像を変更」ボタン
 * - 下: ファイル形式・サイズ制限の説明
 *
 * ## 圧縮設定
 * - 最大サイズ: 500KB
 * - 最大解像度: 512px
 *
 * @param currentUrl - 現在のアバター画像URL
 * @param nickname - ニックネーム（イニシャル表示用）
 *
 * @example
 * ```tsx
 * <AvatarUploader
 *   currentUrl="/avatars/user123.jpg"
 *   nickname="盆栽太郎"
 * />
 * ```
 */
export function AvatarUploader({ currentUrl, nickname }: AvatarUploaderProps) {

  /**
   * プレビュー画像URL
   * ファイル選択後に即座に表示する画像のData URL
   * 初期値は現在のアバターURL
   */
  const [preview, setPreview] = useState<string | null>(currentUrl)

  /**
   * ローディング状態
   * アップロード中はtrueになり、ローディングスピナーを表示
   */
  const [loading, setLoading] = useState(false)

  /**
   * エラー状態
   * アップロード失敗時にエラーメッセージを格納
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * ファイル入力要素への参照
   * ボタンクリック時にファイル選択ダイアログを開くために使用
   */
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * Next.jsルーター
   * アップロード成功後にページをリフレッシュ
   */
  const router = useRouter()

  /**
   * ファイル選択ハンドラ
   *
   * ## 処理フロー
   * 1. 選択されたファイルを取得
   * 2. FileReaderでData URLに変換してプレビュー表示
   * 3. アップロード処理を開始
   *
   * @param e - ファイル入力の変更イベント
   */
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') setPreview(reader.result)
    }
    reader.readAsDataURL(file)

    // アップロード処理を開始
    handleUpload(file)
  }

  /**
   * 画像アップロードハンドラ
   *
   * ## 処理フロー
   * 1. ローディング開始、エラーをクリア
   * 2. 画像を圧縮（500KB以下、512px以下）
   * 3. FormDataを作成してAPIエンドポイントに送信
   * 4. レスポンスを確認
   * 5. 成功時: ページをリフレッシュ
   * 6. エラー時: エラーメッセージを表示し、プレビューを元に戻す
   *
   * @param file - アップロードするファイル
   */
  async function handleUpload(file: File) {
    setLoading(true)
    setError(null)

    try {
      // 画像を圧縮（アバターは小さいサイズで十分）
      const compressedFile = await prepareFileForUpload(file, {
        maxSizeMB: AVATAR_COMPRESSION_MAX_SIZE_MB,
        maxWidthOrHeight: AVATAR_MAX_DIMENSION,
      })

      // FormDataを作成してAPIに送信
      const formData = new FormData()
      formData.append('file', compressedFile)

      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        // エラー時: プレビューを元の画像に戻し、エラーメッセージを表示
        setError(result.error || 'アップロードに失敗しました')
        setPreview(currentUrl)
      } else {
        // 成功時: ページをリフレッシュして最新の画像を表示
        router.refresh()
      }
    } catch {
      // 予期しないエラー: プレビューを元に戻し、エラーメッセージを表示
      setError('アップロードに失敗しました')
      setPreview(currentUrl)
    }

    setLoading(false)
  }

  return (
    <div className="mt-2">
      {/* 非表示のファイル入力（ボタンクリックで開く） */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center gap-4">
        {/* アバター画像プレビュー */}
        <div className="relative w-20 h-20 rounded-full bg-muted overflow-hidden">
          {preview ? (
            // 画像がある場合: 画像を表示
            <Image
              src={preview}
              alt={nickname}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            // 画像がない場合: ニックネームの頭文字を表示
            <div className="w-full h-full flex items-center justify-center text-2xl text-muted-foreground">
              {nickname.charAt(0)}
            </div>
          )}

          {/* ローディングオーバーレイ */}
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* 画像変更ボタン */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          <CameraIcon className="w-4 h-4 mr-2" />
          画像を変更
        </Button>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      {/* ファイル形式・サイズ制限の説明 */}
      <p className="text-xs text-muted-foreground mt-2">
        JPEG、PNG、WebP形式（4MB以下）
      </p>
    </div>
  )
}
