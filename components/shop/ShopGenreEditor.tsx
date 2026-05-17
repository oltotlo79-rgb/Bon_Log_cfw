/**
 * @file ShopGenreEditor.tsx
 * @description 盆栽園の取り扱いジャンル編集コンポーネント
 *
 * 機能概要:
 * - 盆栽園の取り扱いジャンルをインライン編集できる
 * - ログインユーザーのみ編集ボタンが表示される
 * - 最大5つまでジャンルを選択可能
 * - 編集モード時に利用可能なジャンル一覧を動的に取得
 * - 保存時にServer Actionでサーバーに送信
 *
 * 使用例:
 * ```tsx
 * <ShopGenreEditor
 *   shopId="shop-123"
 *   currentGenres={[{ id: '1', name: '松柏類' }]}
 *   isLoggedIn={true}
 * />
 * ```
 */
'use client'

// React hooks
// useState: 編集モード、選択状態、ローディング状態などを管理
// useEffect: 編集モード開始時にジャンル一覧を非同期取得
import { useState, useEffect } from 'react'

// Next.jsのルーターフック
// 保存後のページ更新に使用
import { useRouter } from 'next/navigation'

// Server Actions - ジャンル関連の操作
// updateShopGenres: 盆栽園のジャンルを更新
// getShopGenres: 利用可能なジャンル一覧を取得
import { updateShopGenres, getShopGenres } from '@/lib/actions/shop'
import { MAX_SHOP_GENRES } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * ジャンル情報の型定義
 */
interface Genre {
  /** ジャンルの一意識別子 */
  id: string
  /** ジャンル名（例: 松柏類） */
  name: string
}

/**
 * ShopGenreEditorコンポーネントのプロパティ定義
 */
interface ShopGenreEditorProps {
  /** 盆栽園のID */
  shopId: string
  /** 現在設定されているジャンルの配列 */
  currentGenres: Genre[]
  /** ログイン状態（編集ボタンの表示/非表示に影響） */
  isLoggedIn: boolean
}

/**
 * 編集アイコン（鉛筆）コンポーネント
 *
 * @param className - 追加のCSSクラス名
 */
function EditIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

/**
 * チェックアイコンコンポーネント
 * 保存ボタンに使用
 *
 * @param className - 追加のCSSクラス名
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/**
 * Xアイコン（閉じる）コンポーネント
 * キャンセルボタンに使用
 *
 * @param className - 追加のCSSクラス名
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
 * 盆栽園ジャンル編集コンポーネント
 *
 * インライン編集形式で盆栽園の取り扱いジャンルを編集できる。
 * 編集モードではトグルボタン形式でジャンルを選択/解除可能。
 * 最大5つまで選択可能という制限がある。
 *
 * @param shopId - 盆栽園のID
 * @param currentGenres - 現在設定されているジャンル
 * @param isLoggedIn - ログイン状態
 */
