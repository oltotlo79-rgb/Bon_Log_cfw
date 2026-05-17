/**
 * @file ShopForm.tsx
 * @description 盆栽園の新規登録・編集フォームコンポーネント
 *
 * 機能概要:
 * - 盆栽園の新規登録と既存データの編集に対応
 * - 住所入力時のリアルタイム候補検索（ジオコーディング）
 * - 位置情報（緯度・経度）の自動取得
 * - 取り扱いジャンルの複数選択
 * - 営業時間のアナログ時計による直感的な入力
 * - 位置情報未取得時の確認ダイアログ表示
 * - 盆栽園の削除機能（編集モード時のみ）
 *
 * 使用例:
 * ```tsx
 * // 新規登録
 * <ShopForm genres={genres} mode="create" />
 *
 * // 編集
 * <ShopForm genres={genres} initialData={shopData} mode="edit" />
 * ```
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createShop, updateShop, deleteShop } from '@/lib/actions/shop'
import { buildShopPath } from '@/lib/constants/path-builders'
import { ROUTE_SHOPS } from '@/lib/constants/routes'
import { FormError } from '@/components/common/FormError'
import { AddressGeocodingSection } from './form/AddressGeocodingSection'
import { BusinessHoursSection } from './form/BusinessHoursSection'
import { ShopGenreSelector } from './form/ShopGenreSelector'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * ジャンル情報の型定義
 */
interface Genre {
  id: string
  name: string
  category: string
}

/**
 * 編集モードで必要な盆栽園の初期データ。
 */
type ShopFormInitialData = {
  id: string
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  phone: string | null
  website: string | null
  businessHours: string | null
  closedDays: string | null
  genres: Genre[]
}

/**
 * ShopFormコンポーネントのプロパティ定義。
 *
 * `mode === 'edit'` の場合は `initialData` が必須、`mode === 'create'` では渡せない、
 * という制約を discriminated union で型レベルに表現する。
 * これにより、サブミット内での `initialData!.id` のような非 null アサーションが不要になる。
 */
type ShopFormProps =
  | { genres: Genre[]; mode: 'create'; initialData?: never }
  | { genres: Genre[]; mode: 'edit'; initialData: ShopFormInitialData }

/**
 * 盆栽園登録・編集フォームコンポーネント
 */
export function ShopForm({ genres, initialData, mode }: ShopFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [error, setError] = useState<string | null>(null)

  // フォーム入力値
  const [name, setName] = useState(initialData?.name || '')
  const [address, setAddress] = useState(initialData?.address || '')
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude || null)
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude || null)
  const [phone, setPhone] = useState(initialData?.phone || '')
  const [website, setWebsite] = useState(initialData?.website || '')
  const [businessHours, setBusinessHours] = useState(initialData?.businessHours || '')
  const [closedDays, setClosedDays] = useState(initialData?.closedDays || '')
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>(
    initialData?.genres.map((g) => g.id) || []
  )

  // 確認ダイアログ
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState(false)

  // 削除ダイアログ
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  /**
   * 実際のフォーム送信処理
   */
  const executeSubmit = () => {
    startTransition(async () => {
      const formData = new FormData()
      formData.append('name', name)
      formData.append('address', address)
      if (latitude !== null) formData.append('latitude', latitude.toString())
      if (longitude !== null) formData.append('longitude', longitude.toString())
      if (phone) formData.append('phone', phone)
      if (website) formData.append('website', website)
      if (businessHours) formData.append('businessHours', businessHours)
      if (closedDays) formData.append('closedDays', closedDays)
      selectedGenreIds.forEach((id) => formData.append('genreIds', id))

      // discriminated union により mode で initialData の型が絞り込まれる。
      const result = mode === 'edit'
        ? await updateShop(initialData.id, formData)
        : await createShop(formData)

      if (!result.success) {
        const errMsg = result.error ?? MSG_ERROR_FALLBACK
        setError(errMsg)
        if ('existingId' in result && result.existingId) {
          setError(`${errMsg}。既存の盆栽園を確認しますか？`)
        }
        return
      }

      if (mode === 'edit') {
        router.push(buildShopPath(initialData.id))
        router.refresh()
        return
      }

      if (result.data && 'shopId' in result.data) {
        router.push(buildShopPath(result.data.shopId))
        router.refresh()
      }
    })
  }

  /**
   * フォーム送信ハンドラ
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (latitude === null || longitude === null) {
      setShowConfirmDialog(true)
      setPendingSubmit(true)
      return
    }

    executeSubmit()
  }

  const handleConfirmSubmit = () => {
    setShowConfirmDialog(false)
    setPendingSubmit(false)
    executeSubmit()
  }

  const handleCancelSubmit = () => {
    setShowConfirmDialog(false)
    setPendingSubmit(false)
  }

  /**
   * 盆栽園削除処理
   */
  const handleDelete = async () => {
    if (!initialData?.id) return

    setIsDeleting(true)
    const result = await deleteShop(initialData.id)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setIsDeleting(false)
      setShowDeleteDialog(false)
    } else {
      router.replace(ROUTE_SHOPS)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* エラーメッセージ */}
      <FormError message={error} />

      {/* 名称入力 */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          名称 <span className="text-destructive">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: ○○盆栽園"
        />
      </div>

      {/* 住所入力 + ジオコーディング */}
      <AddressGeocodingSection
        address={address}
        latitude={latitude}
        longitude={longitude}
        onAddressChange={(v) => {
          setAddress(v)
          // 住所変更時に位置情報をリセット
          setLatitude(null)
          setLongitude(null)
        }}
        onLocationSet={(lat, lng) => {
          setLatitude(lat)
          setLongitude(lng)
        }}
        disabled={isPending}
      />

      {/* 電話番号 */}
      <div className="space-y-2">
        <label htmlFor="phone" className="text-sm font-medium">
          電話番号
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: 03-1234-5678"
        />
      </div>

      {/* ウェブサイト */}
      <div className="space-y-2">
        <label htmlFor="website" className="text-sm font-medium">
          ウェブサイト
        </label>
        <input
          id="website"
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: https://example.com"
        />
      </div>

      {/* 営業時間・定休日 */}
      <BusinessHoursSection
        businessHours={businessHours}
        closedDays={closedDays}
        onBusinessHoursChange={setBusinessHours}
        onClosedDaysChange={setClosedDays}
        disabled={isPending}
      />

      {/* ジャンル選択 */}
      <ShopGenreSelector
        selectedGenreIds={selectedGenreIds}
        availableGenres={genres}
        onChange={setSelectedGenreIds}
        disabled={isPending}
      />

      {/* 送信・キャンセルボタン */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={isPending || pendingSubmit}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending
            ? mode === 'create' ? '登録中...' : '更新中...'
            : mode === 'create' ? '登録する' : '更新する'
          }
        </button>
      </div>

      {/* 削除ボタン（編集モードのみ） */}
      {mode === 'edit' && (
        <div className="pt-4 border-t">
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            className="w-full px-4 py-2 text-destructive border border-destructive rounded-lg hover:bg-destructive/10 disabled:opacity-50"
          >
            この盆栽園を削除
          </button>
        </div>
      )}

      {/* 位置取得未実行時の確認ダイアログ */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-muted-foreground">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">位置情報が取得されていません</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  位置取得をしていないと、盆栽園マップに位置がマークされません。
                  このまま登録してもよろしいですか？
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelSubmit}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted"
              >
                戻って位置取得
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                このまま登録
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-destructive">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg">盆栽園を削除</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  「{initialData?.name}」を削除しますか？この操作は取り消せません。
                  レビューも全て削除されます。
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
