/**
 * ユーザーカードコンポーネント
 *
 * @module components/user/UserCard
 */

/**
 * Next.js Imageコンポーネント
 * アバター画像の最適化表示
 */
import Image from 'next/image'

/**
 * Next.js Linkコンポーネント
 * ユーザープロフィールへのリンク
 */
import Link from 'next/link'
import { AVATAR_SIZE_LG } from '@/lib/constants/limits'

/**
 * UserCardコンポーネントのprops型
 *
 * @property user - ユーザー情報オブジェクト
 * @property user.id - ユーザーID
 * @property user.nickname - ニックネーム
 * @property user.avatar_url - アバター画像URL（nullの場合はイニシャル表示）
 * @property user.bio - 自己紹介文（nullの場合は非表示）
 */
type UserCardProps = {
  user: {
    id: string
    nickname: string
    avatar_url: string | null
    bio: string | null
  }
}

/**
 * ユーザーカードコンポーネント
 *
 * ## 機能
 * - アバター画像またはイニシャルを表示
 * - ニックネームを太字で表示
 * - 自己紹介を2行まで表示（超過分は省略）
 * - カード全体がクリック可能なリンク
 *
 * @param user - ユーザー情報
 *
 * @example
 * ```tsx
 * <UserCard
 *   user={{
 *     id: 'user123',
 *     nickname: '盆栽太郎',
 *     avatar_url: '/avatars/user123.jpg',
 *     bio: '盆栽歴10年。松が大好きです。',
 *   }}
 * />
 * ```
 */
export function UserCard({ user }: UserCardProps) {

  return (
    <Link
      href={`/users/${user.id}`}
      className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
    >
      <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.nickname}
            width={AVATAR_SIZE_LG}
            height={AVATAR_SIZE_LG}
            sizes={`${AVATAR_SIZE_LG}px`}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg text-muted-foreground">
            {user.nickname.charAt(0)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{user.nickname}</p>
        {user.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{user.bio}</p>
        )}
      </div>
    </Link>
  )
}
