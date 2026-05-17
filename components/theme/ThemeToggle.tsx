/**
 * テーマ切り替えコンポーネント
 *
 * @module components/theme/ThemeToggle
 */

'use client'

/**
 * テーマコンテキストのカスタムHook
 *
 * @description
 * ThemeProviderから提供されるテーマ情報にアクセスするためのフック
 * - theme: 現在のテーマ設定（light/dark/system）
 * - resolvedTheme: 実際に適用されているテーマ（light/dark）
 * - setTheme: テーマを変更する関数
 *
 * @see ThemeProvider.tsx
 */
import { useTheme } from './ThemeProvider'

import { Sun as SunIcon, Moon as MoonIcon, Monitor as MonitorIcon } from 'lucide-react'

/**
 * ThemeToggleコンポーネントのprops型
 *
 * @property showLabel - テーマ名のラベルを表示するかどうか
 *                       true: アイコンの横にテーマ名を表示
 *                       false: アイコンのみ表示（デフォルト）
 * @property className - 追加のCSSクラス
 *                       ボタンの外観をカスタマイズする際に使用
 */
interface ThemeToggleProps {
  /** テーマ名のラベルを表示するかどうか（デフォルト: false） */
  showLabel?: boolean
  /** 追加のCSSクラス */
  className?: string
}

/**
 * テーマトグルボタンコンポーネント
 *
 * クリックするたびにテーマが順番に切り替わるトグルボタン。
 * ヘッダーやサイドバーに配置して、ユーザーが手軽にテーマを
 * 切り替えられるようにするために使用します。
 *
 * ## 動作
 * - クリックでテーマを順番に切り替え
 * - light → dark → system → light の順で循環
 * - 現在のテーマに応じたアイコンを表示
 *
 * ## アイコン
 * - light: 太陽アイコン
 * - dark: 月アイコン
 * - system: モニターアイコン
 *
 * @param showLabel - ラベル表示フラグ（デフォルト: false）
 * @param className - 追加のCSSクラス
 * @returns テーマトグルボタンのJSX
 *
 * @example
 * ```tsx
 * // アイコンのみ
 * <ThemeToggle />
 *
 * // ラベル付き
 * <ThemeToggle showLabel />
 *
 * // カスタムクラス付き
 * <ThemeToggle className="ml-4" />
 * ```
 */
export function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {

  /**
   * テーマコンテキストから現在のテーマと設定関数を取得
   *
   * @description
   * - theme: 現在選択されているテーマ（light/dark/system）
   * - setTheme: テーマを変更する関数
   */
  const { theme, setTheme } = useTheme()

  /**
   * テーマを順番に切り替えるイベントハンドラ
   *
   * @description
   * ボタンクリック時に呼び出され、テーマを次の状態に切り替える
   * 循環順序: light → dark → system → light
   *
   * この循環順序の理由:
   * 1. light と dark は直感的な対比
   * 2. system は「どちらでもない」中間的な選択肢として最後に配置
   * 3. 3回クリックで元のテーマに戻れる
   */
  const cycleTheme = () => {
    if (theme === 'light') {
      // ライト → ダーク
      setTheme('dark')
    } else if (theme === 'dark') {
      // ダーク → システム
      setTheme('system')
    } else {
      // システム → ライト
      setTheme('light')
    }
  }

  /**
   * 現在のテーマに対応する日本語ラベルを取得
   *
   * @returns 'ライト' | 'ダーク' | 'システム'
   *
   * @description
   * UIに表示するための日本語テキストを返す
   * showLabel=true の場合と title属性 に使用
   */
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

  /**
   * 現在のテーマに対応するアイコンコンポーネントを選択
   *
   * @description
   * テーマに応じて適切なアイコンコンポーネントを返す
   * - light → SunIcon（太陽）
   * - dark → MoonIcon（月）
   * - system → MonitorIcon（モニター）
   */
  const Icon = theme === 'light' ? SunIcon : theme === 'dark' ? MoonIcon : MonitorIcon

  return (
    <button
      onClick={cycleTheme}
      className={`flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors ${className}`}
      title={`現在: ${getLabel()}モード`}
      aria-label={`テーマを切り替える（現在: ${getLabel()}モード）`}
    >
      {/* テーマに応じたアイコンを表示 */}
      <Icon className="w-5 h-5" />
      {/* showLabel=true の場合のみラベルを表示 */}
      {showLabel && <span className="text-sm">{getLabel()}</span>}
    </button>
  )
}

/**
 * ThemeSelectコンポーネントのprops型
 *
 * @property className - 追加のCSSクラス
 *                       コンテナの外観をカスタマイズする際に使用
 */
interface ThemeSelectProps {
  /** 追加のCSSクラス */
  className?: string
}

/**
 * テーマ選択コンポーネント
 *
 * 3つのボタンで直接テーマを選択できるセレクターコンポーネント。
 * 設定画面など、ユーザーがテーマを明確に選択する場面で使用します。
 *
 * ## 表示
 * - 「テーマ」ラベル
 * - ライト（太陽アイコン）- 明るい背景
 * - ダーク（月アイコン）- 暗い背景
 * - 自動（モニターアイコン）- OSの設定に従う
 *
 * ## スタイル
 * - 選択中のボタンはprimary色で強調表示
 * - 未選択のボタンはmuted色で表示
 * - ホバー時に背景色が変化
 *
 * @param className - 追加のCSSクラス
 * @returns テーマ選択UIのJSX
 *
 * @example
 * ```tsx
 * // 基本的な使用
 * <ThemeSelect />
 *
 * // カスタムクラス付き
 * <ThemeSelect className="mt-4" />
 * ```
 */
export function ThemeSelect({ className = '' }: ThemeSelectProps) {
  /**
   * テーマコンテキストから現在のテーマと設定関数を取得
   *
   * @description
   * - theme: 現在選択されているテーマ（light/dark/system）
   * - setTheme: テーマを変更する関数
   */
  const { theme, setTheme } = useTheme()

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {/* セクションラベル */}
      <label className="text-sm font-medium text-muted-foreground">テーマ</label>

      {/* テーマ選択ボタン群 */}
      <div className="flex gap-2">
        {/* ライトモードボタン */}
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'light'
              ? 'bg-primary text-primary-foreground' // 選択中: primary色
              : 'bg-muted hover:bg-muted/80'          // 未選択: muted色
          }`}
          aria-pressed={theme === 'light'}
          aria-label="ライトモードに設定"
        >
          <SunIcon className="w-4 h-4" />
          <span className="text-sm">ライト</span>
        </button>

        {/* ダークモードボタン */}
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'dark'
              ? 'bg-primary text-primary-foreground' // 選択中: primary色
              : 'bg-muted hover:bg-muted/80'          // 未選択: muted色
          }`}
          aria-pressed={theme === 'dark'}
          aria-label="ダークモードに設定"
        >
          <MoonIcon className="w-4 h-4" />
          <span className="text-sm">ダーク</span>
        </button>

        {/* システム設定に従うボタン */}
        <button
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
            theme === 'system'
              ? 'bg-primary text-primary-foreground' // 選択中: primary色
              : 'bg-muted hover:bg-muted/80'          // 未選択: muted色
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
