/**
 * @ 入力でフォロー中ユーザーを優先したオートコンプリートを表示するテキストエリア。
 * 選択時はテキスト中に `<@userId>` 形式で挿入する (表示は PostCard 側で `@nickname` に変換)。
 *
 * @module components/common/MentionTextarea
 */

'use client'

import { clientLogger } from '@/lib/client-logger'
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import Image from 'next/image'
import { Textarea } from '@/components/ui/textarea'
import { searchMentionUsers } from '@/lib/actions/mention'
import { insertMention } from '@/lib/mention-utils'
import { cn } from '@/lib/utils'
import { MAX_MENTION_SUGGESTIONS, DEBOUNCE_DELAY_MS } from '@/lib/constants/limits'

type MentionUser = {
  id: string
  nickname: string
  avatarUrl: string | null
  isFollowing: boolean
}

type MentionTextareaProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  rows?: number
  className?: string
  disabled?: boolean
  autoFocus?: boolean
  'aria-label'?: string
}

const DEBOUNCE_DELAY = DEBOUNCE_DELAY_MS
const MAX_SUGGESTIONS = MAX_MENTION_SUGGESTIONS

export function MentionTextarea({
  value,
  onChange,
  placeholder,
  maxLength,
  rows = 3,
  className,
  disabled = false,
  autoFocus = false,
  'aria-label': ariaLabel,
}: MentionTextareaProps) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerPosition, setTriggerPosition] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 空クエリ時はフォロー中ユーザーを優先表示する (mention.ts の searchMentionUsers 側で実装)。
  const searchUsers = useCallback(async (searchQuery: string) => {
    setIsLoading(true)
    try {
      const users = await searchMentionUsers(searchQuery, MAX_SUGGESTIONS)
      setSuggestions(users)
      setShowSuggestions(users.length > 0)
      setSelectedIndex(0)
    } catch (error) {
      clientLogger.error('メンション検索エラー:', error)
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const debouncedSearch = useCallback((searchQuery: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      searchUsers(searchQuery)
    }, DEBOUNCE_DELAY)
  }, [searchUsers])

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const newValue = e.target.value
    const cursorPosition = e.target.selectionStart

    onChange(newValue)

    const textBeforeCursor = newValue.slice(0, cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      // @ の直前が空白・改行・文頭のときだけメンション開始とみなす（メール等の誤検出回避）
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
      const isValidTrigger = charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0

      if (isValidTrigger) {
        const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
        const hasSpaceOrNewline = /[\s\n]/.test(textAfterAt)

        if (!hasSpaceOrNewline) {
          setTriggerPosition(lastAtIndex)
          debouncedSearch(textAfterAt)
          return
        }
      }
    }

    setTriggerPosition(null)
    setSuggestions([])
    setShowSuggestions(false)
  }

  function selectUser(user: MentionUser) {
    if (triggerPosition === null) return

    const cursorPosition = textareaRef.current?.selectionStart ?? value.length
    const { text: newText, cursor: newCursor } = insertMention(
      value,
      user.id,
      cursorPosition,
      triggerPosition
    )

    onChange(newText)

    // DOM 反映後にキャレットを挿入後位置へ移すため次フレームで設定する
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newCursor
        textareaRef.current.selectionEnd = newCursor
        textareaRef.current.focus()
      }
    }, 0)

    setTriggerPosition(null)
    setSuggestions([])
    setShowSuggestions(false)
    setSelectedIndex(0)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % suggestions.length)
        break

      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
        break

      case 'Enter':
        if (suggestions[selectedIndex]) {
          e.preventDefault()
          selectUser(suggestions[selectedIndex])
        }
        break

      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSuggestions([])
        setTriggerPosition(null)
        break

      case 'Tab':
        if (suggestions[selectedIndex]) {
          e.preventDefault()
          selectUser(suggestions[selectedIndex])
        }
        break
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target instanceof Node)) return
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        className={cn('resize-none', className)}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              検索中...
            </div>
          ) : (
            <ul className="py-1">
              {suggestions.map((user, index) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => selectUser(user)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                      index === selectedIndex
                        ? 'bg-muted'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                      {user.avatarUrl ? (
                        <Image
                          src={user.avatarUrl}
                          alt={user.nickname}
                          width={32}
                          height={32}
                          sizes="32px"
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                          {user.nickname[0]}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          @{user.nickname}
                        </span>
                        {user.isFollowing && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            フォロー中
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">
            <span className="mr-3">↑↓ 選択</span>
            <span className="mr-3">Enter 確定</span>
            <span>Esc 閉じる</span>
          </div>
        </div>
      )}
    </div>
  )
}
