/**
 * NextAuth.js（Auth.js v5）の本体設定。
 *
 * Edge Runtime 非対応の Node-only API（Prisma / bcryptjs / DB 参照）を含むため、
 * proxy.ts からは {@link authConfig} のみを使い、この本体は API Routes・Server Action
 * 側で参照する。Edge 互換部は `lib/auth.config.ts` に分離されている。
 *
 * @module lib/auth
 */

// Next.js ビルド時のみ server-only ガードを適用（CLI スクリプトでの直接 import を許容するため）
if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- 条件付きインポートにはrequireが必要
  require('server-only')
}

import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
// bcryptjs: C++ binding 不要で Edge 環境・CI で安定動作するため bcrypt ではなくこちらを採用。
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { z } from 'zod'
import { authConfig } from '@/lib/auth.config'
import {
  BCRYPT_SALT_ROUNDS,
  SESSION_MAX_AGE_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
} from '@/lib/constants/limits'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { assertSafeOAuthLinking } from '@/lib/security/oauth-guard'
import { getGoogleOAuthConfig, getGuestPassword } from '@/lib/env'

/**
 * ログイン入力スキーマ。
 * email / password とも最低限の形式検証のみ実施（詳細な強度チェックは登録時）。
 */
const loginSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上である必要があります'),
})

/**
 * NextAuth 設定を関数として渡すことで **per-request 評価** にする。
 *
 * Why: Cloudflare Workers では env vars は per-request の `env` 引数として注入され、
 * OpenNext がそれを `process.env` に伝播するのは fetch handler 入口のタイミング。
 * `NextAuth({ ... })` の object literal 形式だと module init 時に
 * `getGoogleOAuthConfig()` / NEXTAUTH_SECRET 等を読み込むが、その時点では
 * process.env が空のため Google clientId / clientSecret が "" になり、NextAuth が
 * 「Configuration error」を返す。
 *
 * 関数形式 `NextAuth(() => ({ ... }))` は request ごとに評価されるため、
 * 関数の中で process.env を読めば確実に populated な値が取れる。
 *
 * 参考: https://authjs.dev/getting-started/installation#configure
 */
/**
 * GoogleProvider を有効化する条件:
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が **両方 set かつ非空** のとき。
 *
 * Why: NextAuth v5 は providers に空 clientId / clientSecret の OAuth provider が
 * 含まれていると `Configuration` error を返す。Workers 環境では env が未設定の
 * 場合もあり得るため、credentials がない時は GoogleProvider を含めない方針にする。
 */
function buildGoogleProvider() {
  const cfg = getGoogleOAuthConfig()
  if (!cfg.clientId || !cfg.clientSecret) return null
  return GoogleProvider({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    /**
     * ⚠ SECURITY: `allowDangerousEmailAccountLinking` は NextAuth 既定の
     *   アカウント連携保護をバイパスする。攻撃者が任意の email を返す OAuth プロバイダーを
     *   制御できれば、同 email のアカウントを乗っ取れる。
     *   Google は検証済み email を保証するため本プロジェクトでは許容するが、
     *   未検証 email を返す可能性のあるプロバイダーを追加する際は必ず再評価すること。
     *
     * @see VERIFIED_EMAIL_OAUTH_PROVIDERS でのランタイム白名単
     */
    allowDangerousEmailAccountLinking: true,
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: profile.picture,
      }
    },
  })
}

