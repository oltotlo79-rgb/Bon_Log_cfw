/**
 * プロフィール編集フォームコンポーネント
 *
 * @module components/user/ProfileEditForm
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateProfile } from '@/lib/actions/user'
import { AvatarUploader } from './AvatarUploader'
import { HeaderUploader } from './HeaderUploader'
import { LOCATION_GROUPS } from '@/lib/constants/locations'
import { MAX_NICKNAME_LENGTH, MAX_BIO_LENGTH, BONSAI_START_MIN_YEAR } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'
import { buildUserPath } from '@/lib/constants/path-builders'

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

export function ProfileEditForm({ user }: ProfileEditFormProps) {
  const router = useRouter()

  const [error, setError] = useState<string | null>(null)

  const [success, setSuccess] = useState(false)

  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setLoading(true)
    setError(null)
    setSuccess(false)

    const formData = new FormData(e.currentTarget)
    const result = await updateProfile(formData)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else {
      router.push(buildUserPath(user.id))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Label>ヘッダー画像</Label>
        <HeaderUploader currentUrl={user.header_url} />
      </div>

      <div>
        <Label>プロフィール画像</Label>
        <AvatarUploader currentUrl={user.avatar_url} nickname={user.nickname} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="space-y-2">
          <Label htmlFor="location">居住地域</Label>
          <select
            id="location"
            name="location"
            defaultValue={user.location || ''}
            className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">選択してください</option>
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

        <div className="space-y-2">
          <Label>盆栽を始めた時期（任意）</Label>
          <div className="flex gap-2">
            <select
              name="bonsaiStartYear"
              defaultValue={user.bonsai_start_year?.toString() || ''}
              className="flex-1 h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">年を選択</option>
              {Array.from({ length: new Date().getFullYear() - BONSAI_START_MIN_YEAR + 1 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return (
                  <option key={year} value={year}>
                    {year}年
                  </option>
                )
              })}
            </select>
            <select
              name="bonsaiStartMonth"
              defaultValue={user.bonsai_start_month?.toString() || ''}
              className="flex-1 h-10 px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">月を選択</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}月
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">盆栽歴としてプロフィールに表示されます</p>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {success && (
          <p className="text-sm text-bonsai-green">プロフィールを更新しました</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? '保存中...' : '保存する'}
        </Button>
      </form>
    </div>
  )
}
