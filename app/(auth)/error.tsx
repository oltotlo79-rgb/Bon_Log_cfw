'use client'

import { PageError } from '@/components/common/PageError'

export default function AuthError({
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
      title="認証ページでエラーが発生しました"
      description="一時的な問題が発生しています。しばらく待ってから再試行してください。"
      linkHref="/login"
      linkLabel="ログインページへ"
    />
  )
}
