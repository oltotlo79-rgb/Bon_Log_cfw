'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Search, Crown, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { searchUserForPremium, grantPremium } from '@/lib/actions/admin/premium'
import {
  DEFAULT_PREMIUM_GRANT_DAYS,
  MIN_PREMIUM_GRANT_DAYS,
  MAX_PREMIUM_GRANT_DAYS,
  MIN_ADMIN_SEARCH_QUERY_LENGTH,
  ADMIN_PREMIUM_SEARCH_DEBOUNCE_MS,
} from '@/lib/constants/limits'
import { useToast } from '@/hooks/use-toast'

type SearchUserResult = Awaited<ReturnType<typeof searchUserForPremium>>
type SearchedUser = Extract<SearchUserResult, { users: unknown[] }>['users'][number]

export function GrantPremiumPanel() {
  const router = useRouter()
  const { toast } = useToast()

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null)
  const [daysInput, setDaysInput] = useState(String(DEFAULT_PREMIUM_GRANT_DAYS))
  const [isGranting, setIsGranting] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  // debounce タイマー
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (value.length < MIN_ADMIN_SEARCH_QUERY_LENGTH) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      void runSearch(value)
    }, ADMIN_PREMIUM_SEARCH_DEBOUNCE_MS)
  }

  async function runSearch(q: string) {
    setIsSearching(true)
    setHasSearched(true)
    const result = await searchUserForPremium(q)

    if (!('users' in result)) {
      toast({ title: '検索に失敗しました', variant: 'destructive' })
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setSearchResults(result.users)
    setIsSearching(false)
  }

  function handleSelectUser(user: SearchedUser) {
    setSelectedUser(user)
    setDaysInput(String(DEFAULT_PREMIUM_GRANT_DAYS))
    setDialogOpen(true)
  }

  function handleDialogClose() {
    setDialogOpen(false)
    setSelectedUser(null)
    setDaysInput(String(DEFAULT_PREMIUM_GRANT_DAYS))
  }

  async function handleGrant() {
    if (!selectedUser) return

    const daysNum = parseInt(daysInput, 10)
    if (isNaN(daysNum) || daysNum < MIN_PREMIUM_GRANT_DAYS || daysNum > MAX_PREMIUM_GRANT_DAYS) {
      toast({
        title: `日数は ${MIN_PREMIUM_GRANT_DAYS}〜${MAX_PREMIUM_GRANT_DAYS} の範囲で入力してください`,
        variant: 'destructive',
      })
      return
    }

    setIsGranting(true)
    const result = await grantPremium(selectedUser.id, daysNum)
    setIsGranting(false)

    if (!result.success) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    const expiresAt = result.data?.expiresAt
    const expiresLabel = expiresAt
      ? new Date(expiresAt).toLocaleDateString('ja-JP')
      : '不明'

    toast({
      title: `${selectedUser.nickname} さんにプレミアムを付与しました`,
      description: `有効期限: ${expiresLabel}`,
    })

    handleDialogClose()
    // 付与済みユーザーを検索結果から反映するため再検索する
    if (query.length >= MIN_ADMIN_SEARCH_QUERY_LENGTH) {
      void runSearch(query)
    }
    router.refresh()
  }

  const parsedDays = parseInt(daysInput, 10)
  const isDaysValid =
    !isNaN(parsedDays) &&
    parsedDays >= MIN_PREMIUM_GRANT_DAYS &&
    parsedDays <= MAX_PREMIUM_GRANT_DAYS

  return (
    <div className="bg-card rounded-lg border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-base font-semibold">ユーザーを検索してプレミアムを付与</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="ニックネーム・メールアドレスで検索（2文字以上）"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {isSearching && (
        <p className="text-sm text-muted-foreground">検索中...</p>
      )}

      {!isSearching && hasSearched && searchResults.length === 0 && (
        <p className="text-sm text-muted-foreground">ユーザーが見つかりませんでした</p>
      )}

      {!isSearching && searchResults.length > 0 && (
        <ul className="divide-y rounded-lg border overflow-hidden">
          {searchResults.map((user) => (
            <li
              key={user.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
            >
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.nickname}
                  width={36}
                  height={36}
                  className="rounded-full shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.nickname}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>

              {user.isPremium ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    <UserCheck className="w-3 h-3" />
                    プレミアム済み
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSelectUser(user)}
                  >
                    再付与
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleSelectUser(user)}
                  className="shrink-0"
                >
                  付与する
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {selectedUser && (
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>プレミアム会員を付与</DialogTitle>
              <DialogDescription>
                {selectedUser.nickname} さんにプレミアム会員を付与します
                {selectedUser.isPremium && selectedUser.premiumExpiresAt && (
                  <span className="block mt-1">
                    現在の期限:{' '}
                    {new Date(selectedUser.premiumExpiresAt).toLocaleDateString('ja-JP')}
                    （新規付与で上書きされます）
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="grant-days">有効日数</Label>
                <Input
                  id="grant-days"
                  type="number"
                  value={daysInput}
                  onChange={(e) => setDaysInput(e.target.value)}
                  min={MIN_PREMIUM_GRANT_DAYS}
                  max={MAX_PREMIUM_GRANT_DAYS}
                />
                <p className="text-xs text-muted-foreground">
                  {MIN_PREMIUM_GRANT_DAYS}〜{MAX_PREMIUM_GRANT_DAYS} 日の範囲で指定してください
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose}>
                キャンセル
              </Button>
              <Button onClick={handleGrant} disabled={isGranting || !isDaysValid}>
                {isGranting ? '処理中...' : '付与する'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
