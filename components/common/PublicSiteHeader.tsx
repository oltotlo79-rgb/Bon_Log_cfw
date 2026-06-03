'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import {
  ROUTE_FEED,
  ROUTE_LOGIN,
  ROUTE_REGISTER,
} from '@/lib/constants/routes'

export function PublicSiteHeader() {
  const { status } = useSession()
  const isLoggedIn = status === 'authenticated'

  return (
    <header className="border-b bg-card">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        {/*
          ロゴリンクは意図的に `next/link` ではなく素の `<a>` を使う。
          Why: proxy.ts は `/` をログイン状態に応じて `/feed` にリダイレクトする。
          Next.js の Router Cache がログイン中の `/` → `/feed` redirect を保持していると、
          ログアウト後でも cached payload が再生され `/feed` に飛ばされる事象が発生する。
          public ページは logged-in/out 両対応のためこの問題が起きやすく、full-page nav で回避する。
        */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="BON-LOG"
            width={60}
            height={60}
            className="h-8 w-auto dark:invert"
            unoptimized
          />
        </a>
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <Link
              href={ROUTE_FEED}
              className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              タイムラインへ
            </Link>
          ) : (
            <>
              <Link
                href={ROUTE_LOGIN}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                ログイン
              </Link>
              <Link
                href={ROUTE_REGISTER}
                className="text-sm px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                新規登録
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
