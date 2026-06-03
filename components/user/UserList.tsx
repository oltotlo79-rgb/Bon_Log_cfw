/**
 * @module components/user/UserList
 */

import { UserCard } from './UserCard'

type User = {
  id: string
  nickname: string
  avatar_url: string | null
  bio: string | null
}

type UserListProps = {
  users: User[]
  emptyMessage?: string
}

export function UserList({ users, emptyMessage = 'ユーザーがいません' }: UserListProps) {

  if (users.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="divide-y">
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  )
}
