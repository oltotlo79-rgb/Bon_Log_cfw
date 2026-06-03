/**
 * @module components/user/MutedUserList
 */

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { unmuteUser } from '@/lib/actions/mute'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { MSG_ERROR_TITLE, MSG_MUTE_REMOVED_DESCRIPTION, MSG_MUTE_REMOVED_TITLE } from '@/lib/constants/messages'
import { buildUserPath } from '@/lib/constants/path-builders'
import { useState } from 'react'

type User = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
}

type MutedUserListProps = {
  users: User[]
}

export function MutedUserList({ users }: MutedUserListProps) {
  return (
    <div className="space-y-4">
      {users.map((user) => (
        <MutedUserItem key={user.id} user={user} />
      ))}
    </div>
  )
}

function MutedUserItem({ user }: { user: User }) {

  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleUnmute() {
    setLoading(true)

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
      <div className="flex items-center gap-3">
        <Link href={buildUserPath(user.id)}>
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.nickname}
              width={48}
              height={48}
              sizes="48px"
              className="rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500 text-lg">
                {user.nickname[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </Link>

        <div>
          <Link href={buildUserPath(user.id)}>
            <p className="font-semibold hover:underline">{user.nickname}</p>
          </Link>
          {user.bio && (
            <p className="text-sm text-gray-600 line-clamp-1">{user.bio}</p>
          )}
        </div>
      </div>

      <Button
        onClick={handleUnmute}
        disabled={loading}
        variant="outline"
        size="sm"
      >
        {loading ? '...' : 'ミュート解除'}
      </Button>
    </div>
  )
}
