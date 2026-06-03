/**
 * @module components/subscription/PremiumBadge
 */

'use client'

import Image from 'next/image'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

type PremiumBadgeProps = {
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
}

const sizePx = {
  sm: 14,
  md: 16,
  lg: 20,
}

export function PremiumBadge({ size = 'sm', showTooltip = true }: PremiumBadgeProps) {
  const px = sizePx[size]
  const badge = (
    <span className="inline-flex items-center justify-center">
      <Image
        src="/images/generated/premium/premium-badge.webp"
        alt="プレミアム"
        width={px}
        height={px}
        className="dark:hidden"
      />
      <Image
        src="/images/generated/premium/premium-badge-dark.webp"
        alt="プレミアム"
        width={px}
        height={px}
        className="hidden dark:block"
      />
    </span>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>プレミアム会員</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
