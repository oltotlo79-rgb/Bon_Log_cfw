/**
 * テーマプロバイダーコンポーネント
 *
 * @module components/theme/ThemeProvider
 */

'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

import { STORAGE_KEY_THEME } from '@/lib/constants/storage-keys'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = STORAGE_KEY_THEME

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_VALUES = ['light', 'dark', 'system'] as const
function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEME_VALUES as readonly string[]).includes(value)
}

function getSystemTheme(): 'light' | 'dark' {
  // サーバーサイドでは window が存在しないためデフォルト値を返す
  if (typeof window === 'undefined') return 'light'

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  const [mounted, setMounted] = useState(false)

  const applyTheme = useCallback((newTheme: Theme) => {
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
    setResolvedTheme(resolved)

    const root = document.documentElement

    root.classList.remove('light', 'dark')

    root.classList.add(resolved)

    // ブラウザのネイティブ UI（スクロールバー・フォーム要素）に反映させる
    root.style.colorScheme = resolved
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)

    localStorage.setItem(STORAGE_KEY, newTheme)

    applyTheme(newTheme)
  }, [applyTheme])

  // localStorage はクライアントサイドでのみ利用可能なため useEffect 内で読み込む
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const initial: Theme = isTheme(stored) ? stored : 'system'

    // eslint-disable-next-line react-hooks/set-state-in-effect -- クライアントサイドでの初期化処理
    setThemeState((prev) => (prev !== initial ? initial : prev))

    applyTheme(initial)

    setMounted((prev) => (prev ? prev : true))
  }, [applyTheme])

  useEffect(() => {
    if (!mounted) return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    // 手動で light/dark を選んでいる場合は OS 変更に追従しない
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, applyTheme, mounted])

  // マウント完了までデフォルト値を返してハイドレーションミスマッチを防ぐ
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{
          theme: 'system',
          resolvedTheme: 'light',
          setTheme: () => {},
        }}
      >
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
