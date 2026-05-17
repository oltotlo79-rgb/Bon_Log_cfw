/**
 * @module app/(main)/layout
 *
 * (main) ルートグループ配下の共通レイアウト。3 カラム (デスクトップ) / 1 カラム + ボトムナビ (モバイル)。
 * `PremiumProvider` / `AdProvider` をここに置くのは、(legal)/(public)/(auth) では
 * `auth()` を呼ばずに静的最適化を維持したいため。
 */

import { auth } from '@/lib/auth'
import Image from 'next/image'
import { Suspense } from 'react'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { Toaster } from '@/components/ui/toaster'
import { Sidebar } from '@/components/layout/Sidebar'
import { RightSidebar } from '@/components/layout/RightSidebar'
import { MobileNav } from '@/components/layout/MobileNav'
import { Header } from '@/components/layout/Header'
import { isPremiumUser } from '@/lib/premium'
import { prisma } from '@/lib/db'
import { KeyboardShortcutsProvider } from '@/components/common/KeyboardShortcutsProvider'
import { PremiumProvider } from '@/components/premium/PremiumProvider'
import { AdProvider } from '@/components/ads'

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const isAuthenticated = !!session?.user
  const userId = session?.user?.id ?? ''

  let isPremium = false
  let isAdmin = false
  let isGuest = false

  if (isAuthenticated) {
    const [premiumResult, adminUser] = await Promise.all([
      isPremiumUser(userId),
      prisma.adminUser.findUnique({ where: { userId }, select: { userId: true } }),
    ])
    isPremium = premiumResult
    isAdmin = !!adminUser
    isGuest = session.user.email === GUEST_EMAIL
  }

  return (
    <PremiumProvider>
      <div className="min-h-screen bg-transparent washi-texture relative">
        <div aria-hidden="true" className="fixed inset-0 z-[-1] opacity-[0.03] pointer-events-none flex items-center justify-center">
          <Image
            src="/images/hero-sumie.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>

        <div aria-hidden="true" className="fixed inset-0 z-[-1] opacity-[0.05] pointer-events-none">
          <Image
            src="/images/features-ink.png"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>

        {isAuthenticated && <Header userId={userId} isPremium={isPremium} isAdmin={isAdmin} />}

        <div className="flex">
          {isAuthenticated && <Sidebar userId={userId} isPremium={isPremium} isAdmin={isAdmin} isGuest={isGuest} />}

          <main id="main-content" className="flex-1 min-h-screen pb-16 lg:pb-0" tabIndex={-1}>
            <div className="max-w-2xl mx-auto px-4 py-8 lg:py-12 animate-page-enter">
              {children}
            </div>
          </main>

          <Suspense fallback={
            <aside className="hidden xl:block w-72 2xl:w-80 shrink-0">
              <div className="sticky top-20 space-y-4 animate-pulse">
                <div className="h-48 bg-muted rounded-lg" />
                <div className="h-48 bg-muted rounded-lg" />
              </div>
            </aside>
          }>
            <RightSidebar />
          </Suspense>
        </div>

        {isAuthenticated && <MobileNav userId={userId} isPremium={isPremium} isAdmin={isAdmin} />}

        {isAuthenticated && <KeyboardShortcutsProvider userId={userId} />}

        <AdProvider />
        <Toaster />
      </div>
    </PremiumProvider>
  )
}
