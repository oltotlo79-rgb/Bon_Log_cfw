'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Crown as CrownIcon, Settings } from 'lucide-react'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { ROUTE_FEED, ROUTE_SETTINGS } from '@/lib/constants/routes'

type HeaderProps = {
  userId?: string
  isPremium?: boolean
  isAdmin?: boolean
}

export function Header({ userId, isPremium }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/20 lg:hidden bg-card/80 backdrop-blur-xl backdrop-saturate-150">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Logo + Premium badge */}
        <Link href={ROUTE_FEED} className="flex items-center gap-2 group">
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={60}
            height={60}
            className="h-10 w-auto transition-opacity duration-200 group-hover:opacity-80 dark:invert"
            priority
            unoptimized
          />
          {isPremium && (
            <span className="text-muted-foreground" aria-label="プレミアム会員" role="img">
              <CrownIcon className="w-3.5 h-3.5" />
            </span>
          )}
        </Link>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {userId && (
            <Link
              href={ROUTE_SETTINGS}
              aria-label="設定"
              className="p-2.5 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted/50 transition-all duration-200 active:scale-95"
            >
              <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />
            </Link>
          )}
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}
