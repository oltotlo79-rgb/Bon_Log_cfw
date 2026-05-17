'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toggleAdminPremium } from '@/lib/actions/admin/premium'
import { Crown } from 'lucide-react'

type Props = {
  isPremium: boolean
}

export function AdminPremiumToggle({ isPremium }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [currentState, setCurrentState] = useState(isPremium)

  async function handleToggle() {
    setLoading(true)
    const result = await toggleAdminPremium()
    if (!result.success) {
      setLoading(false)
      return
    }
    if (result.data) {
      setCurrentState(result.data.isPremium)
    }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3 bg-card rounded-lg border p-4">
      <Crown className={`w-5 h-5 ${currentState ? 'text-yellow-500' : 'text-muted-foreground'}`} />
      <div className="flex-1">
        <p className="text-sm font-medium">管理者プレミアム確認モード</p>
        <p className="text-xs text-muted-foreground">
          {currentState
            ? '有効 — 有料ユーザー向け機能が表示されます'
            : '無効 — 通常ユーザーと同じ表示です'}
        </p>
      </div>
      <Button
        variant={currentState ? 'destructive' : 'default'}
        size="sm"
        onClick={handleToggle}
        disabled={loading}
      >
        {loading ? '切替中...' : currentState ? 'OFFにする' : 'ONにする'}
      </Button>
    </div>
  )
}
