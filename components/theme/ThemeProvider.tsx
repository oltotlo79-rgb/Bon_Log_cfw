/**
 * テーマプロバイダーコンポーネント
 *
 * @module components/theme/ThemeProvider
 */

'use client'

/**
 * React Contextを作成するための関数
 * テーマ情報をコンポーネントツリー全体で共有するために使用
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react'

import { STORAGE_KEY_THEME } from '@/lib/constants/storage-keys'

/**
 * テーマの種類を表す型
 *
 * @description
 * - 'light': ライトモード（明るい背景）
 * - 'dark': ダークモード（暗い背景）
 * - 'system': OSの設定に従う
 */
type Theme = 'light' | 'dark' | 'system'

/**
 * テーマContextで提供される値の型定義
 *
 * @property theme - ユーザーが選択したテーマ設定（light/dark/system）
 * @property resolvedTheme - 実際に適用されているテーマ（light/dark）
 *                          systemの場合はOSの設定から解決される
 * @property setTheme - テーマを変更するための関数
 */
interface ThemeContextType {
  /** ユーザーが選択したテーマ設定 */
  theme: Theme
  /** 実際に適用されているテーマ（systemの場合はOS設定から解決） */
  resolvedTheme: 'light' | 'dark'
  /** テーマを変更する関数 */
  setTheme: (theme: Theme) => void
}

/**
 * localStorageでテーマを保存する際のキー名
 * @see {@link STORAGE_KEY_THEME} from lib/constants/storage-keys
 */
const STORAGE_KEY = STORAGE_KEY_THEME

/**
 * テーマ情報を共有するためのReact Context
 *
 * @description
 * undefinedで初期化し、Provider外で使用された場合にエラーを検出できるようにする
 */
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * OSのシステムテーマを取得する
 *
 * @returns 'dark' - OSがダークモードの場合
 * @returns 'light' - OSがライトモードの場合、またはサーバーサイドの場合
 *
 * @description
 * window.matchMediaを使用してOSの prefers-color-scheme を検出
 * サーバーサイドではwindowが存在しないため、デフォルトで'light'を返す
 */
