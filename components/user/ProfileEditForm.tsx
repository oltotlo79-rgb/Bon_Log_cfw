/**
 * プロフィール編集フォームコンポーネント
 *
 * @module components/user/ProfileEditForm
 */

'use client'

/**
 * React useState Hook
 * エラー状態、成功状態、ローディング状態の管理に使用
 */
import { useState } from 'react'

/**
 * Next.js useRouter Hook
 * フォーム送信後にユーザープロフィールページへリダイレクトするために使用
 */
import { useRouter } from 'next/navigation'

/**
 * shadcn/ui Buttonコンポーネント
 * フォーム送信ボタンに使用
 */
import { Button } from '@/components/ui/button'

/**
 * shadcn/ui Inputコンポーネント
 * ニックネーム入力フィールドに使用
 */
import { Input } from '@/components/ui/input'

/**
 * shadcn/ui Labelコンポーネント
 * フォーム要素のラベル表示に使用
 */
import { Label } from '@/components/ui/label'

/**
 * shadcn/ui Textareaコンポーネント
 * 自己紹介文入力フィールドに使用
 */
import { Textarea } from '@/components/ui/textarea'

/**
 * プロフィール更新用Server Action
 * フォームデータをサーバーに送信してプロフィールを更新
 */
import { updateProfile } from '@/lib/actions/user'

/**
 * アバター画像アップローダーコンポーネント
 * プロフィール画像のアップロード機能を提供
 */
import { AvatarUploader } from './AvatarUploader'

/**
 * ヘッダー画像アップローダーコンポーネント
 * ヘッダー画像のアップロード機能を提供
 */
import { HeaderUploader } from './HeaderUploader'

/**
 * 都道府県・地域の定数データ
 * 居住地域選択のドロップダウンに使用
 */
import { LOCATION_GROUPS } from '@/lib/constants/locations'
import { MAX_NICKNAME_LENGTH, MAX_BIO_LENGTH, BONSAI_START_MIN_YEAR } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * ProfileEditFormコンポーネントのprops型
 *
 * @property user - 編集対象のユーザー情報
 * @property user.id - ユーザーの一意識別子
 * @property user.nickname - 現在のニックネーム
 * @property user.bio - 現在の自己紹介文（nullの場合は空）
 * @property user.location - 現在の居住地域（nullの場合は未選択）
 * @property user.avatar_url - 現在のアバター画像URL（nullの場合はイニシャル表示）
 * @property user.header_url - 現在のヘッダー画像URL（nullの場合はデフォルト背景）
 * @property user.bonsai_start_year - 盆栽を始めた年（nullの場合は未設定）
 * @property user.bonsai_start_month - 盆栽を始めた月（nullの場合は未設定）
 */
type ProfileEditFormProps = {
  user: {
    id: string
    nickname: string
    bio: string | null
    location: string | null
    avatar_url: string | null
    header_url: string | null
    bonsai_start_year: number | null
    bonsai_start_month: number | null
    birth_date: string | null
  }
}

/**
 * プロフィール編集フォームコンポーネント
 *
 * ## 機能
 * - ヘッダー画像とアバター画像のアップロード
 * - テキスト情報（ニックネーム、自己紹介）の編集
 * - 居住地域の選択（都道府県をグループ化して表示）
 * - 盆栽開始時期の年月選択
 * - フォーム送信後にプロフィールページへリダイレクト
 *
 * ## バリデーション
 * - ニックネームは必須入力
 * - 各フィールドに文字数制限あり
 *
 * ## 状態管理
 * - error: エラーメッセージ
 * - success: 成功フラグ（現在は未使用、リダイレクトするため）
 * - loading: 送信中フラグ
 *
 * @param user - 編集対象のユーザー情報
 *
 * @example
 * ```tsx
 * <ProfileEditForm
 *   user={{
 *     id: 'user123',
 *     nickname: '盆栽太郎',
 *     bio: '松が好きです',
 *     location: '東京都',
 *     avatar_url: '/avatars/user123.jpg',
 *     header_url: '/headers/user123.jpg',
 *     bonsai_start_year: 2020,
 *     bonsai_start_month: 4,
 *   }}
 * />
 * ```
 */