export function ShopGenreEditor({ shopId, currentGenres, isLoggedIn }: ShopGenreEditorProps) {
  // ルーターインスタンス（保存後のページ更新用）
  const router = useRouter()

  // 編集モードの状態（true: 編集中、false: 表示モード）
  const [isEditing, setIsEditing] = useState(false)

  // 選択されているジャンルIDの配列
  // 初期値は現在のジャンルIDリスト
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(
    currentGenres.map((g) => g.id)
  )

  // 利用可能なジャンル一覧（編集モード時にAPIから取得）
  const [availableGenres, setAvailableGenres] = useState<Genre[]>([])

  // ジャンル一覧の読み込み中状態
  const [isLoading, setIsLoading] = useState(false)

  // 保存処理中の状態
  const [isSaving, setIsSaving] = useState(false)

  // エラーメッセージの状態
  const [error, setError] = useState<string | null>(null)

  /**
   * 編集モード開始時にジャンル一覧を非同期で取得
   * 一度取得したら再取得しない（availableGenres.length > 0）
   */
  useEffect(() => {
    if (isEditing && availableGenres.length === 0) {
      let isCancelled = false
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 非同期データ取得のローディング状態管理
      setIsLoading(true)
      getShopGenres()
        .then((result) => {
          if (!isCancelled && result.genres) {
            setAvailableGenres(result.genres)
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsLoading(false)
          }
        })
      // クリーンアップ関数: コンポーネントのアンマウント時に処理をキャンセル
      return () => {
        isCancelled = true
      }
    }
  }, [isEditing, availableGenres.length])

  /**
   * ジャンルの選択/解除をトグルするハンドラ
   * 最大5つまでの制限がある
   *
   * @param genreId - トグルするジャンルのID
   */
  const handleToggleGenre = (genreId: string) => {
    setSelectedGenreIds((prev) => {
      if (prev.includes(genreId)) {
        // 選択済みの場合は解除
        return prev.filter((id) => id !== genreId)
      } else if (prev.length < MAX_SHOP_GENRES) {
        // 未選択で5つ未満の場合は追加
        return [...prev, genreId]
      }
      // 5つ選択済みの場合は何もしない
      return prev
    })
  }

  /**
   * 保存ボタンのハンドラ
   * Server Actionでジャンルを更新し、成功したら編集モードを終了
   */
  const handleSave = async () => {
    setError(null)
    setIsSaving(true)

    const result = await updateShopGenres(shopId, selectedGenreIds)

    setIsSaving(false)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      return
    }

    // 保存成功 - 編集モードを終了してページを更新
    setIsEditing(false)
    router.refresh()
  }

  /**
   * キャンセルボタンのハンドラ
   * 選択状態を元に戻して編集モードを終了
   */
  const handleCancel = () => {
    // 選択状態を初期状態（現在のジャンル）にリセット
    setSelectedGenreIds(currentGenres.map((g) => g.id))
    setError(null)
    setIsEditing(false)
  }

  // ログインしていない場合は編集ボタンを表示しない（読み取り専用）
  if (!isLoggedIn) {
    return (
      <div className="mt-4">
        <p className="text-sm text-muted-foreground mb-2">取り扱いジャンル</p>
        {currentGenres.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {currentGenres.map((genre) => (
              <span
                key={genre.id}
                className="px-3 py-1 text-sm bg-muted rounded-full"
              >
                {genre.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">未設定</p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-4">
      {/* ヘッダー: ラベルと編集ボタン */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">取り扱いジャンル</p>
        {/* 編集モードでない場合のみ編集ボタンを表示 */}
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <EditIcon className="w-3 h-3" />
            <span>編集</span>
          </button>
        )}
      </div>

      {isEditing ? (
        // 編集モード
        <div className="space-y-3">
          {isLoading ? (
            // ジャンル一覧読み込み中
            <div className="text-sm text-muted-foreground">読み込み中...</div>
          ) : (
            <>
              {/* ジャンル選択ボタンリスト */}
              <div className="flex flex-wrap gap-2">
                {availableGenres.map((genre) => {
                  const isSelected = selectedGenreIds.includes(genre.id)
                  return (
                    <button
                      key={genre.id}
                      onClick={() => handleToggleGenre(genre.id)}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border'
                      }`}
                    >
                      {genre.name}
                    </button>
                  )
                })}
              </div>

              {/* 選択数の表示 */}
              <p className="text-xs text-muted-foreground">
                {selectedGenreIds.length}/{MAX_SHOP_GENRES} 選択中
              </p>

              {/* エラーメッセージ */}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {/* 保存・キャンセルボタン */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span>{isSaving ? '保存中...' : '保存'}</span>
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
                >
                  <XIcon className="w-4 h-4" />
                  <span>キャンセル</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : currentGenres.length > 0 ? (
        // 表示モード（ジャンルあり）
        <div className="flex flex-wrap gap-2">
          {currentGenres.map((genre) => (
            <span
              key={genre.id}
              className="px-3 py-1 text-sm bg-muted rounded-full"
            >
              {genre.name}
            </span>
          ))}
        </div>
      ) : (
        // 表示モード（ジャンルなし）
        <p className="text-sm text-muted-foreground">未設定</p>
      )}
    </div>
  )
}
