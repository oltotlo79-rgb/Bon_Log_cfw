'use client'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { HormoneAnnualCalendar } from '@/components/hormone/HormoneAnnualCalendar'

type SeasonalLevel = {
  month: number
  level: string
  description: string | null
}

type HormoneWithLevels = {
  name: string
  slug: string
  seasonalLevels: SeasonalLevel[]
}

type Props = {
  hormones: HormoneWithLevels[]
}

export function CalendarWithNavigation({ hormones }: Props) {
  const router = useRouter()

  const handleMonthClick = useCallback(
    (month: number) => {
      router.push(`/hormones/simulator?month=${month}`)
    },
    [router]
  )

  return <HormoneAnnualCalendar hormones={hormones} onMonthClick={handleMonthClick} />
}
