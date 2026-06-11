/**
 * @module components/subscription/PricingCard
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createCheckoutSession } from '@/lib/actions/subscription'
import { Check, Crown, Loader2 } from 'lucide-react'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'
import { MAX_POST_CONTENT_PREMIUM, MAX_POST_IMAGES_PREMIUM, MAX_POST_VIDEOS_PREMIUM } from '@/lib/constants/limits'

type PricingCardProps = {
  isPremium: boolean
  priceId: string
  priceType: 'monthly' | 'yearly'
  planName: string
  price: number
  period: string
  description?: string
  popular?: boolean
}

// 無料会員との差別化ポイント
const features = [
  `投稿文字数 ${MAX_POST_CONTENT_PREMIUM}文字`,
  `画像添付 ${MAX_POST_IMAGES_PREMIUM}枚まで`,
  `動画添付 ${MAX_POST_VIDEOS_PREMIUM}本まで（無料会員は不可）`,
  '予約投稿機能',
  '投稿分析ダッシュボード',
  '広告非表示',
]

export function PricingCard({
  isPremium,
  priceType,
  planName,
  price,
  period,
  description,
  popular = false,
}: PricingCardProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)

    const result = await createCheckoutSession(priceType)

    if ('error' in result) {
      setError(result.error ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else if (result.url) {
      window.location.href = result.url
    }
  }

  return (
    <Card className={`relative overflow-visible ${popular ? 'border-primary shadow-lg' : ''}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
            おすすめ
          </span>
        </div>
      )}

      <CardHeader className="text-center pb-2">
        <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center">
          <Crown className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="text-lg">{planName}</CardTitle>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
        <div className="mt-4">
          <span className="text-4xl font-bold">¥{price.toLocaleString()}</span>
          <span className="text-muted-foreground">/{period}</span>
        </div>
      </CardHeader>

      <CardContent>
        <ul className="space-y-3 mb-6">
          {features.map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-primary flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {error && (
          <p className="text-sm text-destructive mb-4 text-center">{error}</p>
        )}

        {isPremium ? (
          <Button className="w-full" disabled variant="secondary">
            現在ご利用中
          </Button>
        ) : (
          <Button
            variant="bonsai"
            className="w-full"
            onClick={handleSubscribe}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                処理中...
              </>
            ) : (
              'プレミアムに登録'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
