/**
 * テーマ切り替えコンポーネント
 *
 * @module components/theme/ThemeToggle
 */

'use client'

import { useTheme } from './ThemeProvider'

import { Sun as SunIcon, Moon as MoonIcon, Monitor as MonitorIcon } from 'lucide-react'

interface ThemeToggleProps {
  showLabel?: boolean
  className?: string
}

export function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'ライト'
      case 'dark':
        return 'ダーク'
      case 'system':
        return 'システム'
    }
  }

  const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon

  return (
    <button
      onClick={cycleTheme}
      className={`flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors ${className}`}
      title={`現在: ${getLabel()}モード`}
      aria-label={`テーマを切り替える（現在: ${getLabel()}モード）`}
    >
      <Icon className="w-5 h-5" />
      {showLabel && <span className="text-sm">{getLabel()}</span>}
    </button>
  )
}

interface ThemeSelectProps {
  className?: string
}

export function ThemeSelect({ className = '' }: ThemeSelectProps) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-muted-foreground">テーマ</label>

      <div className="flex gap-2">
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'light'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
          aria-pressed={theme === 'light'}
          aria-label="ライトモードに設定"
        >
          <SunIcon className="w-4 h-4" />
          <span className="text-sm">ライト</span>
        </button>

        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'dark'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
          aria-pressed={theme === 'dark'}
          aria-label="ダークモードに設定"
        >
          <MoonIcon className="w-4 h-4" />
          <span className="text-sm">ダーク</span>
        </button>

        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'system'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
          aria-pressed={theme === 'system'}
          aria-label="システム設定に従う"
        >
          <MonitorIcon className="w-4 h-4" />
          <span className="text-sm">自動</span>
        </button>
      </div>
    </div>
  )
}
