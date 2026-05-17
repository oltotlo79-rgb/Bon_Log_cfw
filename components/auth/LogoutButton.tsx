/**
 * ログアウトボタンコンポーネント
 *
 * @module components/auth/LogoutButton
 */

'use client'

/**
 * NextAuth.jsのサインアウト関数
 *
 * クライアントサイドからログアウト処理を実行するための関数。
 * サーバーサイドのセッションを破棄し、Cookieをクリアする。
 *
 * ## オプション
 * - callbackUrl: ログアウト完了後のリダイレクト先URL
 * - redirect: true（デフォルト）でリダイレクト、falseでリダイレクトなし
 *
 * ## 内部処理
 * 1. /api/auth/signoutエンドポイントにPOSTリクエスト
 * 2. サーバー側でセッションを破棄
 * 3. Cookieをクリア
 * 4. callbackUrlで指定されたページへリダイレクト
 *
 * @see {@link https://next-auth.js.org/getting-started/client#signout}
 */
import { signOut, useSession } from 'next-auth/react'

import { GUEST_EMAIL } from '@/lib/constants/guest'

/**
 * shadcn/ui Buttonコンポーネント
 *
 * スタイル済みのボタンUIコンポーネント。
 * variant="ghost"でテキストリンク風の控えめなスタイルを適用。
 * size="sm"で小さめのボタンサイズを適用。
 *
 * ## このコンポーネントで使用するプロパティ
 * - variant: "ghost" - 背景色なしの控えめなスタイル
 * - size: "sm" - 小さめのサイズ（パディング少なめ）
 * - onClick: クリック時のイベントハンドラ
 *
 * @see {@link https://ui.shadcn.com/docs/components/button}
 */
import { Button } from '@/components/ui/button'
import { ROUTE_HOME, ROUTE_LOGIN } from '@/lib/constants/routes'

/**
 * ログアウトボタンコンポーネント
 *
 * ユーザーがログアウトするためのボタンUIを提供するReactコンポーネント。
 * クリックするとNextAuth.jsのsignOut関数が呼び出され、
 * セッションが破棄された後、ログインページへリダイレクトされる。
 *
 * ## 主な機能
 * - ワンクリックでログアウト処理を実行
 * - ログアウト完了後、自動的にログインページへリダイレクト
 *
 * ## 使用場所
 * - ヘッダーナビゲーション
 * - ユーザードロップダウンメニュー
 * - 設定ページ
 * - サイドバー
 *
 * ## ボタンスタイル
 * - variant="ghost": 背景色なしの控えめなスタイル
 *   - 通常時: テキストのみ表示
 *   - ホバー時: 薄い背景色が表示される
 * - size="sm": 小さめのサイズ
 *   - 他のナビゲーション要素と調和するサイズ
 *
 * ## 状態管理
 * このコンポーネントは内部状態を持たないシンプルなコンポーネント。
 * signOut関数が非同期処理を行うため、ローディング状態の表示が
 * 必要な場合は拡張が必要。
 *
 * @returns ログアウトボタンのJSX要素
 *
 * @example
 * ```tsx
 * // 基本的な使用方法
 * <LogoutButton />
 *
 * // ドロップダウンメニュー内での使用
 * <DropdownMenu>
 *   <DropdownMenuTrigger>
 *     <Avatar />
 *   </DropdownMenuTrigger>
 *   <DropdownMenuContent>
 *     <DropdownMenuItem>
 *       <LogoutButton />
 *     </DropdownMenuItem>
 *   </DropdownMenuContent>
 * </DropdownMenu>
 *
 * // ナビゲーションバーでの使用
 * <nav className="flex items-center gap-4">
 *   <Link href="/settings">設定</Link>
 *   <LogoutButton />
 * </nav>
 * ```
 */
export function LogoutButton() {
  const session = useSession()?.data
  const isGuest = session?.user?.email === GUEST_EMAIL
  const label = isGuest ? 'トップページへ' : 'ログアウト'
  const callbackUrl = isGuest ? ROUTE_HOME : ROUTE_LOGIN

  /**
   * ログアウトハンドラ
   *
   * ボタンクリック時に実行される非同期関数。
   * NextAuth.jsのsignOut関数を呼び出して、以下の処理を実行:
   *
   * ## 処理内容
   * 1. サーバーサイドのセッションを破棄
   *    - データベースセッション使用時: セッションレコードを削除
   *    - JWT使用時: トークンを無効化
   * 2. クライアントサイドのCookieをクリア
   *    - next-auth.session-token
   *    - next-auth.csrf-token
   * 3. 指定されたcallbackUrl（/login）へリダイレクト
   *
   * ## callbackUrlについて
   * ログアウト完了後にユーザーをどのページに遷移させるかを指定。
   * ここでは'/login'を指定し、再度ログインできる画面へ誘導。
   *
   * @returns Promise<void>
   */
  async function handleLogout() {
    /**
     * signOut関数の呼び出し
     *
     * @param options - サインアウトオプション
     * @param options.callbackUrl - ログアウト後のリダイレクト先
     *                             '/login'を指定してログインページへ遷移
     */
    await signOut({ callbackUrl })
  }

  return (
    /**
     * ログアウトボタン
     *
     * ## プロパティ
     * - variant="ghost": 控えめなスタイル（背景色なし）
     *   - ナビゲーション内で他の要素と調和するデザイン
     *   - ホバー時のみ薄い背景色が表示される
     *
     * - size="sm": 小さめのサイズ
     *   - ヘッダーやサイドバーに配置しやすいコンパクトなサイズ
     *   - パディングが少なめで省スペース
     *
     * - onClick={handleLogout}: クリック時にログアウト処理を実行
     *   - 非同期関数を直接指定
     *   - ボタンクリックでhandleLogout関数が呼び出される
     */
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      {label}
    </Button>
  )
}
