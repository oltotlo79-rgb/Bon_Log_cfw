/**
 * @module components/subscription/SubscriptionStatus
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createCustomerPortalSession } from '@/lib/actions/subscription'
import { MIN_VALID_YEAR } from '@/lib/constants/limits'
import { Crown, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

type SubscriptionStatusProps = {
  isPremium: boolean
  premiumExpiresAt: Date | null
  subscription: {
    status: string
    currentPeriodEnd: Date
    cancelAtPeriodEnd: boolean
  } | null
}

function formatDate(date: Date) {
  const d = new Date(date)
  // 無効な日付やエポック日付（1970年）のガード
  if (isNaN(d.getTime()) || d.getFullYear() < MIN_VALID_YEAR) {
    return '取得中...'
  }
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function SubscriptionStatus({
  isPremium,
  premiumExpiresAt,
  subscription,
}: SubscriptionStatusProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleManageSubscription() {
    setLoading(true)
    setError(null)

    const result = await createCustomerPortalSession()

    if ('error' in result) {
      setError(result.error ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else if (result.url) {
      window.location.href = result.url
    }
  }

  if (!isPremium) {
    return null
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">現在のプラン</CardTitle>
          </div>
          <Badge variant="default" className="bg-bonsai-green">
            プレミアム会員
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {subscription ? (
          <>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ステータス</span>
                <span className="font-medium">
                  {subscription.status === 'active' ? '有効' : subscription.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">次回更新日</span>
                <span className="font-medium">
                  {formatDate(subscription.currentPeriodEnd)}
                </span>
              </div>
              {subscription.cancelAtPeriodEnd && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-muted/50 border border-border text-muted-foreground rounded-md text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>期間終了時に解約されます</span>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={handleManageSubscription}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  読み込み中...
                </>
              ) : (
                <>
                  プラン管理
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">有効期限</span>
              <span className="font-medium">
                {premiumExpiresAt ? formatDate(premiumExpiresAt) : '無期限'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              管理者により付与されたプレミアム会員です
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
