/**
 * ログアウトボタンコンポーネント
 *
 * @module components/auth/LogoutButton
 */

'use client'

import { signOut, useSession } from 'next-auth/react'

import { GUEST_EMAIL } from '@/lib/constants/guest'
import { Button } from '@/components/ui/button'
import { ROUTE_HOME, ROUTE_LOGIN } from '@/lib/constants/routes'

export function LogoutButton() {
  const session = useSession()?.data
  const isGuest = session?.user?.email === GUEST_EMAIL
  const label = isGuest ? 'トップページへ' : 'ログアウト'
  const callbackUrl = isGuest ? ROUTE_HOME : ROUTE_LOGIN

  async function handleLogout() {
    await signOut({ callbackUrl })
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout}>
      {label}
    </Button>
  )
}
