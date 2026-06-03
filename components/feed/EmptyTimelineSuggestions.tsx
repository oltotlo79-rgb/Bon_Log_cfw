/**
 * 空フィードのオンボーディング用おすすめユーザー。
 * タイムラインが空のときだけマウントされるため、無駄な取得は発生しない。
 *
 * @module components/feed/EmptyTimelineSuggestions
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { getRecommendedUsers } from '@/lib/actions/feed'
import { RecommendedUserList } from '@/components/user/RecommendedUserList'
import { ONBOARDING_RECOMMENDED_USERS_LIMIT, RECOMMENDED_USERS_STALE_TIME_MS } from '@/lib/constants/limits'

export function EmptyTimelineSuggestions() {
  const { data } = useQuery({
    queryKey: ['recommended-users', 'empty-timeline'],
    queryFn: () => getRecommendedUsers(ONBOARDING_RECOMMENDED_USERS_LIMIT),
    staleTime: RECOMMENDED_USERS_STALE_TIME_MS,
  })

  const users = data?.users ?? []
  if (users.length === 0) return null

  return (
    <div className="mt-8 text-left" data-testid="empty-timeline-suggestions">
      <h4 className="text-sm font-semibold mb-4 text-center">おすすめのユーザー</h4>
      <RecommendedUserList users={users} />
    </div>
  )
}
