/**
 * ミュート中ユーザー一覧コンポーネント
 *
 * @module components/user/MutedUserList
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
 * ミュート解除ボタンのUI
 */
import { Button } from '@/components/ui/button'

/**
 * ミュート解除用Server Action
 * データベースからミュート関係を削除
 */
import { unmuteUser } from '@/lib/actions/mute'

/**
 * Next.js useRouter Hook
 * ミュート解除後にページをリフレッシュして一覧を更新するために使用
 */
import { useRouter } from 'next/navigation'

/**
 * トースト通知用カスタムHook
 * ミュート解除の結果（成功/エラー）をユーザーに通知
 */
import { useToast } from '@/hooks/use-toast'
import { MSG_ERROR_TITLE, MSG_MUTE_REMOVED_DESCRIPTION, MSG_MUTE_REMOVED_TITLE } from '@/lib/constants/messages'

/**
 * React useState Hook
 * ローディング状態の管理に使用
 */
import { useState } from 'react'

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
 * MutedUserListコンポーネントのprops型
 *
 * @property users - ミュート中のユーザー配列
 */
type MutedUserListProps = {
  users: User[]
}

/**
 * ミュート中ユーザー一覧コンポーネント
 *
 * ## 機能
 * - ミュートしているユーザーを縦に並べて表示
 * - 各ユーザーにミュート解除ボタンを配置
 *
 * @param users - ミュート中のユーザー配列
 *
 * @example
 * ```tsx
 * // 設定ページでの使用例
 * <MutedUserList users={mutedUsers} />
 * ```
 */
export function MutedUserList({ users }: MutedUserListProps) {
  return (
    <div className="space-y-4">
      {/* 各ユーザーをMutedUserItemコンポーネントで表示 */}
      {users.map((user) => (
        <MutedUserItem key={user.id} user={user} />
      ))}
    </div>
  )
}

/**
 * ミュート中ユーザーアイテムコンポーネント（内部使用）
 *
 * ## 機能
 * - 個々のミュート中ユーザー情報を表示
 * - アバター画像（またはイニシャル）を表示
 * - ニックネームと自己紹介を表示
 * - ミュート解除ボタンを提供
 *
 * ## レイアウト
 * - 左: アバター + ユーザー情報（縦並び）
 * - 右: ミュート解除ボタン
 *
 * @param user - 表示するユーザー情報
 */
function MutedUserItem({ user }: { user: User }) {

  /**
   * ローディング状態
   * Server Action呼び出し中はtrueになり、ボタンが無効化される
   */
  const [loading, setLoading] = useState(false)

  /**
   * Next.jsルーター
   * ミュート解除後にページをリフレッシュするために使用
   */
  const router = useRouter()

  /**
   * トースト通知
   * 操作結果をユーザーに通知
   */
  const { toast } = useToast()

  /**
   * ミュート解除ハンドラ
   *
   * ## 処理フロー
   * 1. ローディング状態を開始
   * 2. Server Actionでミュート解除を実行
   * 3. エラー時: エラートーストを表示
   * 4. 成功時: 成功トーストを表示
   * 5. ローディング状態を終了
   * 6. ページをリフレッシュして一覧を更新
   */
  async function handleUnmute() {
    setLoading(true)

    // Server Actionでミュート解除を実行
    const result = await unmuteUser(user.id)

    if (!result.success) {
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: MSG_MUTE_REMOVED_TITLE,
        description: MSG_MUTE_REMOVED_DESCRIPTION(user.nickname),
      })
    }

    // 次のティックで実行（ブラウザのみ）。テスト/SSRでは window 未定義になるためスキップ
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        setLoading(false)
        router.refresh()
      }
    }, 0)
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

      {/* 右側: ミュート解除ボタン */}
      <Button
        onClick={handleUnmute}
        disabled={loading}
        variant="outline"
        size="sm"
      >
        {/* ローディング中は「...」、それ以外は「ミュート解除」を表示 */}
        {loading ? '...' : 'ミュート解除'}
      </Button>
    </div>
  )
}
