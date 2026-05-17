/**
 * ブロック中ユーザー一覧コンポーネント
 *
 * @module components/user/BlockedUserList
 */

'use client'

/**
 * Next.js Imageコンポーネント
 * アバター画像の最適化表示
 */
import Image from 'next/image'

/**
 * Next.js Linkコンポーネント
 * ユーザープロフィールページへのリンク
 */
import Link from 'next/link'

/**
 * shadcn/ui Buttonコンポーネント
 * ブロック解除ボタンのUI
 */
import { Button } from '@/components/ui/button'

/**
 * ブロック解除用Server Action
 * データベースからブロック関係を削除
 */
import { unblockUser } from '@/lib/actions/block'

/**
 * Next.js useRouter Hook
 * ブロック解除後にページをリフレッシュして一覧を更新するために使用
 */
import { useRouter } from 'next/navigation'

/**
 * トースト通知用カスタムHook
 * ブロック解除の結果（成功/エラー）をユーザーに通知
 */
import { useToast } from '@/hooks/use-toast'
import { MSG_BLOCK_REMOVED_DESCRIPTION, MSG_BLOCK_REMOVED_TITLE, MSG_ERROR_TITLE } from '@/lib/constants/messages'

/**
 * React useState / useRef / useEffect
 * ローディング状態の管理、アンマウント後の setState 防止に使用
 */
import { useState, useRef, useEffect } from 'react'

/**
 * ユーザー情報の型
 *
 * @property id - ユーザーの一意識別子
 * @property nickname - ユーザーの表示名
 * @property avatarUrl - アバター画像のURL（nullの場合はイニシャル表示）
 * @property bio - 自己紹介文（nullの場合は非表示）
 */
type User = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
}

/**
 * BlockedUserListコンポーネントのprops型
 *
 * @property users - ブロック中のユーザー配列
 */
type BlockedUserListProps = {
  users: User[]
}

/**
 * ブロック中ユーザー一覧コンポーネント
 *
 * ## 機能
 * - ブロックしているユーザーを縦に並べて表示
 * - 各ユーザーにブロック解除ボタンを配置
 *
 * @param users - ブロック中のユーザー配列
 *
 * @example
 * ```tsx
 * // 設定ページでの使用例
 * <BlockedUserList users={blockedUsers} />
 * ```
 */
export function BlockedUserList({ users }: BlockedUserListProps) {
  return (
    <div className="space-y-4">
      {/* 各ユーザーをBlockedUserItemコンポーネントで表示 */}
      {users.map((user) => (
        <BlockedUserItem key={user.id} user={user} />
      ))}
    </div>
  )
}

/**
 * ブロック中ユーザーアイテムコンポーネント（内部使用）
 *
 * ## 機能
 * - 個々のブロック中ユーザー情報を表示
 * - アバター画像（またはイニシャル）を表示
 * - ニックネームと自己紹介を表示
 * - ブロック解除ボタンを提供
 *
 * ## レイアウト
 * - 左: アバター + ユーザー情報（縦並び）
 * - 右: ブロック解除ボタン
 *
 * @param user - 表示するユーザー情報
 */
function BlockedUserItem({ user }: { user: User }) {

  /**
   * ローディング状態
   * Server Action呼び出し中はtrueになり、ボタンが無効化される
   */
  const [loading, setLoading] = useState(false)

  /**
   * アンマウント検知用 ref
   * 非同期処理完了後に setState しないようにし、テスト時の unhandled rejection を防ぐ
   */
  const isMountedRef = useRef(true)
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /**
   * Next.jsルーター
   * ブロック解除後にページをリフレッシュするために使用
   */
  const router = useRouter()

  /**
   * トースト通知
   * 操作結果をユーザーに通知
   */
  const { toast } = useToast()

  /**
   * ブロック解除ハンドラ
   *
   * ## 処理フロー
   * 1. ローディング状態を開始
   * 2. Server Actionでブロック解除を実行
   * 3. エラー時: エラートーストを表示
   * 4. 成功時: 成功トーストを表示
   * 5. ローディング状態を終了
   * 6. ページをリフレッシュして一覧を更新
   */
  async function handleUnblock() {
    setLoading(true)

    // Server Actionでブロック解除を実行
    const result = await unblockUser(user.id)

    if (!isMountedRef.current) return

    if (!result.success) {
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      // 成功時: 成功トーストを表示
      toast({
        title: MSG_BLOCK_REMOVED_TITLE,
        description: MSG_BLOCK_REMOVED_DESCRIPTION(user.nickname),
      })
    }

    setLoading(false)
    // ページをリフレッシュして一覧を更新
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      {/* 左側: アバターとユーザー情報 */}
      <div className="flex items-center gap-3">
        {/* アバター画像（プロフィールへのリンク付き） */}
        <Link href={`/users/${user.id}`}>
          {user.avatarUrl ? (
            // アバター画像がある場合: Next.js Imageで最適化表示
            <Image
              src={user.avatarUrl}
              alt={user.nickname}
              width={48}
              height={48}
              sizes="48px"
              className="rounded-full"
            />
          ) : (
            // アバター画像がない場合: ニックネームの頭文字を表示
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500 text-lg">
                {user.nickname[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </Link>

        {/* ユーザー情報（ニックネームと自己紹介） */}
        <div>
          {/* ニックネーム（プロフィールへのリンク付き） */}
          <Link href={`/users/${user.id}`}>
            <p className="font-semibold hover:underline">{user.nickname}</p>
          </Link>
          {/* 自己紹介（1行で省略表示） */}
          {user.bio && (
            <p className="text-sm text-gray-600 line-clamp-1">{user.bio}</p>
          )}
        </div>
      </div>

      {/* 右側: ブロック解除ボタン */}
      <Button
        onClick={handleUnblock}
        disabled={loading}
        variant="outline"
        size="sm"
      >
        {/* ローディング中は「...」、それ以外は「ブロック解除」を表示 */}
        {loading ? '...' : 'ブロック解除'}
      </Button>
    </div>
  )
}
