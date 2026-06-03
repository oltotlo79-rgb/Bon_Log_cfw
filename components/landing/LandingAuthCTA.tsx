'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { signInAsGuestFormAction } from '@/lib/actions/auth'
import {
  ROUTE_FEED,
  ROUTE_SETTINGS,
  ROUTE_SETTINGS_PROFILE,
  ROUTE_LOGIN,
  ROUTE_REGISTER,
} from '@/lib/constants/routes'

type Variant = 'header' | 'hero' | 'final'

type Props = {
  variant: Variant
}

/**
 * ランディングページの認証状態依存 CTA。
 *
 * Why client island:
 *   親 (`app/page.tsx`) は静的配信を維持したいため、`auth()` server-side 呼び出しを避け、
 *   このコンポーネントだけが `useSession()` で hydration 後に CTA を flip する。
 *   未認証クローラ・初回訪問者には常に「ログイン / 新規登録」CTA が表示される。
 */
export function LandingAuthCTA({ variant }: Props) {
  const { status } = useSession()
  const isLoggedIn = status === 'authenticated'

  if (variant === 'header') {
    return (
      <div className="flex items-center flex-wrap justify-end gap-1.5 sm:gap-4 min-w-0 pointer-events-auto">
        {isLoggedIn ? (
          <>
            <Button asChild variant="outline" size="sm" className="bg-transparent border-black text-black hover:bg-black hover:text-white transition-colors btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 shrink-0">
              <Link href={ROUTE_FEED}>タイムラインへ</Link>
            </Button>
            <Button asChild size="sm" className="btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 shrink-0">
              <Link href={ROUTE_SETTINGS}>設定</Link>
            </Button>
          </>
        ) : (
          <>
            <form action={signInAsGuestFormAction} className="shrink-0">
              <Button type="submit" variant="ghost" size="sm" className="bg-transparent border border-black/30 text-black hover:bg-black/10 btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 whitespace-nowrap">
                のぞいてみる
              </Button>
            </form>
            <Button asChild variant="outline" size="sm" className="bg-transparent border-black text-black hover:bg-black hover:text-white transition-colors btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 shrink-0">
              <Link href={ROUTE_LOGIN}>ログイン</Link>
            </Button>
            <Button asChild size="sm" className="btn-washi text-xs sm:text-sm px-2.5 py-1.5 sm:px-4 sm:py-2 shrink-0">
              <Link href={ROUTE_REGISTER}>新規登録</Link>
            </Button>
          </>
        )}
      </div>
    )
  }

  if (variant === 'hero') {
    return (
      <div className="mt-16 md:mt-32 w-full flex flex-col sm:flex-row items-end gap-4 sm:gap-6 md:gap-10 md:justify-end pr-0 md:pr-20 transform -rotate-1">
        {isLoggedIn ? (
          <>
            <Button asChild size="lg" className="h-auto text-base px-6 py-3 sm:text-lg sm:px-8 sm:py-4 btn-washi group relative overflow-hidden">
              <Link href={ROUTE_FEED}>
                <span className="relative z-10">タイムラインへ</span>
                <span className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out skew-x-12" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-auto border-2 border-black bg-transparent text-black text-base px-6 py-3 sm:text-lg sm:px-8 sm:py-4 btn-washi hover:bg-black hover:text-white transition-all duration-300">
              <Link href={ROUTE_SETTINGS_PROFILE}>プロフィール編集</Link>
            </Button>
          </>
        ) : (
          <>
            <Button asChild size="lg" className="h-auto text-base px-6 py-3 sm:text-lg sm:px-8 sm:py-4 btn-washi group relative overflow-hidden">
              <Link href={ROUTE_REGISTER}>
                <span className="relative z-10">無料で始める</span>
                <span className="absolute inset-0 bg-white/20 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out skew-x-12" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-auto border-2 border-black bg-transparent text-black text-base px-6 py-3 sm:text-lg sm:px-8 sm:py-4 btn-washi hover:bg-black hover:text-white transition-all duration-300">
              <Link href={ROUTE_LOGIN}>ログイン</Link>
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {isLoggedIn ? (
        <>
          <h3 className="text-4xl md:text-6xl font-black mb-12 tracking-widest transform -rotate-1">
            墨の道へ<br />戻る
          </h3>
          <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 mb-16 tracking-widest">
            最新の投稿があなたを待っています。
          </p>
          <Button asChild size="lg" className="h-auto text-2xl px-16 py-10 btn-washi transform hover:-rotate-2">
            <Link href={ROUTE_FEED}>タイムラインへ</Link>
          </Button>
        </>
      ) : (
        <>
          <h3 className="text-4xl md:text-6xl font-black mb-12 tracking-widest transform -rotate-1">
            今すぐ<br />始める
          </h3>
          <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 mb-16 tracking-widest">
            純粋な盆栽愛を、ここに刻もう。
          </p>
          <div className="flex flex-col sm:flex-row gap-8 justify-center items-center">
            <Button asChild size="lg" className="h-auto text-2xl px-16 py-10 btn-washi transform hover:scale-105 hover:-rotate-2">
              <Link href={ROUTE_REGISTER}>無料で新規登録</Link>
            </Button>
            <span className="text-gray-500 dark:text-gray-400 italic font-serif">または</span>
            <form action={signInAsGuestFormAction} className="contents">
              <Button type="submit" variant="outline" size="lg" className="h-auto border-2 border-black dark:border-white bg-transparent text-black dark:text-white text-xl px-12 py-8 btn-washi hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all duration-300 transform hover:scale-105 hover:rotate-1">
                のぞいてみる
              </Button>
            </form>
            <Button asChild variant="outline" size="lg" className="h-auto border-2 border-black bg-transparent text-black text-xl px-12 py-8 btn-washi hover:bg-black hover:text-white transition-all duration-300 transform hover:scale-105 hover:rotate-1">
              <Link href={ROUTE_LOGIN}>ログイン</Link>
            </Button>
          </div>
        </>
      )}
    </>
  )
}
