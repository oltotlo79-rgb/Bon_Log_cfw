/** このファイルは盆栽の新規登録および既存盆栽の編集に使用される */

'use client'

// React のフック: コンポーネントの状態管理に使用
import { useState } from 'react'
// Next.js のルーター: ページ遷移とリフレッシュに使用
import { useRouter } from 'next/navigation'
import { createBonsai, updateBonsai } from '@/lib/actions/bonsai'
import { FormError } from '@/components/common/FormError'
import { getFormString } from '@/lib/utils/form-data'

/**
 * BonsaiFormコンポーネントのProps型定義
 */
interface BonsaiFormProps {
  /** 編集対象の盆栽データ（新規登録時はundefined） */
  bonsai?: {
    /** 盆栽ID */
    id: string
    /** 盆栽の名前（必須） */
    name: string
    /** 樹種（オプション） */
    species: string | null
    /** 入手日（オプション） */
    acquiredAt: Date | null
    /** 説明・メモ（オプション） */
    description: string | null
  }
}

/**
 * 盆栽登録・編集フォームコンポーネント
 *
 * bonsai propsの有無によって新規登録または編集モードで動作します。
 * フォーム送信時にServer Actionを呼び出し、成功時は詳細ページにリダイレクトします。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.bonsai - 編集対象の盆栽データ（編集モード時に指定）
 */
export function BonsaiForm({ bonsai }: BonsaiFormProps) {
  // ルーターインスタンス: ページ遷移とデータ更新に使用
  const router = useRouter()

  /**
   * フォーム送信中かどうかのフラグ
   * true: 送信処理中（ボタン無効化）、false: 待機状態
   */
  const [loading, setLoading] = useState(false)

  /**
   * エラーメッセージの状態
   * null: エラーなし、string: エラーメッセージを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * フォーム送信時のイベントハンドラ
   *
   * 処理フロー:
   * 1. フォームデータを取得・整形
   * 2. 編集モードか新規登録かを判定
   * 3. 対応するServer Actionを呼び出し
   * 4. 成功時は盆栽詳細ページにリダイレクト
   * 5. 失敗時はエラーメッセージを表示
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    // デフォルトのフォーム送信を防止
    e.preventDefault()
    // 送信処理開始
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
        // 編集モード: 既存の盆栽を更新
        const result = await updateBonsai(bonsai.id, data)
        if (!result.success) {
          setError(result.error)
          return
        }
        // 更新成功時は詳細ページにリダイレクト
        router.push(`/bonsai/${bonsai.id}`)
      } else {
        // 新規登録モード: 新しい盆栽を作成
        const result = await createBonsai(data)
        if (!result.success) {
          setError(result.error)
          return
        }
        // 作成成功時は新しい盆栽の詳細ページにリダイレクト
        if (result.data?.bonsai) {
          router.push(`/bonsai/${result.data.bonsai.id}`)
        }
      }
      // ページデータをリフレッシュ
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
      <FormError message={error} />

      {/* 名前入力フィールド（必須） */}
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

      {/* 樹種選択フィールド */}
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
          {/* 松柏類（常緑針葉樹）のグループ */}
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
          {/* 雑木類（落葉樹・花木・実もの等）のグループ */}
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
          {/* 草もの（山野草・苔など）のグループ */}
          <optgroup label="草もの">
            <option value="山野草">山野草</option>
            <option value="苔">苔</option>
          </optgroup>
        </select>
      </div>

      {/* 入手日入力フィールド */}
      <div>
        <label htmlFor="acquiredAt" className="block text-sm font-medium mb-1">
          入手日
        </label>
        <input
          type="date"
          id="acquiredAt"
          name="acquiredAt"
          defaultValue={
            // DateオブジェクトをYYYY-MM-DD形式の文字列に変換
            bonsai?.acquiredAt
              ? new Date(bonsai.acquiredAt).toISOString().split('T')[0]
              : ''
          }
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* メモ・説明入力フィールド */}
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

      {/* アクションボタン */}
      <div className="flex gap-2 pt-4">
        {/* キャンセルボタン: 前のページに戻る */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
        >
          キャンセル
        </button>
        {/* 送信ボタン: モードによってラベルを変更 */}
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
