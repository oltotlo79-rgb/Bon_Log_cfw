'use client'

/**
 * @module components/onboarding/OnboardingComplete
 * オンボーディング完了ボタン。完了を記録してフィードへ遷移する。
 */

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { completeOnboarding } from '@/lib/actions/onboarding'
import { ROUTE_FEED } from '@/lib/constants/routes'
import { MSG_ERROR_TITLE } from '@/lib/constants/messages'

export function OnboardingComplete() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()

  function handleComplete() {
    startTransition(async () => {
      const result = await completeOnboarding()
      if (!result.success) {
        toast({ title: MSG_ERROR_TITLE, description: result.error, variant: 'destructive' })
        return
      }
      router.push(ROUTE_FEED)
      router.refresh()
    })
  }

  return (
    <Button variant="bonsai" size="lg" className="w-full" onClick={handleComplete} disabled={isPending}>
      {isPending ? '準備中...' : 'はじめる'}
    </Button>
  )
}
