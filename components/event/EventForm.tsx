/**
 * @file EventForm.tsx
 * @description イベント作成・編集フォームコンポーネント
 *
 * 目的:
 * - 新規イベントの作成機能を提供する
 * - 既存イベントの編集機能を提供する
 * - フォームバリデーションとエラー表示を行う
 *
 * 機能概要:
 * - イベント情報の入力フォーム（タイトル、日時、場所、詳細等）
 * - 作成モードと編集モードの切り替え
 * - Server Actionsを使用した非同期データ送信
 * - 送信中のローディング状態表示
 * - バリデーションエラーの表示
 *
 * 使用例:
 * ```tsx
 * // 新規作成モード
 * <EventForm mode="create" />
 *
 * // 編集モード（既存データを渡す）
 * <EventForm
 *   mode="edit"
 *   initialData={{
 *     id: 'event-1',
 *     title: '第30回 全国盆栽展',
 *     startDate: new Date('2024-05-01T10:00'),
 *     endDate: new Date('2024-05-05T17:00'),
 *     prefecture: '埼玉県',
 *     city: 'さいたま市',
 *     venue: '大宮盆栽美術館',
 *     organizer: '全日本盆栽協会',
 *     fee: '500円',
 *     hasSales: true,
 *     description: 'イベントの詳細説明...',
 *     externalUrl: 'https://example.com'
 *   }}
 * />
 * ```
 */

// Client Componentとして宣言（useState, useTransitionを使用するため）
'use client'

// React Hooks - 状態管理と非同期遷移の管理
import { useState, useTransition } from 'react'

// Next.jsのルーター - プログラムによるページ遷移に使用
import { useRouter } from 'next/navigation'

// イベント作成・更新のServer Actions
import { createEvent, updateEvent } from '@/lib/actions/event'

// 都道府県の定数データ - セレクトボックスの選択肢として使用
import { PREFECTURES } from '@/lib/prefectures'
import { MAX_EVENT_TITLE_LENGTH } from '@/lib/constants/limits'
import { buildEventPath } from '@/lib/constants/path-builders'

// 共通エラー表示コンポーネント
import { FormError } from '@/components/common/FormError'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * 編集モードで必要なイベントの初期データ。
 *
 * id は編集 API の必須引数で、その他は フォーム入力欄のプリフィル値。
 */
type EventFormInitialData = {
  /** イベントID（編集時に必須） */
  id: string
  /** イベントタイトル */
  title: string
  /** 開始日時 */
  startDate: Date
  /** 終了日時（単日イベントの場合はnull） */
  endDate: Date | null
  /** 開催都道府県 */
  prefecture: string | null
  /** 開催市区町村 */
  city: string | null
  /** 会場名 */
  venue: string | null
  /** 主催者名 */
  organizer: string | null
  /** 入場料 */
  fee: string | null
  /** 即売会の有無 */
  hasSales: boolean
  /** イベント詳細説明 */
  description: string | null
  /** 外部リンクURL */
  externalUrl: string | null
}

/**
 * EventFormコンポーネントのプロパティ型定義。
 *
 * `mode === 'edit'` の場合は `initialData` が必須、`mode === 'create'` では渡せない、
 * という制約を discriminated union で型レベルに表現する。
 * これにより、サブミットハンドラ内での `initialData!.id` のような
 * 非 null アサーションが不要になる。
 */
type EventFormProps =
  | { mode: 'create'; initialData?: never }
  | { mode: 'edit'; initialData: EventFormInitialData }

/**
 * Date型をdatetime-local input用の文字列形式に変換する関数
 * datetime-local inputは "YYYY-MM-DDTHH:mm" 形式の文字列を要求する
 *
 * @param date - 変換するDateオブジェクト（nullの場合は空文字を返す）
 * @returns datetime-local input用のフォーマット文字列
 *
 * @example
 * formatDateForInput(new Date('2024-05-01T10:00:00'))
 * // => "2024-05-01T10:00"
 */
function formatDateForInput(date: Date | null): string {
  if (!date) return ''
  const d = new Date(date)
  // ISO文字列の先頭16文字を取得（"YYYY-MM-DDTHH:mm"部分）
  return d.toISOString().slice(0, 16)
}

/**
 * イベントフォームコンポーネント
 * イベントの作成・編集を行うためのフォームを提供する
 *
 * @param props - コンポーネントのプロパティ
 * @returns イベントフォームのReact要素
 */
