'use client'

import { PageError } from '@/components/common/PageError'

export default function BonsaiDetailError({
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
      title="盆栽情報を表示できません"
      description="盆栽が見つからないか、アクセス権限がない可能性があります。"
      icon={
        <svg
          className="w-8 h-8 text-destructive"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3c-3 2-5 5-5 8 0 2 1 3.5 3 4.5M12 3c3 2 5 5 5 8 0 2-1 3.5-3 4.5M12 15v4M7 19h10"
          />
        </svg>
      }
      linkHref="/bonsai"
      linkLabel="盆栽一覧へ"
    />
  )
}
