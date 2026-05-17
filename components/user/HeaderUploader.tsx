/**
 * ヘッダー画像アップローダーコンポーネント
 *
 * @module components/user/HeaderUploader
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
 * ヘッダー画像の最適化表示に使用
 */
import Image from 'next/image'

/**
 * Next.js useRouter Hook
 * アップロード成功後にページをリフレッシュして最新状態を反映するために使用
 */
import { useRouter } from 'next/navigation'

/**
 * shadcn/ui Buttonコンポーネント
 * ホバー時の「変更する」ボタンに使用
 */
import { Button } from '@/components/ui/button'

/**
 * クライアントサイド画像圧縮ユーティリティ
 * - prepareFileForUpload: 画像を指定サイズに圧縮
 * - formatFileSize: ファイルサイズを人間が読める形式にフォーマット
 */
import { prepareFileForUpload } from '@/lib/client-image-compression'
import { HEADER_COMPRESSION_MAX_SIZE_MB, HEADER_MAX_DIMENSION } from '@/lib/constants/limits'

/**
 * lucide-react アイコン
 *
 * Camera: ヘッダー画像変更ボタン用のカメラアイコン
 */
import { Camera as CameraIcon } from 'lucide-react'

/**
 * HeaderUploaderコンポーネントのprops型
 *
 * @property currentUrl - 現在のヘッダー画像URL（nullの場合はデフォルトアイコン表示）
 */
type HeaderUploaderProps = {
  currentUrl: string | null
}

/**
 * ヘッダー画像アップローダーコンポーネント
 *
 * ## 機能
 * - エリア全体がクリック可能（ファイル選択ダイアログを開く）
 * - ホバー時にオーバーレイと「変更する」ボタンを表示
 * - アップロード前に画像を圧縮（通信量削減）
 * - アップロード中はローディングスピナーを表示
 * - 成功時はページをリフレッシュして最新画像を表示
 * - エラー時はエラーメッセージを表示
 *
 * ## UI構成
 * - 横長の画像エリア（高さ128px）
 * - 画像がない場合はカメラアイコンを表示
 * - ホバー時にオーバーレイ（半透明黒）と変更ボタンを表示
 * - 下部にファイル形式・推奨サイズの説明
 *
 * ## 圧縮設定
 * - 最大サイズ: 1MB
 * - 最大幅: 1500px
 *
 * @param currentUrl - 現在のヘッダー画像URL
 *
 * @example
 * ```tsx
 * <HeaderUploader currentUrl="/headers/user123.jpg" />
 * ```
 */
export function HeaderUploader({ currentUrl }: HeaderUploaderProps) {

  /**
   * プレビュー画像URL
   * ファイル選択後に即座に表示する画像のData URL
   * 初期値は現在のヘッダーURL
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
   * エリアクリック時にファイル選択ダイアログを開くために使用
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
   * 2. 画像を圧縮（1MB以下、1500px幅以下）
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
      // 画像を圧縮（ヘッダーは1500px幅）
      const compressedFile = await prepareFileForUpload(file, {
        maxSizeMB: HEADER_COMPRESSION_MAX_SIZE_MB,
        maxWidthOrHeight: HEADER_MAX_DIMENSION,
      })

      // FormDataを作成してAPIに送信
      const formData = new FormData()
      formData.append('file', compressedFile)

      const response = await fetch('/api/upload/header', {
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
      {/* 非表示のファイル入力（エリアクリックで開く） */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* ヘッダー画像エリア（クリック可能） */}
      <div
        className="relative h-32 rounded-lg bg-muted overflow-hidden cursor-pointer group"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          // 画像がある場合: 画像を表示
          <Image
            src={preview}
            alt="ヘッダー画像"
            fill
            className="object-cover"
          />
        ) : (
          // 画像がない場合: カメラアイコンを中央に表示
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <CameraIcon className="w-8 h-8" />
          </div>
        )}

        {/* ホバー時のオーバーレイ */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {loading ? (
            // ローディング中: スピナーを表示
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            // ホバー時: 変更ボタンを表示
            <Button variant="secondary" size="sm">
              <CameraIcon className="w-4 h-4 mr-2" />
              変更する
            </Button>
          )}
        </div>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}

      {/* ファイル形式・推奨サイズの説明 */}
      <p className="text-xs text-muted-foreground mt-2">
        JPEG、PNG、WebP形式（4MB以下）、推奨サイズ: 1500x500px
      </p>
    </div>
  )
}
