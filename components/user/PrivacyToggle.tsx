/**
 * @module components/user/PrivacyToggle
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { updatePrivacy } from '@/lib/actions/user'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

type PrivacyToggleProps = {
  initialIsPublic: boolean
}

export function PrivacyToggle({ initialIsPublic }: PrivacyToggleProps) {

  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleChange(checked: boolean) {
    setLoading(true)
    setError(null)

    const result = await updatePrivacy(checked)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
    } else {
      setIsPublic(checked)
      router.refresh()
    }

    setLoading(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="privacy-toggle" className="text-base">
            アカウントを公開する
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            {isPublic
              ? '誰でもあなたの投稿を閲覧できます'
              : 'フォロワーのみがあなたの投稿を閲覧できます'}
          </p>
        </div>
        <Switch
          id="privacy-toggle"
          checked={isPublic}
          onCheckedChange={handleChange}
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