export function ProfileEditForm({ user }: ProfileEditFormProps) {

  /**
   * Next.jsルーター
   * フォーム送信成功後にプロフィールページへリダイレクト
   */
  const router = useRouter()

  /**
   * エラー状態
   * Server Actionがエラーを返した場合にエラーメッセージを格納
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * 成功状態
   * フォーム送信が成功した場合にtrueになる
   * 現在はリダイレクトするため実際には使用されない
   */
  const [success, setSuccess] = useState(false)

  /**
   * ローディング状態
   * フォーム送信中はtrueになり、送信ボタンが無効化される
   */
  const [loading, setLoading] = useState(false)

  /**
   * フォーム送信ハンドラ
   *
   * ## 処理フロー
   * 1. デフォルトの送信動作を防止
   * 2. ローディング開始、エラー/成功状態をリセット
   * 3. FormDataを作成してServer Actionを呼び出し
   * 4. エラー時: エラーメッセージを表示
   * 5. 成功時: ユーザープロフィールページへリダイレクト
   *
   * @param e - フォーム送信イベント
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // デフォルトのフォーム送信を防止
    e.preventDefault()

    // 状態を初期化
    setLoading(true)
    setError(null)
    setSuccess(false)

    // フォームデータを取得してServer Actionを呼び出し
    const formData = new FormData(e.currentTarget)
    const result = await updateProfile(formData)

    if (!result.success) {
      // エラー時: エラーメッセージを表示
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else {
      // 成功時: ユーザープロフィールページへリダイレクト
      router.push(`/users/${user.id}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー画像アップローダー */}
      <div>
        <Label>ヘッダー画像</Label>
        <HeaderUploader currentUrl={user.header_url} />
      </div>

      {/* アバター画像アップローダー */}
      <div>
        <Label>プロフィール画像</Label>
        <AvatarUploader currentUrl={user.avatar_url} nickname={user.nickname} />
      </div>

      {/* テキストフォーム */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* ニックネーム入力フィールド */}
        <div className="space-y-2">
          <Label htmlFor="nickname">ニックネーム *</Label>
          <Input
            id="nickname"
            name="nickname"
            defaultValue={user.nickname}
            required
            maxLength={MAX_NICKNAME_LENGTH}
            placeholder="ニックネーム"
          />
          <p className="text-xs text-muted-foreground">最大50文字</p>
        </div>

        {/* 居住地域選択フィールド */}
        <div className="space-y-2">
          <Label htmlFor="location">居住地域</Label>
          <select
            id="location"
            name="location"
            defaultValue={user.location || ''}
            className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">選択してください</option>
            {/* 地域グループごとにoptgroupで分類して表示 */}
            {LOCATION_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={`${group.label}-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* 自己紹介入力フィールド */}
        <div className="space-y-2">
          <Label htmlFor="bio">自己紹介</Label>
          <Textarea
            id="bio"
            name="bio"
            defaultValue={user.bio || ''}
            maxLength={MAX_BIO_LENGTH}
            rows={4}
            placeholder="自己紹介を入力..."
          />
          <p className="text-xs text-muted-foreground">最大200文字</p>
        </div>

        {/* 生年月日入力フィールド */}
        <div className="space-y-2">
          <Label htmlFor="birthDate">生年月日（任意）</Label>
          <Input
            type="date"
            id="birthDate"
            name="birthDate"
            defaultValue={user.birth_date || ''}
            max={new Date().toISOString().split('T')[0]}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">プロフィールに表示されます</p>
        </div>

        {/* 盆栽開始時期選択フィールド */}
        <div className="space-y-2">
          <Label>盆栽を始めた時期（任意）</Label>
          <div className="flex gap-2">
            {/* 年選択 */}
            <select
              name="bonsaiStartYear"
              defaultValue={user.bonsai_start_year?.toString() || ''}
              className="flex-1 h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">年を選択</option>
              {/* 現在の年から1950年までの選択肢を生成 */}
              {Array.from({ length: new Date().getFullYear() - BONSAI_START_MIN_YEAR + 1 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                )
              })}
            </select>
            {/* 月選択 */}
            <select
              name="bonsaiStartMonth"
              defaultValue={user.bonsai_start_month?.toString() || ''}
              className="flex-1 h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">月を選択</option>
              {/* 1月から12月までの選択肢を生成 */}
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}月
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">盆栽歴としてプロフィールに表示されます</p>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* 成功メッセージ（現在は使用されない、リダイレクトするため） */}
        {success && (
          <p className="text-sm text-bonsai-green">プロフィールを更新しました</p>
        )}

        {/* 送信ボタン */}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '保存中...' : '保存する'}
        </Button>
      </form>
    </div>
  )
}
