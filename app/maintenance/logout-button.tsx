'use client'

import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'

import { GUEST_EMAIL } from '@/lib/constants/guest'
import { ROUTE_HOME, ROUTE_LOGIN } from '@/lib/constants/routes'

export function MaintenanceLogoutButton() {
  const [loading, setLoading] = useState(false)
  const session = useSession()?.data
  const isGuest = session?.user?.email === GUEST_EMAIL
  const label = isGuest ? 'トップページへ' : 'ログアウト'
  const loadingLabel = isGuest ? 'トップページへ…' : 'ログアウト中...'
  const callbackUrl = isGuest ? ROUTE_HOME : ROUTE_LOGIN

  const handleLogout = async () => {
    setLoading(true)
    await signOut({ callbackUrl })
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" x2="9" y1="12" y2="12" />
      </svg>
      {loading ? loadingLabel : label}
    </button>
  )
}
