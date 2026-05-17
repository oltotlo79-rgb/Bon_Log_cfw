'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { grantPremium, revokePremium, extendPremium } from '@/lib/actions/admin/premium'
import {
  DEFAULT_PREMIUM_GRANT_DAYS,
  MIN_PREMIUM_GRANT_DAYS,
  MAX_PREMIUM_GRANT_DAYS,
} from '@/lib/constants/limits'
import { MoreHorizontal, Crown, Ban, CalendarPlus } from 'lucide-react'

type PremiumActionsDropdownProps = {
  userId: string
  userName: string
  isPremium: boolean
  premiumExpiresAt: Date | null
}

export function PremiumActionsDropdown({
  userId,
  userName,
  isPremium,
  premiumExpiresAt,
}: PremiumActionsDropdownProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [dialogType, setDialogType] = useState<'grant' | 'revoke' | 'extend' | null>(null)
  const [days, setDays] = useState(String(DEFAULT_PREMIUM_GRANT_DAYS))

  async function handleGrant() {
    setLoading(true)
    const daysNum = parseInt(days)
    if (isNaN(daysNum) || daysNum < MIN_PREMIUM_GRANT_DAYS || daysNum > MAX_PREMIUM_GRANT_DAYS) {
      setLoading(false)
      return
    }
    await grantPremium(userId, daysNum)
    setDialogType(null)
    setLoading(false)
    router.refresh()
  }

  async function handleRevoke() {
    setLoading(true)
    await revokePremium(userId)
    setDialogType(null)
    setLoading(false)
    router.refresh()
  }

  async function handleExtend() {
    setLoading(true)
    const daysNum = parseInt(days)
    if (isNaN(daysNum) || daysNum < MIN_PREMIUM_GRANT_DAYS || daysNum > MAX_PREMIUM_GRANT_DAYS) {
      setLoading(false)
      return
    }
    await extendPremium(userId, daysNum)
    setDialogType(null)
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isPremium && (
            <DropdownMenuItem onClick={() => setDialogType('grant')}>
              <Crown className="w-4 h-4 mr-2 text-muted-foreground" />
              プレミアムを付与
            </DropdownMenuItem>
          )}

          {isPremium && (
            <>
              <DropdownMenuItem onClick={() => setDialogType('extend')}>
                <CalendarPlus className="w-4 h-4 mr-2" />
                期限を延長
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDialogType('revoke')}
                className="text-destructive"
              >
                <Ban className="w-4 h-4 mr-2" />
                プレミアムを取り消し
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogType === 'grant'} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プレミアム会員を付与</DialogTitle>
            <DialogDescription>
              {userName} さんにプレミアム会員を付与します
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="days">有効日数</Label>
              <Input
                id="days"
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                min={MIN_PREMIUM_GRANT_DAYS}
                max={MAX_PREMIUM_GRANT_DAYS}
              />
              <p className="text-xs text-muted-foreground">
                {MIN_PREMIUM_GRANT_DAYS}〜{MAX_PREMIUM_GRANT_DAYS}日の範囲で指定してください
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button onClick={handleGrant} disabled={loading}>
              {loading ? '処理中...' : '付与する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === 'extend'} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プレミアム期限を延長</DialogTitle>
            <DialogDescription>
              {userName} さんのプレミアム期限を延長します
              {premiumExpiresAt && (
                <span className="block mt-1">
                  現在の期限: {new Date(premiumExpiresAt).toLocaleDateString('ja-JP')}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="extend-days">延長日数</Label>
              <Input
                id="extend-days"
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                min={MIN_PREMIUM_GRANT_DAYS}
                max={MAX_PREMIUM_GRANT_DAYS}
              />
              <p className="text-xs text-muted-foreground">
                {MIN_PREMIUM_GRANT_DAYS}〜{MAX_PREMIUM_GRANT_DAYS}日の範囲で指定してください
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button onClick={handleExtend} disabled={loading}>
              {loading ? '処理中...' : '延長する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === 'revoke'} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>プレミアム会員を取り消し</DialogTitle>
            <DialogDescription>
              {userName} さんのプレミアム会員を取り消しますか？
              この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={loading}>
              {loading ? '処理中...' : '取り消す'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
