/**
 * @module components/shop/ShopGenreEditor
 */
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateShopGenres, getShopGenres } from '@/lib/actions/shop'
import { MAX_SHOP_GENRES } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

interface Genre {
  id: string
  name: string
}

interface ShopGenreEditorProps {
  shopId: string
  currentGenres: Genre[]
  isLoggedIn: boolean
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function ShopGenreEditor({ shopId, currentGenres, isLoggedIn }: ShopGenreEditorProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(
    currentGenres.map((g) => g.id)
  )
  const [availableGenres, setAvailableGenres] = useState<Genre[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 編集モード開始時に一度だけジャンル一覧を取得する
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
      return () => {
        isCancelled = true
      }
    }
  }, [isEditing, availableGenres.length])

  const handleToggleGenre = (genreId: string) => {
    setSelectedGenreIds((prev) => {
      if (prev.includes(genreId)) {
        return prev.filter((id) => id !== genreId)
      } else if (prev.length < MAX_SHOP_GENRES) {
        return [...prev, genreId]
      }
      return prev
    })
  }

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)

    const result = await updateShopGenres(shopId, selectedGenreIds)

    setIsSaving(false)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      return
    }

    setIsEditing(false)
    router.refresh()
  }

  const handleCancel = () => {
    setSelectedGenreIds(currentGenres.map((g) => g.id))
    setError(null)
    setIsEditing(false)
  }

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
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">取り扱いジャンル</p>
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
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">読み込み中...</div>
          ) : (
            <>
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

              <p className="text-xs text-muted-foreground">
                {selectedGenreIds.length}/{MAX_SHOP_GENRES} 選択中
              </p>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

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