function getSystemTheme(): 'light' | 'dark' {
  // サーバーサイドではwindowが存在しないため、デフォルト値を返す
  if (typeof window === 'undefined') return 'light'

  // OSのダークモード設定を確認
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * テーマプロバイダーコンポーネント
 *
 * アプリケーション全体にテーマ機能を提供するProviderコンポーネント。
 * このコンポーネントでラップされた子コンポーネントは、useTheme()フックを
 * 使用してテーマ情報にアクセスできます。
 *
 * ## 主な責務
 * 1. テーマ状態の管理（useState）
 * 2. localStorageからの初期テーマの読み込み
 * 3. テーマ変更時のlocalStorageへの保存
 * 4. HTMLルート要素へのテーマクラスの適用
 * 5. OSのテーマ変更の監視と自動追従
 * 6. ハイドレーションミスマッチの防止
 *
 * @param children - ラップする子コンポーネント
 *
 * @example
 * ```tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {

  /**
   * ユーザーが選択したテーマ設定を管理
   *
   * @description
   * - 'light': ライトモード
   * - 'dark': ダークモード
   * - 'system': OSの設定に従う
   *
   * 初期値は'system'で、useEffectでlocalStorageから実際の値を読み込む
   */
  const [theme, setThemeState] = useState<Theme>('system')

  /**
   * 実際に適用されているテーマを管理
   *
   * @description
   * themeが'system'の場合、OSの設定から解決された値が入る
   * CSSの適用やUIの表示に使用される
   */
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  /**
   * コンポーネントがマウントされたかどうかを管理
   *
   * @description
   * サーバーサイドレンダリング時のハイドレーションミスマッチを防ぐため、
   * クライアントサイドでマウントされるまでは仮の値を返す
   */
  const [mounted, setMounted] = useState(false)

  /**
   * テーマをDOMに適用する関数
   *
   * @param newTheme - 適用するテーマ（light/dark/system）
   *
   * @description
   * 1. 'system'の場合はOSの設定から実際のテーマを解決
   * 2. resolvedTheme状態を更新
   * 3. HTMLルート要素のクラスを更新（light/darkクラス）
   * 4. color-schemeプロパティを設定（ブラウザのネイティブUI用）
   */
  const applyTheme = useCallback((newTheme: Theme) => {
    // 'system'の場合はOSの設定から解決、それ以外はそのまま使用
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme
    setResolvedTheme(resolved)

    // HTMLルート要素（<html>）を取得
    const root = document.documentElement

    // 既存のテーマクラスを削除
    root.classList.remove('light', 'dark')

    // 新しいテーマクラスを追加
    root.classList.add(resolved)

    // ブラウザのネイティブUIのカラースキームを設定
    // （スクロールバー、フォーム要素などに影響）
    root.style.colorScheme = resolved
  }, [])

  /**
   * テーマを変更する関数（外部から呼び出される）
   *
   * @param newTheme - 新しいテーマ設定
   *
   * @description
   * 1. React状態を更新
   * 2. localStorageに保存（永続化）
   * 3. DOMにテーマを適用
   */
  const setTheme = useCallback((newTheme: Theme) => {
    // React状態を更新
    setThemeState(newTheme)

    // localStorageに保存して永続化
    localStorage.setItem(STORAGE_KEY, newTheme)

    // DOMにテーマを適用
    applyTheme(newTheme)
  }, [applyTheme])

  /**
   * 初期化処理：localStorageからテーマを読み込んで適用
   *
   * @description
   * コンポーネントのマウント時に1回だけ実行される
   * 1. localStorageから保存済みのテーマ設定を取得
   * 2. 保存されていない場合は'system'をデフォルトとして使用
   * 3. テーマをDOMに適用
   * 4. mountedフラグをtrueに設定
   *
   * @note
   * localStorageはクライアントサイドでのみ利用可能なため、
   * useEffect内で実行する必要がある
   */
  useEffect(() => {
    // localStorageから保存済みのテーマを取得
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null

    // 保存されていなければ'system'をデフォルトとして使用
    const initial = stored || 'system'

    // 状態を更新（初期値と異なる場合のみ）
    // eslint-disable-next-line react-hooks/set-state-in-effect -- クライアントサイドでの初期化処理
    setThemeState((prev) => (prev !== initial ? initial : prev))

    // テーマをDOMに適用
    applyTheme(initial)

    // マウント完了フラグを設定
    setMounted((prev) => (prev ? prev : true))
  }, [applyTheme])

  /**
   * OSのテーマ変更を監視して自動追従
   *
   * @description
   * ユーザーがOSのダークモード設定を変更した時に、
   * テーマが'system'に設定されていれば自動的にテーマを更新する
   *
   * MediaQueryListのchangeイベントをリッスンして変更を検出
   */
  useEffect(() => {
    // マウント前は何もしない
    if (!mounted) return

    // OSのダークモード設定を監視するMediaQueryListを取得
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    /**
     * OSのテーマが変更された時のハンドラ
     *
     * @description
     * テーマ設定が'system'の場合のみテーマを再適用
     * （手動でlight/darkを設定している場合は変更しない）
     */
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }

    // イベントリスナーを登録
    mediaQuery.addEventListener('change', handleChange)

    // クリーンアップ：コンポーネントのアンマウント時にリスナーを解除
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, applyTheme, mounted])

  /**
   * サーバーサイドレンダリング時のハイドレーション対応
   *
   * @description
   * クライアントサイドでマウントされるまでは、デフォルト値を持つ
   * Providerを返す。これによりハイドレーションミスマッチを防ぐ。
   *
   * setThemeは空関数を渡すことで、マウント前の呼び出しを無視する
   */
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{
          theme: 'system',
          resolvedTheme: 'light',
          setTheme: () => {}, // マウント前は何もしない
        }}
      >
        {children}
      </ThemeContext.Provider>
    )
  }

  /**
   * マウント後は実際のテーマ状態を持つProviderを返す
   */
  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * テーマ情報にアクセスするためのカスタムフック
 *
 * @returns ThemeContextType - テーマ情報と操作関数
 * @throws Error - ThemeProvider外で使用された場合
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, resolvedTheme, setTheme } = useTheme()
 *
 *   // 現在のテーマを表示
 *   console.log(`設定: ${theme}, 実際: ${resolvedTheme}`)
 *
 *   // テーマを変更
 *   return (
 *     <button onClick={() => setTheme('dark')}>
 *       ダークモードに切り替え
 *     </button>
 *   )
 * }
 * ```
 *
 * @description
 * このフックは必ずThemeProviderの子コンポーネント内で使用する必要がある。
 * Provider外で使用するとエラーがスローされる。
 */
export function useTheme() {
  // Contextから値を取得
  const context = useContext(ThemeContext)

  // Provider外で使用された場合はエラーをスロー
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }

  return context
}
