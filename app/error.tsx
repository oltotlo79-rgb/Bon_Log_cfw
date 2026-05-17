'use client'

import { PageError } from '@/components/common/PageError'

export default function RootError({
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
      title="エラーが発生しました"
      description="一時的な問題が発生しています。しばらく待ってから再試行してください。"
      linkHref="/"
      linkLabel="トップページへ"
    />
  )
}
