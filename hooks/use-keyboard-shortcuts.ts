/**
 * グローバルキーボードショートカット管理フック
 *
 * @description
 * アプリケーション全体で使用するキーボードショートカットを提供します。
 * 入力フィールドにフォーカスがある場合はショートカットを無効化します。
 *
 * @features
 * - `/` : 検索バーにフォーカス
 * - `n` : 新規投稿モーダルを開く
 * - `?` : キーボードショートカットヘルプを表示
 * - `Escape` : モーダルを閉じる
 * - `g` + `h` : ホーム（タイムライン）に移動
 * - `g` + `n` : 通知ページに移動
 * - `g` + `p` : プロフィールページに移動
 *
 * @module hooks/use-keyboard-shortcuts
 */

'use client'

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TIMEOUT_KEY_RESET } from '@/lib/constants/limits'
import { ROUTE_FEED, ROUTE_NOTIFICATIONS, ROUTE_SETTINGS, ROUTE_EVENTS, ROUTE_SHOPS } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'

/**
 * キーボードショートカットフックのオプション
 */
type UseKeyboardShortcutsOptions = {
  /** 新規投稿モーダルを開く関数 */
  onNewPost?: () => void
  /** ヘルプモーダルを開く関数 */
  onShowHelp?: () => void
  /** ユーザーID（プロフィールページへの遷移用） */
  userId?: string
  /** ショートカットを有効にするか（デフォルト: true） */
  enabled?: boolean
}

/**
 * キーボードショートカットの定義
 */
export type KeyboardShortcut = {
  /** ショートカットキー（表示用） */
  keys: string
  /** 説明 */
  description: string
  /** カテゴリ */
  category: 'navigation' | 'actions' | 'general'
}

/**
 * 利用可能なキーボードショートカット一覧
 */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // ナビゲーション
  { keys: 'g h', description: 'タイムラインに移動', category: 'navigation' },
  { keys: 'g n', description: '通知ページに移動', category: 'navigation' },
  { keys: 'g p', description: 'プロフィールに移動', category: 'navigation' },
  { keys: 'g s', description: '設定ページに移動', category: 'navigation' },
  { keys: 'g e', description: 'イベントページに移動', category: 'navigation' },
  { keys: 'g m', description: '盆栽園マップに移動', category: 'navigation' },
  // アクション
  { keys: '/', description: '検索にフォーカス', category: 'actions' },
  { keys: 'n', description: '新規投稿を作成', category: 'actions' },
  // 一般
  { keys: '?', description: 'ショートカット一覧を表示', category: 'general' },
  { keys: 'Esc', description: 'モーダルを閉じる', category: 'general' },
]

/**
 * グローバルキーボードショートカットフック
 *
 * @param options - オプション
 * @returns ヘルプモーダルの状態と制御関数
 *
 * @example
 * ```tsx
 * const { showHelp, setShowHelp } = useKeyboardShortcuts({
 *   onNewPost: () => setComposeOpen(true),
 *   userId: session.user.id,
 * })
 * ```
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const {
    onNewPost,
    onShowHelp,
    userId,
    enabled = true,
  } = options

  const router = useRouter()

  /**
   * ヘルプモーダルの表示状態
   */
  const [showHelp, setShowHelp] = useState(false)

  /**
   * 「g」キーが押されたかどうか（連続キー用）
   */
  const [gKeyPressed, setGKeyPressed] = useState(false)

  /**
   * 入力フィールドにフォーカスがあるかチェック
   */
  const isInputFocused = useCallback(() => {
    const activeElement = document.activeElement
    if (!activeElement) return false

    const tagName = activeElement.tagName.toUpperCase()
    const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA'
    const isContentEditable = activeElement.getAttribute('contenteditable') === 'true'

    return isInput || isContentEditable
  }, [])

  /**
   * キーボードイベントハンドラ
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 無効化されている場合は何もしない
    if (!enabled) return

    // 入力フィールドにフォーカスがある場合は一部のショートカットのみ有効
    const inputFocused = isInputFocused()

    // Escapeキーはどこでも有効
    if (event.key === 'Escape') {
      if (showHelp) {
        setShowHelp(false)
        event.preventDefault()
      }
      return
    }

    // 入力フィールドにフォーカスがある場合は他のショートカットを無効化
    if (inputFocused) {
      // gキーのリセット
      setGKeyPressed(false)
      return
    }

    // 修飾キー（Ctrl, Alt, Meta）が押されている場合は無視
    if (event.ctrlKey || event.altKey || event.metaKey) {
      setGKeyPressed(false)
      return
    }

    const key = event.key.toLowerCase()

    // 「g」キーの後のナビゲーションショートカット
    if (gKeyPressed) {
      setGKeyPressed(false)
      event.preventDefault()

      switch (key) {
        case 'h': // g h: ホーム
          router.push(ROUTE_FEED)
          break
        case 'n': // g n: 通知
          router.push(ROUTE_NOTIFICATIONS)
          break
        case 'p': // g p: プロフィール
          if (userId) {
            router.push(buildUserPath(userId))
          }
          break
        case 's': // g s: 設定
          router.push(ROUTE_SETTINGS)
          break
        case 'e': // g e: イベント
          router.push(ROUTE_EVENTS)
          break
        case 'm': // g m: マップ
          router.push(ROUTE_SHOPS)
          break
      }
      return
    }

    // 単体キーのショートカット
    switch (key) {
      case 'g':
        // 「g」キーを押した状態を記録
        setGKeyPressed(true)
        // 1秒後にリセット
        setTimeout(() => setGKeyPressed(false), TIMEOUT_KEY_RESET)
        break

      case '/':
        // 検索にフォーカス
        event.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]')
        if (searchInput) {
          searchInput.focus()
        }
        break

      case 'n':
        // 新規投稿
        event.preventDefault()
        onNewPost?.()
        break

      case '?':
        // ヘルプを表示
        event.preventDefault()
        if (onShowHelp) {
          onShowHelp()
        } else {
          setShowHelp(true)
        }
        break
    }
  }, [enabled, isInputFocused, gKeyPressed, showHelp, router, userId, onNewPost, onShowHelp])

  /**
   * イベントリスナーの登録
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    showHelp,
    setShowHelp,
    gKeyPressed,
    shortcuts: KEYBOARD_SHORTCUTS,
  }
}