export function EventForm({ mode, initialData }: EventFormProps) {
  // ページ遷移用のルーターインスタンス
  const router = useRouter()

  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * フォーム送信中の遷移状態を管理
   * isPending: 送信処理中はtrue、それ以外はfalse
   * startTransition: 非同期処理を遷移としてラップする関数
   */
  const [isPending, startTransition] = useTransition()

  /**
   * エラーメッセージを管理
   * Server Actionからのエラーや、バリデーションエラーを保持
   */
  const [error, setError] = useState<string | null>(null)

  // ------------------------------------------------------------
  // フォーム入力値の状態管理
  // 各フィールドに対応するuseStateを定義
  // 編集モードの場合はinitialDataから初期値を設定
  // ------------------------------------------------------------

  /** イベントタイトル */
  const [title, setTitle] = useState(initialData?.title || '')

  /** 開始日時（datetime-local形式の文字列） */
  const [startDate, setStartDate] = useState(formatDateForInput(initialData?.startDate || null))

  /** 終了日時（datetime-local形式の文字列） */
  const [endDate, setEndDate] = useState(formatDateForInput(initialData?.endDate || null))

  /** 開催都道府県 */
  const [prefecture, setPrefecture] = useState(initialData?.prefecture || '')

  /** 開催市区町村 */
  const [city, setCity] = useState(initialData?.city || '')

  /** 会場名 */
  const [venue, setVenue] = useState(initialData?.venue || '')

  /** 主催者名 */
  const [organizer, setOrganizer] = useState(initialData?.organizer || '')

  /** 入場料 */
  const [fee, setFee] = useState(initialData?.fee || '')

  /** 即売会の有無（チェックボックス） */
  const [hasSales, setHasSales] = useState(initialData?.hasSales || false)

  /** イベント詳細説明 */
  const [description, setDescription] = useState(initialData?.description || '')

  /** 外部リンクURL */
  const [externalUrl, setExternalUrl] = useState(initialData?.externalUrl || '')

  /**
   * フォーム送信ハンドラ
   * フォームデータを収集し、Server Actionを呼び出してイベントを作成/更新する
   *
   * @param e - フォーム送信イベント
   */
  const handleSubmit = async (e: React.FormEvent) => {
    // デフォルトのフォーム送信動作を防止
    e.preventDefault()
    // 前回のエラーをクリア
    setError(null)

    // FormDataオブジェクトを構築
    const formData = new FormData()
    formData.append('title', title)
    formData.append('startDate', startDate)
    // オプショナルなフィールドは値がある場合のみ追加
    if (endDate) formData.append('endDate', endDate)
    formData.append('prefecture', prefecture)
    if (city) formData.append('city', city)
    if (venue) formData.append('venue', venue)
    if (organizer) formData.append('organizer', organizer)
    if (fee) formData.append('fee', fee)
    formData.append('hasSales', hasSales.toString())
    if (description) formData.append('description', description)
    if (externalUrl) formData.append('externalUrl', externalUrl)

    // 非同期処理を遷移としてラップ（ローディング状態を管理）
    startTransition(async () => {
      // モードに応じてServer Actionを呼び出し。
      // discriminated union により mode で initialData の型が絞り込まれる。
      if (mode === 'edit') {
        const result = await updateEvent(initialData.id, formData)
        if (!result.success) {
          setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
          return
        }
        router.push(buildEventPath(initialData.id))
        router.refresh()
        return
      }

      const result = await createEvent(formData)
      if (!result.success) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
        return
      }
      if (result.data?.eventId) {
        router.push(buildEventPath(result.data.eventId))
      }
      // ページデータを最新に更新
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* エラーメッセージ表示エリア */}
      <FormError message={error} />

      {/* タイトル入力フィールド（必須） */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium mb-1">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={MAX_EVENT_TITLE_LENGTH}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例：第30回 全国盆栽展"
        />
      </div>

      {/* 開始日時・終了日時入力フィールド */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 開始日時（必須） */}
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium mb-1">
            開始日時 <span className="text-red-500">*</span>
          </label>
          <input
            id="startDate"
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {/* 終了日時（任意） */}
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium mb-1">
            終了日時
          </label>
          <input
            id="endDate"
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate} // 終了日時は開始日時以降のみ選択可能
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* 場所入力フィールド（都道府県・市区町村） */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 都道府県選択（必須） */}
        <div>
          <label htmlFor="prefecture" className="block text-sm font-medium mb-1">
            都道府県 <span className="text-red-500">*</span>
          </label>
          <select
            id="prefecture"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">選択してください</option>
            {/* 都道府県リストをオプションとして展開 */}
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>
        {/* 市区町村（任意） */}
        <div>
          <label htmlFor="city" className="block text-sm font-medium mb-1">
            市区町村
          </label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="例：さいたま市大宮区"
          />
        </div>
      </div>

      {/* 会場名入力フィールド（任意） */}
      <div>
        <label htmlFor="venue" className="block text-sm font-medium mb-1">
          会場名
        </label>
        <input
          id="venue"
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例：大宮盆栽美術館"
        />
      </div>

      {/* 主催者入力フィールド（任意） */}
      <div>
        <label htmlFor="organizer" className="block text-sm font-medium mb-1">
          主催者
        </label>
        <input
          id="organizer"
          type="text"
          value={organizer}
          onChange={(e) => setOrganizer(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="例：全日本盆栽協会"
        />
      </div>

      {/* 入場料・即売入力フィールド */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 入場料（任意） */}
        <div>
          <label htmlFor="fee" className="block text-sm font-medium mb-1">
            入場料
          </label>
          <input
            id="fee"
            type="text"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="例：無料、500円、1,000円"
          />
        </div>
        {/* 即売ありチェックボックス */}
        <div className="flex items-center gap-2 pt-6">
          <input
            id="hasSales"
            type="checkbox"
            checked={hasSales}
            onChange={(e) => setHasSales(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="hasSales" className="text-sm font-medium">
            即売あり
          </label>
        </div>
      </div>

      {/* 詳細説明入力フィールド（任意） */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-1">
          詳細説明
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="イベントの詳細説明を入力してください"
        />
      </div>

      {/* 外部リンク入力フィールド（任意） */}
      <div>
        <label htmlFor="externalUrl" className="block text-sm font-medium mb-1">
          外部リンク
        </label>
        <input
          id="externalUrl"
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="https://example.com"
        />
      </div>

      {/* フォーム送信ボタンエリア */}
      <div className="flex gap-3">
        {/* キャンセルボタン - 前のページに戻る */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-2 border rounded-lg hover:bg-muted transition-colors"
        >
          キャンセル
        </button>
        {/* 送信ボタン - モードに応じてラベルを変更 */}
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? '保存中...' : mode === 'create' ? '登録する' : '更新する'}
        </button>
      </div>
    </form>
  )
}
