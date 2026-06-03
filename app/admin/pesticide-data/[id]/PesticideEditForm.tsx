'use client'


import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2 } from 'lucide-react'
import type { PesticideType } from '@prisma/client'
import { updatePesticide } from '@/lib/actions/admin/pesticide-data'
import { TIMEOUT_TOAST } from '@/lib/constants/limits'

const PESTICIDE_TYPES: readonly PesticideType[] = [
  'insecticide',
  'fungicide',
  'acaricide',
  'compound',
  'other',
] as const

const PESTICIDE_TYPE_LABELS: Record<PesticideType, string> = {
  insecticide: '殺虫剤',
  fungicide: '殺菌剤',
  acaricide: '殺ダニ剤',
  compound: '複合剤',
  other: 'その他',
}

function isPesticideType(value: string): value is PesticideType {
  return (PESTICIDE_TYPES as readonly string[]).includes(value)
}

export interface PesticideEditFormProps {
  /** 編集対象の農薬ID */
  id: string
  /** 初期値（Server Component が型推論済みで渡す） */
  initial: {
    name: string
    registrationNumber: string | null
    pesticideType: PesticideType
    description: string | null
    formulationTypeName: string | null
  }
}

/**
 * 農薬の編集フォーム。
 * 保存結果をトーストメッセージで数秒表示したあと、Server Component 側を再描画する。
 */
export function PesticideEditForm({ id, initial }: PesticideEditFormProps) {
  const router = useRouter()
  const [name, setName] = useState(initial.name)
  const [registrationNumber, setRegistrationNumber] = useState(
    initial.registrationNumber ?? '',
  )
  const [pesticideType, setPesticideType] = useState<PesticideType>(initial.pesticideType)
  const [description, setDescription] = useState(initial.description ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<
    { type: 'success' | 'error'; text: string } | null
  >(null)

  async function handleSave() {
    setIsSaving(true)
    setSaveMessage(null)

    const result = await updatePesticide(id, {
      name: name.trim(),
      registrationNumber: registrationNumber.trim() || null,
      pesticideType,
      description: description.trim() || null,
    })

    if (result && 'error' in result) {
      setSaveMessage({ type: 'error', text: result.error })
    } else {
      setSaveMessage({ type: 'success', text: '保存しました' })
      // Server Component 側のデータも更新するために再取得を促す。
      router.refresh()
      setTimeout(() => setSaveMessage(null), TIMEOUT_TOAST)
    }

    setIsSaving(false)
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <h2 className="text-lg font-semibold mb-4">基本情報</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pesticide-name" className="block text-sm font-medium mb-1">
            農薬名 *
          </label>
          <input
            id="pesticide-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-sm border rounded-md px-3 py-2 bg-background"
          />
        </div>

        <div>
          <label htmlFor="pesticide-registration-number" className="block text-sm font-medium mb-1">
            登録番号
          </label>
          <input
            id="pesticide-registration-number"
            type="text"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            className="w-full text-sm border rounded-md px-3 py-2 bg-background"
          />
        </div>

        <div>
          <label htmlFor="pesticide-type" className="block text-sm font-medium mb-1">
            種別 *
          </label>
          <select
            id="pesticide-type"
            value={pesticideType}
            onChange={(e) => {
              if (isPesticideType(e.target.value)) setPesticideType(e.target.value)
            }}
            className="w-full text-sm border rounded-md px-3 py-2 bg-background"
          >
            {PESTICIDE_TYPES.map((value) => (
              <option key={value} value={value}>
                {PESTICIDE_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="pesticide-formulation" className="block text-sm font-medium mb-1">
            剤型
          </label>
          <input
            id="pesticide-formulation"
            type="text"
            value={initial.formulationTypeName ?? ''}
            disabled
            className="w-full text-sm border rounded-md px-3 py-2 bg-muted text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            剤型はマスターデータから変更してください
          </p>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="pesticide-description" className="block text-sm font-medium mb-1">
            説明
          </label>
          <textarea
            id="pesticide-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full text-sm border rounded-md px-3 py-2 bg-background resize-vertical"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存
        </button>

        {saveMessage && (
          <span
            role="status"
            aria-live="polite"
            className={`text-sm ${
              saveMessage.type === 'success'
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {saveMessage.text}
          </span>
        )}
      </div>
    </div>
  )
}
