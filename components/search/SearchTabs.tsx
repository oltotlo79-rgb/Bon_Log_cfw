/**
 * @module components/search/SearchTabs
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ROUTE_SEARCH } from '@/lib/constants/routes'

type Tab = {
  id: string
  label: string
}

const tabs: Tab[] = [
  { id: 'posts', label: '投稿' },
  { id: 'users', label: 'ユーザー' },
  { id: 'tags', label: 'タグ' },
]

type SearchTabsProps = {
  activeTab?: string
}

export function SearchTabs({ activeTab = 'posts' }: SearchTabsProps) {

  const router = useRouter()
  const searchParams = useSearchParams()

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tabId)
    router.push(`${ROUTE_SEARCH}?${params.toString()}`)
  }

  return (
    <div className="flex border-b">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabChange(tab.id)}
          className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {tab.label}

          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      ))}
    </div>
  )
}
