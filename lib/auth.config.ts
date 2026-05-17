/**
 * 認証設定（Edge Runtime 互換版）。
 *
 * proxy.ts は Edge Runtime で動くため Prisma/bcrypt 等の Node.js API は使えない。
 * 認可ロジック（どのパスがログイン必須か）だけをここに置き、実際のプロバイダーや
 * DB 操作は {@link lib/auth} 側で上書きする。
 *
 * @module lib/auth.config
 */

import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },

  /**
   * Cookie 設定。
   * 本番では `__Secure-` / `__Host-` プレフィックス + Secure 属性を付けて CSRF/改ざんを抑える。
   * SameSite=lax により CSRF を抑制しつつ OAuth コールバック等のトップレベル遷移は許容する。
   */
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-authjs.callback-url'
        : 'authjs.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Host-authjs.csrf-token'
        : 'authjs.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  callbacks: {
    /**
     * proxy.ts 側でも token を参照できるようにそのまま返す。
     * 実際の `token.isAdmin` セット処理は auth.ts 側の jwt コールバック。
     */
    jwt({ token }) {
      return token
    },

    /** token の値を session.user に写す。Edge 互換のため Prisma 等は使わない。 */
    session({ session, token }) {
      // as キャストを避けるため型ガードで絞る
      if (session.user && typeof token.id === 'string') {
        session.user.id = token.id
        session.user.isAdmin = Boolean(token.isAdmin)
      }
      return session
    },

    /**
     * Next.js middleware として動作する際のアクセス可否判定。
     *
     * 認可判定と redirect は proxy.ts 側に集約しているため、ここでは常に true を返して
     * wrapper を実行させる。`authorized` から false を返すと NextAuth の既定動作で
     * callbackUrl 付きの login redirect を行えないため、PROTECTED_PATHS / 公開ページの
     * source of truth は `lib/constants/routes.ts` と proxy.ts に一本化している。
     */
    authorized() {
      return true
    },
  },

  // プロバイダーは Node.js API を使うため auth.ts 側で上書きする
  providers: [],
} satisfies NextAuthConfig;
