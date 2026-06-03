'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBonsai, updateBonsai } from '@/lib/actions/bonsai'
import { FormError } from '@/components/common/FormError'
import { getFormString } from '@/lib/utils/form-data'
import { buildBonsaiPath } from '@/lib/constants/path-builders'

interface BonsaiFormProps {
  bonsai?: {
    id: string
    name: string
    species: string | null
    acquiredAt: Date | null
    description: string | null
  }
}

export function BonsaiForm({ bonsai }: BonsaiFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)

    const acquiredAtRaw = getFormString(formData, 'acquiredAt')
    const data = {
      name: getFormString(formData, 'name') ?? '',
      species: getFormString(formData, 'species') || undefined,
      acquiredAt: acquiredAtRaw ? new Date(acquiredAtRaw) : undefined,
      description: getFormString(formData, 'description') || undefined,
    }

    try {
      if (bonsai) {
        const result = await updateBonsai(bonsai.id, data)
        if (!result.success) {
          setError(result.error)
          return
        }
        router.push(buildBonsaiPath(bonsai.id))
      } else {
        const result = await createBonsai(data)
        if (!result.success) {
          setError(result.error)
          return
        }
        if (result.data?.bonsai) {
          router.push(buildBonsaiPath(result.data.bonsai.id))
        }
      }
      router.refresh()
    } catch {
      setError('エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          名前 <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={bonsai?.name || ''}
          required
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例: 黒松一号"
        />
      </div>

      <div>
        <label htmlFor="species" className="block text-sm font-medium mb-1">
          樹種
        </label>
        <select
          id="species"
          name="species"
          defaultValue={bonsai?.species || ''}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">選択してください</option>
          <optgroup label="松柏類">
            <option value="黒松">黒松</option>
            <option value="赤松">赤松</option>
            <option value="五葉松">五葉松</option>
            <option value="真柏">真柏</option>
            <option value="杜松">杜松</option>
            <option value="檜">檜</option>
            <option value="椹">椹</option>
            <option value="檜葉/翌檜">檜葉/翌檜</option>
            <option value="杉">杉</option>
            <option value="一位">一位</option>
            <option value="キャラボク">キャラボク</option>
            <option value="蝦夷松">蝦夷松</option>
            <option value="落葉松">落葉松</option>
            <option value="米栂">米栂</option>
            <option value="樅木">樅木</option>
            <option value="榧">榧</option>
            <option value="槙">槙</option>
            <option value="その他松柏類">その他松柏類</option>
          </optgroup>
          <optgroup label="雑木類">
            <option value="紅葉">紅葉</option>
            <option value="楓">楓</option>
            <option value="匂楓">匂楓</option>
            <option value="銀杏">銀杏</option>
            <option value="欅">欅</option>
            <option value="楡欅">楡欅</option>
            <option value="梅">梅</option>
            <option value="長寿梅/木瓜">長寿梅/木瓜</option>
            <option value="梅擬">梅擬</option>
            <option value="蔓梅擬/岩梅蔓">蔓梅擬/岩梅蔓</option>
            <option value="縮緬蔓">縮緬蔓</option>
            <option value="金豆">金豆</option>
            <option value="ピラカンサ">ピラカンサ</option>
            <option value="花梨">花梨</option>
            <option value="台湾黄楊">台湾黄楊</option>
            <option value="イボタ">イボタ</option>
            <option value="群雀">群雀</option>
            <option value="香丁木/白丁木">香丁木/白丁木</option>
            <option value="真弓">真弓</option>
            <option value="小真弓">小真弓</option>
            <option value="ブナ">ブナ</option>
            <option value="梔子">梔子</option>
            <option value="グミ">グミ</option>
            <option value="桜">桜</option>
            <option value="皐月">皐月</option>
            <option value="椿">椿</option>
            <option value="山茶花">山茶花</option>
            <option value="柿">柿</option>
            <option value="柘榴">柘榴</option>
            <option value="百日紅">百日紅</option>
            <option value="姫林檎/海棠">姫林檎/海棠</option>
            <option value="柊">柊</option>
            <option value="針蔓柾">針蔓柾</option>
            <option value="蔦">蔦</option>
            <option value="イヌビワ">イヌビワ</option>
            <option value="紫式部">紫式部</option>
            <option value="レンギョウ">レンギョウ</option>
            <option value="その他雑木類">その他雑木類</option>
          </optgroup>
          <optgroup label="草もの">
            <option value="山野草">山野草</option>
            <option value="苔">苔</option>
          </optgroup>
        </select>
      </div>

      <div>
        <label htmlFor="acquiredAt" className="block text-sm font-medium mb-1">
          入手日
        </label>
        <input
          type="date"
          id="acquiredAt"
          name="acquiredAt"
          defaultValue={
            bonsai?.acquiredAt
              ? new Date(bonsai.acquiredAt).toISOString().split('T')[0]
              : ''
          }
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          メモ
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={bonsai?.description || ''}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="この盆栽についてのメモを入力"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? '保存中...' : bonsai ? '更新' : '登録'}
        </button>
      </div>
    </form>
  )
}
