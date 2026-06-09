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
  PASSWORD_MIN_LENGTH,
} from '@/lib/constants/limits'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { ERR_EMAIL_ALREADY_IN_USE } from '@/lib/constants/errors'
import { ERR_PASSWORD_MIN_LENGTH } from '@/lib/constants/errors/auth'
import { normalizedEmailSchema } from '@/lib/actions/schemas/common'
import { assertSafeOAuthLinking } from '@/lib/security/oauth-guard'
import { getGoogleOAuthConfig, getGuestPassword } from '@/lib/env'
import { consumeTwoFactorLoginTicket } from '@/lib/two-factor-login-ticket'
import {
  checkLoginThrottleForRequest,
  recordLoginFailureForRequest,
  resetLoginThrottleForRequest,
} from '@/lib/services/login-throttle'

/**
 * ログイン入力スキーマ。
 * email / password とも最低限の形式検証のみ実施（詳細な強度チェックは登録時）。
 *
 * `twoFactorTicket` は 2FA 有効ユーザーがクライアントで `verify2FAToken` 成功後に受け取る
 * 単回使用チケット。2FA 強制はサーバー側（authorize）で行うため optional として受け取り、
 * twoFactorEnabled なユーザーに対してのみ必須化する。
 */
const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: z.string().min(PASSWORD_MIN_LENGTH, ERR_PASSWORD_MIN_LENGTH),
  twoFactorTicket: z.string().optional(),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,

  adapter: PrismaAdapter(prisma),

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
  providers: assertSafeOAuthLinking([
    /**
     * Google OAuth プロバイダー。
     *
     * ⚠ SECURITY: `allowDangerousEmailAccountLinking` は NextAuth 既定の
     *   アカウント連携保護をバイパスする。攻撃者が任意の email を返す OAuth プロバイダーを
     *   制御できれば、同 email のアカウントを乗っ取れる。
     *   Google は検証済み email を保証するため本プロジェクトでは許容するが、
     *   未検証 email を返す可能性のあるプロバイダーを追加する際は必ず再評価すること。
     *
     * @see VERIFIED_EMAIL_OAUTH_PROVIDERS でのランタイム白名単
     */
    GoogleProvider({
      ...getGoogleOAuthConfig(),
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      /**
       * メール + パスワード認証。
       * Zod → ゲスト判定 → DB 検索 → bcrypt 比較 の順で検証し、
       * どの段階で失敗しても `null` を返してタイミングサイドチャネルを最小化する。
       */
      async authorize(credentials) {
        const result = loginSchema.safeParse(credentials)
        if (!result.success) return null

        const { email, password, twoFactorTicket } = result.data

        // ゲストログイン（共有アカウント）。
        // `GUEST_PASSWORD` 未設定時は無効（開発中の誤配信を防ぐ）。
        if (email === GUEST_EMAIL) {
          const guestPassword = getGuestPassword()
          if (!guestPassword) return null
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
          if (
            !guestUser ||
            !guestUser.password ||
            !guestUser.emailVerified ||
            guestUser.isSuspended
          )
            return null
          const match = await bcrypt.compare(password, guestUser.password)
          if (!match) return null
          return {
            id: guestUser.id,
            email: guestUser.email,
            name: guestUser.nickname,
            image: guestUser.avatarUrl,
          }
        }

        // ブルートフォース対策: ロック中なら即拒否する。
        // signIn('credentials') を直叩きする経路もここを通るため、ロックアウトの最終強制点になる。
        const throttle = await checkLoginThrottleForRequest(email)
        if (!throttle.allowed) return null

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
            twoFactorEnabled: true,
          },
        })

        // 認証失敗は 2FA 有無に依らずサーバー側で必ず記録する（ロックアウトの一元化）。
        // password == null は OAuth 経由のユーザー（メール/パスワード未設定）。
        if (!user || !user.password) {
          await recordLoginFailureForRequest(email)
          return null
        }
        if (!user.emailVerified) {
          await recordLoginFailureForRequest(email)
          return null
        }
        if (user.isSuspended) {
          await recordLoginFailureForRequest(email)
          return null
        }

        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) {
          await recordLoginFailureForRequest(email)
          return null
        }

        // 2FA 有効ユーザーはセッション発行前にサーバー側で第二要素を強制する。
        // クライアントの LoginForm だけに依存すると、signIn('credentials') を直接呼ぶことで
        // TOTP 提示なしにセッションを取得できてしまう（バイパス）。verify2FAToken 成功時に
        // 発行された単回使用チケットの消費を必須化し、fail-closed で塞ぐ。
        // 第二要素の失敗はログイン失敗カウンタではなく verify2FAToken 側のレート制限で扱う。
        if (user.twoFactorEnabled) {
          const ticketValid = await consumeTwoFactorLoginTicket(email, twoFactorTicket ?? '')
          if (!ticketValid) return null
        }

        // 認証成功: 失敗カウンタをリセットする（成功時リセットを公開 RPC ではなく内部処理へ集約）。
        await resetLoginThrottleForRequest(email)

        return {
          id: user.id,
          email: user.email,
          name: user.nickname,
          image: user.avatarUrl,
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
     * サインイン可否の最終判定。
     *
     * Why: Google は `allowDangerousEmailAccountLinking: true` で連携しているため、
     * 未検証 email を許すと同 email の既存アカウントを乗っ取られ得る。Google が
     * `email_verified` を返す以上、明示的に true を要求して fail-closed にする
     * （`assertSafeOAuthLinking` の provider whitelist と多重防御）。
     */
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        const verified =
          !!profile &&
          typeof profile === 'object' &&
          'email_verified' in profile &&
          profile.email_verified === true
        if (!verified) return false
      }
      return true
    },

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
})

/**
 * 新規ユーザーを DB に直接登録する（**信頼済み呼び出し元専用**）。
 *
 * ⚠ この関数は blacklist チェック・fingerprint 検証・レート制限・確認メール送信を行わない。
 * 通常の登録 UI 経路では `lib/actions/auth.ts` の `registerUser` を使うこと。
 * 主にテストおよび内部スクリプトからの呼び出しを想定している。
 *
 * - メールアドレスの重複は例外をスロー（呼び出し側でマッピング）
 * - email は canonical form（lowercase + trim）に正規化して保存
 * - パスワードは {@link BCRYPT_SALT_ROUNDS}（= 12）で bcrypt ハッシュ化
 *
 * @throws Error メールアドレス重複時
 */
export async function registerUser(data: {
  email: string
  password: string
  nickname: string
}) {
  const normalizedEmail = data.email.toLowerCase().trim()
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })
  if (existingUser) throw new Error(ERR_EMAIL_ALREADY_IN_USE)

  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS)

  return await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      nickname: data.nickname,
    },
  })
}
