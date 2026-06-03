/**
 * @module components/shop/ShopChangeRequestForm
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createShopChangeRequest, type ShopChangeRequestData } from '@/lib/actions/shop'
import { MSG_ERROR_FALLBACK, MSG_SHOP_CHANGE_REQUIRED } from '@/lib/constants/messages'
import { TIMEOUT_MODAL_AUTO_CLOSE_MS } from '@/lib/constants/limits'

interface ShopInfo {
  id: string
  name: string
  address: string
  phone: string | null
  website: string | null
  businessHours: string | null
  closedDays: string | null
}

interface ShopChangeRequestFormProps {
  shop: ShopInfo
  onClose: () => void
}

export function ShopChangeRequestForm({ shop, onClose }: ShopChangeRequestFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [checkedFields, setCheckedFields] = useState<Record<EditableField, boolean>>({
    name: false,
    address: false,
    phone: false,
    website: false,
    businessHours: false,
    closedDays: false,
  })

  const [values, setValues] = useState<ShopChangeRequestData>({
    name: shop.name,
    address: shop.address,
    phone: shop.phone || '',
    website: shop.website || '',
    businessHours: shop.businessHours || '',
    closedDays: shop.closedDays || '',
  })

  const [reason, setReason] = useState('')

  const handleFieldToggle = (field: EditableField) => {
    setCheckedFields((prev) => ({
      ...prev,
      [field]: !prev[field],
    }))
  }

  const handleValueChange = (field: keyof ShopChangeRequestData, value: string) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // チェック済みかつ実際に値が変わったフィールドのみ送信する
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

    if (!hasChanges) {
      setError(MSG_SHOP_CHANGE_REQUIRED)
      return
    }

    setIsSubmitting(true)

    const result = await createShopChangeRequest(shop.id, changes, reason)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setIsSubmitting(false)
    } else {
      setSuccess(true)
      // 「送信できた」ことを目視確認できる時間を空けてから閉じ、ページを更新する
      setTimeout(() => {
        onClose()
        router.refresh()
      }, TIMEOUT_MODAL_AUTO_CLOSE_MS)
    }
  }

  const fieldLabels = {
    name: '名称',
    address: '住所',
    phone: '電話番号',
    website: 'ウェブサイト',
    businessHours: '営業時間',
    closedDays: '定休日',
  } as const satisfies Record<keyof ShopChangeRequestData, string>
  type EditableField = keyof typeof fieldLabels

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div className="bg-card rounded-lg shadow-xl max-w-lg w-full p-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-foreground">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">変更リクエストを送信しました</h3>
            <p className="text-sm text-muted-foreground">
              管理者が確認後、変更が反映されます。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
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

          <p className="text-sm text-muted-foreground mb-4">
            変更したい項目にチェックを入れ、正しい情報を入力してください。
            リクエストは管理者が確認後に反映されます。
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
