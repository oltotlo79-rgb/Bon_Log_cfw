'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ILLUSTRATION_WIDTH, ILLUSTRATION_HEIGHT } from '@/lib/constants/limits'

/**
 * error.tsx 共通の表示 UI。Sentry 報告 + 再試行 + 任意の代替遷移リンクを提供する。
 * 開発時のみ `error.message` を画面表示する (本番では UI に出さず Sentry へ送る)。
 */

interface PageErrorProps {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
  description?: string
  icon?: React.ReactNode
  linkHref?: string
  linkLabel?: string
}

export function PageError({
  error,
  reset,
  title = 'エラーが発生しました',
  description = '一時的な問題が発生しています。しばらく待ってから再試行してください。',
  icon,
  linkHref,
  linkLabel,
}: PageErrorProps) {
  useEffect(() => {
    if (error?.message) {
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureException(error)
      })
    }
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
      <div className="text-center max-w-md">
        <Image
          src="/images/generated/placeholders/error-zen-garden.webp"
          alt=""
          width={ILLUSTRATION_WIDTH}
          height={ILLUSTRATION_HEIGHT}
          className="mx-auto mb-4 opacity-50 dark:hidden"
        />
        <Image
          src="/images/generated/placeholders/error-zen-garden-dark.webp"
          alt=""
          width={ILLUSTRATION_WIDTH}
          height={ILLUSTRATION_HEIGHT}
          className="mx-auto mb-4 opacity-50 hidden dark:block"
        />

        {icon && (
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            {icon}
          </div>
        )}

        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-6">{description}</p>

        {process.env.NODE_ENV === 'development' && error.message && (
          <p className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
            {error.message}
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            再試行
          </button>

          {linkHref && linkLabel && (
            <Link
              href={linkHref}
              className="px-4 py-2 border rounded-md hover:bg-muted transition-colors"
            >
              {linkLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