export const { handlers, signIn, signOut, auth } = NextAuth(() => ({
  ...authConfig,

  adapter: PrismaAdapter(prisma),

  /**
   * NextAuth v5 は X-Forwarded-Host / Host ヘッダの検証を厳格化しており、
   * Vercel 以外のホスティングではデフォルトで信頼しない。Cloudflare Workers は
   * `*.workers.dev` や custom domain で動くため明示的に許可しないと
   * 「Untrusted Host」由来の Configuration error を返す。
   */
  trustHost: true,

  /**
   * NEXTAUTH_SECRET を request 時に明示的に読む。NextAuth は env から自動取得もするが、
   * Workers の env 注入タイミングで取りこぼされる可能性があるため明示する。
   */
  secret: process.env.NEXTAUTH_SECRET,

  // JWT 戦略: ステートレスで Serverless 相性が良いため採用。
  // セッションの即時失効が必要な場合は DB 戦略に切替検討（現状は要件上不要）。
  //
  // maxAge: NextAuth デフォルトの 30 日は JWT 漏洩時の被害窓口が長すぎるため 7 日に短縮。
  // updateAge: アクティブユーザーには 1 日ごとに JWT を再発行することで UX を維持する。
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },

  // `allowDangerousEmailAccountLinking` を指定するプロバイダーは
  // `assertSafeOAuthLinking()` により起動時にホワイトリスト検証される。
  // GoogleProvider は credentials が両方 set のときのみ含める (空 clientId は Configuration error の原因)。
  providers: assertSafeOAuthLinking([
    ...(buildGoogleProvider() ? [buildGoogleProvider()!] : []),
    CredentialsProvider({
      name: 'credentials',
      /**
       * メール + パスワード認証。
       * Zod → ゲスト判定 → DB 検索 → bcrypt 比較 の順で検証し、
       * どの段階で失敗しても `null` を返してタイミングサイドチャネルを最小化する。
       *
       * 診断ログは「失敗の段階」のみ出力する (email / password / hash は **絶対に出さない**)。
       * staging 検証完了後 Phase 5 で削除する。
       */
      async authorize(credentials) {
        const result = loginSchema.safeParse(credentials)
        if (!result.success) {
          console.warn('[auth-diag] login zod validation failed', {
            issues: result.error.issues.map((i) => ({ path: i.path, code: i.code })),
          })
          return null
        }

        const { email, password } = result.data

        try {
          // ゲストログイン（共有アカウント）。
          // `GUEST_PASSWORD` 未設定時は無効（開発中の誤配信を防ぐ）。
          if (email === GUEST_EMAIL) {
            const guestPassword = getGuestPassword()
            if (!guestPassword) {
              console.warn('[auth-diag] guest login attempted but GUEST_PASSWORD not set')
              return null
            }
            const guestUser = await prisma.user.findUnique({
              where: { email: GUEST_EMAIL },
              select: {
                id: true,
                email: true,
                password: true,
                nickname: true,
                avatarUrl: true,
                isSuspended: true,
                emailVerified: true,
              },
            })
            if (!guestUser) {
              console.warn('[auth-diag] guest user not found in DB')
              return null
            }
            if (!guestUser.password) {
              console.warn('[auth-diag] guest user has no password set')
              return null
            }
            if (!guestUser.emailVerified) {
              console.warn('[auth-diag] guest user emailVerified is null')
              return null
            }
            if (guestUser.isSuspended) {
              console.warn('[auth-diag] guest user is suspended')
              return null
            }
            const match = await bcrypt.compare(password, guestUser.password)
            if (!match) {
              console.warn('[auth-diag] guest password mismatch')
              return null
            }
            return {
              id: guestUser.id,
              email: guestUser.email,
              name: guestUser.nickname,
              image: guestUser.avatarUrl,
            }
          }

          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              password: true,
              nickname: true,
              avatarUrl: true,
              isSuspended: true,
              emailVerified: true,
            },
          })

          if (!user) {
            console.warn('[auth-diag] user not found for given email')
            return null
          }
          // password == null は OAuth 経由のユーザー（メール/パスワード未設定）。
          if (!user.password) {
            console.warn('[auth-diag] user has no password (OAuth-only?)')
            return null
          }
          if (!user.emailVerified) {
            console.warn('[auth-diag] user emailVerified is null (verify-email pending?)')
            return null
          }
          if (user.isSuspended) {
            console.warn('[auth-diag] user is suspended')
            return null
          }

          const passwordMatch = await bcrypt.compare(password, user.password)
          if (!passwordMatch) {
            console.warn('[auth-diag] password mismatch')
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.nickname,
            image: user.avatarUrl,
          }
        } catch (err) {
          console.error('[auth-diag] authorize threw unexpectedly', {
            name: err instanceof Error ? err.name : 'unknown',
            message: err instanceof Error ? err.message : String(err),
          })
          return null
        }
      },
    }),
  ]),

  /**
   * OAuth 初回ログイン時は PrismaAdapter がユーザーを作成するが、
   * nickname は未設定になるため Google プロフィール名で補完する。
   * OAuth 経由はメール確認済み扱いとして emailVerified も自動設定。
   */
  events: {
    async createUser({ user }) {
      if (user.id && user.name) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            nickname: user.name,
            emailVerified: new Date(),
          },
        })
      }
    },
  },

  callbacks: {
    /**
     * JWT 発行/更新時のコールバック。
     * 初回サインイン時のみ `user` が渡るので、そのタイミングで id / email / isAdmin を
     * token に焼き付ける。以降のリクエストでは token だけで認可を完結できる。
     */
    async jwt({ token, user }) {
      if (user) {
        // `User.id` は string | undefined。as キャストを避けるため型ガード。
        if (typeof user.id !== 'string') return token
        token.id = user.id
        if (typeof user.email === 'string') token.email = user.email
        const adminUser = await prisma.adminUser.findUnique({
          where: { userId: user.id },
          select: { userId: true },
        })
        token.isAdmin = Boolean(adminUser)
      }
      return token
    },

    /**
     * クライアントに渡す session を JWT から組み立てる。
     * `proxy.ts` も `req.auth?.user?.isAdmin` を参照するため、Edge でも利用可能な形にする。
     */
    async session({ session, token }) {
      if (session.user && typeof token.id === 'string') {
        session.user.id = token.id
        if (typeof token.email === 'string') session.user.email = token.email
        session.user.isAdmin = Boolean(token.isAdmin)
      }
      return session
    },
  },
}))

/**
 * 新規ユーザーを DB に登録する。
 *
 * - メールアドレスの重複は例外をスロー（呼び出し側で Server Action の
 *   `actionError(ERR_EMAIL_ALREADY_REGISTERED)` にマッピングされている）
 * - パスワードは {@link BCRYPT_SALT_ROUNDS}（= 12）で bcrypt ハッシュ化
 *
 * @throws Error メールアドレス重複時
 */
export async function registerUser(data: {
  email: string
  password: string
  nickname: string
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  })
  if (existingUser) throw new Error('このメールアドレスは既に使用されています')

  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS)

  return await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      nickname: data.nickname,
    },
  })
}
