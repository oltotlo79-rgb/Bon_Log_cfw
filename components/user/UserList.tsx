/**
 * ユーザーリストコンポーネント
 *
 * @module components/user/UserList
 */

/**
 * UserCardコンポーネント
 * 個々のユーザー情報（アバター、ニックネーム、自己紹介）を表示
 */
import { UserCard } from './UserCard'

/**
 * ユーザー情報の型
 *
 * @property id - ユーザーの一意識別子
 * @property nickname - ユーザーの表示名
 * @property avatar_url - アバター画像のURL（nullの場合はイニシャル表示）
 * @property bio - 自己紹介文（nullの場合は非表示）
 */
type User = {
  id: string
  nickname: string
  avatar_url: string | null
  bio: string | null
}

/**
 * UserListコンポーネントのprops型
 *
 * @property users - 表示するユーザーの配列
 * @property emptyMessage - ユーザーがいない場合に表示するメッセージ（デフォルト: 'ユーザーがいません'）
 */
type UserListProps = {
  users: User[]
  emptyMessage?: string
}

/**
 * ユーザーリストコンポーネント
 *
 * ## 機能
 * - 複数のユーザーをカード形式で一覧表示
 * - ユーザーがいない場合は空メッセージを表示
 * - 各ユーザーカードの間に区切り線を表示
 *
 * ## レイアウト
 * - 縦方向にカードを積み重ねる
 * - divide-yクラスで区切り線を自動追加
 *
 * @param users - 表示するユーザー配列
 * @param emptyMessage - 空の場合に表示するメッセージ
 *
 * @example
 * ```tsx
 * // フォロワー一覧での使用例
 * <UserList
 *   users={followers}
 *   emptyMessage="フォロワーがいません"
 * />
 *
 * // 検索結果での使用例
 * <UserList
 *   users={searchResults}
 *   emptyMessage="該当するユーザーが見つかりませんでした"
 * />
 * ```
 */
export function UserList({ users, emptyMessage = 'ユーザーがいません' }: UserListProps) {

  /**
   * ユーザーが0人の場合、空メッセージを表示
   * 中央揃えで、薄い色のテキストで表示
   */
  if (users.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  /**
   * ユーザーカードを縦に並べて表示
   * divide-yクラスにより、各カード間に区切り線が自動で追加される
   */
  return (
    <div className="divide-y">
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  )
}
