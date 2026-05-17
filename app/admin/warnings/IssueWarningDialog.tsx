/**
 * @file 警告発行ダイアログコンポーネント
 * @description ユーザーへの警告を発行するためのモーダルダイアログ。
 *              ユーザー検索、レベル選択、理由入力、有効期限設定が可能。
 */

'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { issueWarning } from '@/lib/actions/admin/warnings'
import { searchUserForPremium } from '@/lib/actions/admin/premium'
import { useToast } from '@/hooks/use-toast'

/** 警告レベルの選択肢 */
const LEVEL_OPTIONS = [
  { value: 'notice', label: '注意', description: '軽微な違反への注意喚起' },
  { value: 'warning', label: '警告', description: '繰り返しの違反への警告' },
  { value: 'temp_suspend', label: '一時停止', description: 'アカウントを一時的に停止' },
  { value: 'permanent_ban', label: '永久BAN', description: 'アカウントを永久に停止' },
] as const

/** 検索結果のユーザー型 */
interface SearchUser {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
}

/** IssueWarningDialogのProps型 */
interface IssueWarningDialogProps {
  /** ダイアログの表示状態 */
  isOpen: boolean
  /** ダイアログを閉じるコールバック */
  onClose: () => void
}

/**
 * 警告発行ダイアログコンポーネント
 * ユーザーを検索・選択し、警告レベル・理由・有効期限を設定して警告を発行する
 *
 * @param isOpen - ダイアログの表示状態
 * @param onClose - ダイアログを閉じるコールバック
 */
export function IssueWarningDialog({ isOpen, onClose }: IssueWarningDialogProps) {
  const router = useRouter()
  const { toast } = useToast()

  // フォーム状態
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null)
  const [level, setLevel] = useState<string>('notice')
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** ユーザー検索を実行する */
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    const result = await searchUserForPremium(query)
    setIsSearching(false)

    if ('error' in result) {
      return
    }

    setSearchResults(result.users as SearchUser[])
  }, [])

  /** ユーザーを選択する */
  const handleSelectUser = (user: SearchUser) => {
    setSelectedUser(user)
    setSearchQuery('')
    setSearchResults([])
  }

  /** 選択済みユーザーをクリアする */
  const handleClearUser = () => {
    setSelectedUser(null)
  }

  /** フォームをリセットする */
  const resetForm = () => {
    setSearchQuery('')
    setSearchResults([])
    setSelectedUser(null)
    setLevel('notice')
    setReason('')
    setExpiresAt('')
  }

  /** 警告を発行する */
  const handleSubmit = async () => {
    if (!selectedUser) {
      toast({ title: 'ユーザーを選択してください', variant: 'destructive' })
      return
    }
    if (!reason.trim()) {
      toast({ title: '理由を入力してください', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    const result = await issueWarning({
      userId: selectedUser.id,
      level: level as 'notice' | 'warning' | 'temp_suspend' | 'permanent_ban',
      reason: reason.trim(),
      expiresAt: expiresAt || undefined,
    })
    setIsSubmitting(false)

    if ('error' in result) {
      toast({ title: result.error as string, variant: 'destructive' })
      return
    }

    toast({ title: '警告を発行しました' })
    resetForm()
    onClose()
    router.refresh()
  }

  /** ダイアログを閉じる */
  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* オーバーレイ */}
      <div
        className="fixed inset-0 bg-black/50 z-[200]"
        onClick={handleClose}
      />

      {/* ダイアログ本体 */}
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
        <div
          className="bg-card rounded-lg border shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-bold">警告を発行</h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-muted rounded"
              aria-label="閉じる"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* フォーム */}
          <div className="px-6 py-4 space-y-4">
            {/* ユーザー検索 */}
            <div>
              <label className="block text-sm font-medium mb-1">対象ユーザー</label>
              {selectedUser ? (
                <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
                  {selectedUser.avatarUrl ? (
                    <Image
                      src={selectedUser.avatarUrl}
                      alt={selectedUser.nickname}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-6 h-6 bg-muted rounded-full" />
                  )}
                  <div className="flex-1">
                    <span className="text-sm font-medium">{selectedUser.nickname}</span>
                    <span className="text-xs text-muted-foreground ml-2">{selectedUser.email}</span>
                  </div>
                  <button
                    onClick={handleClearUser}
                    className="p-1 hover:bg-muted rounded text-muted-foreground"
                    aria-label="ユーザー選択を解除"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="ニックネームまたはメールで検索..."
                    className="w-full px-3 py-2 border rounded-lg bg-background"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-2.5 text-xs text-muted-foreground">
                      検索中...
                    </div>
                  )}

                  {/* 検索結果ドロップダウン */}
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted text-left"
                        >
                          {user.avatarUrl ? (
                            <Image
                              src={user.avatarUrl}
                              alt={user.nickname}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 bg-muted rounded-full" />
                          )}
                          <div>
                            <span className="text-sm block">{user.nickname}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-10 px-3 py-2 text-sm text-muted-foreground">
                      ユーザーが見つかりません
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 警告レベル */}
            <div>
              <label className="block text-sm font-medium mb-1">警告レベル</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              >
                {LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.description}
                  </option>
                ))}
              </select>
            </div>

            {/* 理由 */}
            <div>
              <label className="block text-sm font-medium mb-1">理由</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="警告の理由を入力してください..."
                rows={4}
                className="w-full px-3 py-2 border rounded-lg bg-background resize-none"
              />
            </div>

            {/* 有効期限（任意） */}
            <div>
              <label className="block text-sm font-medium mb-1">
                有効期限（任意）
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                未設定の場合、手動で無効化するまで有効です
              </p>
            </div>

            {/* 警告レベルの注意書き */}
            {(level === 'temp_suspend' || level === 'permanent_ban') && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">
                  {level === 'temp_suspend'
                    ? 'この操作により、対象ユーザーのアカウントが一時停止されます。'
                    : 'この操作により、対象ユーザーのアカウントが永久に停止されます。'}
                </p>
              </div>
            )}
          </div>

          {/* フッター */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
            <button
              onClick={handleClose}
              className="px-4 py-2 border rounded-lg hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedUser || !reason.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '発行中...' : '警告を発行'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
