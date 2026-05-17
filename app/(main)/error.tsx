'use client'

import { PageError } from '@/components/common/PageError'
import { ROUTE_FEED } from '@/lib/constants/routes'

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="ページを表示できません"
      description="一時的な問題が発生しています。しばらく待ってから再試行してください。"
      linkHref={ROUTE_FEED}
      linkLabel="タイムラインへ"
    />
  )
}
