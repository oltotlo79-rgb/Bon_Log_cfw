/**
 * @file ShopChangeRequestForm.tsx
 * @description 盆栽園情報の変更リクエストフォームコンポーネント
 *
 * 機能概要:
 * - 非オーナーのユーザーが盆栽園情報の修正をリクエストできる
 * - 変更したい項目をチェックボックスで選択し、新しい値を入力
 * - 変更理由を任意で記入可能
 * - リクエストは管理者が確認後に反映される
 * - 送信成功時に成功メッセージを表示してモーダルを閉じる
 *
 * 使用例:
 * ```tsx
 * <ShopChangeRequestForm
 *   shop={shopInfo}
 *   onClose={() => setShowForm(false)}
 * />
 * ```
 */
'use client'

// React hooks
// useState: フォーム状態、チェック状態、送信状態などを管理
import { useState } from 'react'

// Next.jsのルーターフック
// 送信後のページ更新に使用
import { useRouter } from 'next/navigation'

// Server Action - 変更リクエストの作成
// createShopChangeRequest: 変更リクエストをサーバーに送信
// ShopChangeRequestData: 変更リクエストのデータ型
import { createShopChangeRequest, type ShopChangeRequestData } from '@/lib/actions/shop'
import { MSG_ERROR_FALLBACK, MSG_SHOP_CHANGE_REQUIRED } from '@/lib/constants/messages'
import { TIMEOUT_MODAL_AUTO_CLOSE_MS } from '@/lib/constants/limits'

/**
 * 盆栽園情報の型定義
 * フォームで編集可能な項目を定義
 */
interface ShopInfo {
  /** 盆栽園の一意識別子 */
  id: string
  /** 盆栽園名 */
  name: string
  /** 住所 */
  address: string
  /** 電話番号（任意） */
  phone: string | null
  /** ウェブサイトURL（任意） */
  website: string | null
  /** 営業時間（任意） */
  businessHours: string | null
  /** 定休日（任意） */
  closedDays: string | null
}

/**
 * ShopChangeRequestFormコンポーネントのプロパティ定義
 */
interface ShopChangeRequestFormProps {
  /** 変更対象の盆栽園情報 */
  shop: ShopInfo
  /** モーダルを閉じる際のコールバック関数 */
  onClose: () => void
}

/**
 * 盆栽園情報変更リクエストフォームコンポーネント
 *
 * モーダルダイアログとして表示され、ユーザーが変更したい項目を
 * チェックボックスで選択し、新しい値を入力できる。
 * 送信されたリクエストは管理者による承認後に反映される。
 *
 * @param shop - 変更対象の盆栽園情報
 * @param onClose - モーダルを閉じる際のコールバック
 */
