/**
 * @module components/common/LoadingScreen
 */

import Image from 'next/image'

interface LoadingScreenProps {
  message?: string
  fullScreen?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizeConfig = {
  sm: { logo: 80, text: 'text-xs' },
  md: { logo: 120, text: 'text-sm' },
  lg: { logo: 160, text: 'text-base' },
}

export function LoadingScreen({
  message,
  fullScreen = true,
  size = 'md',
}: LoadingScreenProps) {
  const config = sizeConfig[size]

  const content = (
    <div className="flex flex-col items-center justify-center gap-6" aria-live="polite" role="status">
      <span className="sr-only">読み込み中...</span>
      <div className="relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-primary/10 animate-ping" />
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full bg-primary/5 animate-pulse"
            style={{
              width: config.logo + 40,
              height: config.logo + 40,
            }}
          />
        </div>

        <div className="relative z-10 animate-fade-in">
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={config.logo}
            height={config.logo}
            className="animate-gentle-bounce drop-shadow-lg dark:invert"
            priority
            unoptimized
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>

      {message && (
        <p className={`text-muted-foreground ${config.text} animate-pulse`}>
          {message}
        </p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
        {content}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-12">
      {content}
    </div>
  )
}

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative">
        <div className="w-8 h-8 border-2 border-primary/20 rounded-full" />
        <div className="absolute top-0 left-0 w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

export function PageLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <LoadingScreen fullScreen={false} size="md" />
    </div>
  )
}
