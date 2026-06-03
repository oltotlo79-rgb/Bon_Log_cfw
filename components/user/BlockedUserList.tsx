/**
 * @module components/user/BlockedUserList
 */

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { unblockUser } from '@/lib/actions/block'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { MSG_BLOCK_REMOVED_DESCRIPTION, MSG_BLOCK_REMOVED_TITLE, MSG_ERROR_TITLE } from '@/lib/constants/messages'
import { buildUserPath } from '@/lib/constants/path-builders'
import { useState, useRef, useEffect } from 'react'

type User = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
}

type BlockedUserListProps = {
  users: User[]
}

export function BlockedUserList({ users }: BlockedUserListProps) {
  return (
    <div className="space-y-4">
      {users.map((user) => (
        <BlockedUserItem key={user.id} user={user} />
      ))}
    </div>
  )
}

function BlockedUserItem({ user }: { user: User }) {

  const [loading, setLoading] = useState(false)

  // 非同期処理完了後の setState を防ぎ、テスト時の unhandled rejection を回避する
  const isMountedRef = useRef(true)
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const router = useRouter()
  const { toast } = useToast()

  async function handleUnblock() {
    setLoading(true)

    const result = await unblockUser(user.id)

    if (!isMountedRef.current) return

    if (!result.success) {
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: MSG_BLOCK_REMOVED_TITLE,
        description: MSG_BLOCK_REMOVED_DESCRIPTION(user.nickname),
      })
    }

    setLoading(false)
    router.refresh()
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
        onClick={handleUnblock}
        disabled={loading}
        variant="outline"
        size="sm"
      >
        {loading ? '...' : 'ブロック解除'}
      </Button>
    </div>
  )
}