export function ShopChangeRequestForm({ shop, onClose }: ShopChangeRequestFormProps) {
  // ルーターインスタンス（送信後のページ更新用）
  const router = useRouter()

  // 送信処理中の状態
  const [isSubmitting, setIsSubmitting] = useState(false)

  // エラーメッセージの状態
  const [error, setError] = useState<string | null>(null)

  // 送信成功状態（成功メッセージ表示用）
  const [success, setSuccess] = useState(false)

  // 変更したいフィールドのチェック状態を管理
  // キー: フィールド名、値: チェックされているかどうか
  const [checkedFields, setCheckedFields] = useState<Record<EditableField, boolean>>({
    name: false,
    address: false,
    phone: false,
    website: false,
    businessHours: false,
    closedDays: false,
  })

  // 各フィールドの変更後の値を管理
  // 初期値は現在の盆栽園情報
  const [values, setValues] = useState<ShopChangeRequestData>({
    name: shop.name,
    address: shop.address,
    phone: shop.phone || '',
    website: shop.website || '',
    businessHours: shop.businessHours || '',
    closedDays: shop.closedDays || '',
  })

  // 変更理由（任意入力）
  const [reason, setReason] = useState('')

  /**
   * フィールドのチェック状態をトグルするハンドラ
   *
   * @param field - トグルするフィールド名
   */
  const handleFieldToggle = (field: EditableField) => {
    setCheckedFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  /**
   * フィールドの値を更新するハンドラ
   *
   * @param field - 更新するフィールド名
   * @param value - 新しい値
   */
  const handleValueChange = (field: keyof ShopChangeRequestData, value: string) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  /**
   * フォーム送信ハンドラ
   * チェックされたフィールドの中で、実際に値が変更されているものだけを送信
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // チェックされたフィールドのみを変更内容として収集
    const changes: ShopChangeRequestData = {}
    let hasChanges = false

    const fields = Object.keys(checkedFields) as EditableField[]
    for (const key of fields) {
      if (!checkedFields[key]) continue
      const newValue = values[key]
      const originalValue = shop[key] ?? ''

      if (newValue !== originalValue) {
        changes[key] = newValue
        hasChanges = true
      }
    }

    // 変更がない場合はエラーを表示
    if (!hasChanges) {
      setError(MSG_SHOP_CHANGE_REQUIRED)
      return
    }

    setIsSubmitting(true)

    // Server Actionで変更リクエストを送信
    const result = await createShopChangeRequest(shop.id, changes, reason)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setIsSubmitting(false)
    } else {
      setSuccess(true)
      // 「送信できた」ことを目視確認できる時間を空けてからモーダルを閉じ、ページを更新する。
      setTimeout(() => {
        onClose()
        router.refresh()
      }, TIMEOUT_MODAL_AUTO_CLOSE_MS)
    }
  }

  /**
   * フィールド名とラベルのマッピング
   * 日本語ラベルを表示するために使用
   */
  const fieldLabels = {
    name: '名称',
    address: '住所',
    phone: '電話番号',
    website: 'ウェブサイト',
    businessHours: '営業時間',
    closedDays: '定休日',
  } as const satisfies Record<keyof ShopChangeRequestData, string>
  type EditableField = keyof typeof fieldLabels

  // 送信成功時の画面表示
  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-card rounded-lg shadow-xl max-w-lg w-full p-6">
          <div className="text-center">
            {/* 成功アイコン */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-foreground">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            {/* 成功メッセージ */}
            <h3 className="text-lg font-semibold mb-2">変更リクエストを送信しました</h3>
            <p className="text-sm text-muted-foreground">
              管理者が確認後、変更が反映されます。
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 通常のフォーム表示
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* ヘッダー: タイトルと閉じるボタン */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">情報の変更をリクエスト</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* 説明テキスト */}
          <p className="text-sm text-muted-foreground mb-4">
            変更したい項目にチェックを入れ、正しい情報を入力してください。
            リクエストは管理者が確認後に反映されます。
          </p>

          {/* エラーメッセージ表示エリア */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
              {error}
            </div>
          )}

          {/* 変更リクエストフォーム */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 各フィールドのチェックボックスと入力欄 */}
            {(Object.entries(fieldLabels) as [EditableField, string][]).map(([field, label]) => (
              <div key={field} className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checkedFields[field]}
                    onChange={() => handleFieldToggle(field)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>

                {checkedFields[field] && (
                  <div className="ml-6 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      現在: {shop[field] || '（未設定）'}
                    </p>
                    {field === 'businessHours' || field === 'closedDays' ? (
                      <textarea
                        value={values[field] || ''}
                        onChange={(e) => handleValueChange(field, e.target.value)}
                        placeholder={`新しい${label}を入力`}
                        className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                        rows={2}
                      />
                    ) : (
                      <input
                        type={field === 'website' ? 'url' : 'text'}
                        value={values[field] || ''}
                        onChange={(e) => handleValueChange(field, e.target.value)}
                        placeholder={`新しい${label}を入力`}
                        className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* 変更理由（任意） */}
            <div className="space-y-2 pt-4 border-t">
              <label className="text-sm font-medium">
                変更理由（任意）
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="変更をリクエストする理由を入力してください（例：閉店時間が変更されていました）"
                className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                rows={3}
              />
            </div>

            {/* 送信・キャンセルボタン */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !Object.values(checkedFields).some(Boolean)}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? '送信中...' : 'リクエストを送信'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
