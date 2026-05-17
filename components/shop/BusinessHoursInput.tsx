/**
 * 営業時間入力コンポーネント
 *
 * @module components/shop/BusinessHoursInput
 */

'use client'

/**
 * React Hooks
 * useState: 入力モード、時刻の状態管理
 */
import { useState } from 'react'

/**
 * アナログ時計ピッカーコンポーネント
 * 時刻を時計の文字盤から視覚的に選択できるUI
 */
import { AnalogClockPicker } from '@/components/ui/AnalogClockPicker'

/**
 * BusinessHoursInputコンポーネントのプロパティ定義
 */
interface BusinessHoursInputProps {
  /** 現在の営業時間の値（例: "09:00〜17:00"） */
  value: string
  /** 値が変更された時のコールバック関数 */
  onChange: (value: string) => void
  /** 無効化するかどうか（フォーム送信中など） */
  disabled?: boolean
}

/**
 * 営業時間入力コンポーネント
 *
 * 2つの入力モードを提供:
 * 1. 時計モード: アナログ時計で開店・閉店時刻を視覚的に選択
 * 2. テキストモード: 自由形式のテキスト入力（不規則な営業時間に対応）
 *
 * ## 入力形式
 * - 時計モード: "HH:MM〜HH:MM"（例: "09:00〜17:00"）
 * - テキストモード: 任意の文字列（例: "9:00〜17:00（季節により変動）"）
 *
 * @param value - 現在の営業時間
 * @param onChange - 値変更時のコールバック
 * @param disabled - 無効化フラグ
 */
export function BusinessHoursInput({
  value,
  onChange,
  disabled = false,
}: BusinessHoursInputProps) {

  /**
   * 営業時間文字列をパースする関数
   *
   * "HH:MM〜HH:MM"形式の文字列から開店・閉店時刻を抽出する。
   * 正規表現で柔軟にマッチング（区切り文字は〜、~、-、－のいずれか）。
   *
   * @param str - パース対象の営業時間文字列
   * @returns 開店・閉店時刻のオブジェクト
   *
   * @example
   * parseBusinessHours("09:00〜17:00") // { open: "09:00", close: "17:00" }
   * parseBusinessHours("9:00-17:00")   // { open: "09:00", close: "17:00" }
   * parseBusinessHours("不規則")       // { open: "09:00", close: "17:00" } （デフォルト値）
   */
  const parseBusinessHours = (str: string): { open: string; close: string } => {
    // 正規表現: "時:分" + 区切り文字 + "時:分"
    const match = str.match(/(\d{1,2}:\d{2})\s*[〜~\-－]\s*(\d{1,2}:\d{2})/)
    if (match?.[1] && match[2]) {
      return {
        // padStartで1桁の時刻を2桁に補完（例: "9:00" → "09:00"）
        open: match[1].padStart(5, '0'),
        close: match[2].padStart(5, '0'),
      }
    }
    // パース失敗時のデフォルト値（9:00〜17:00）
    return { open: '09:00', close: '17:00' }
  }

  /**
   * 現在の値から開店・閉店時刻を抽出
   */
  const { open, close } = parseBusinessHours(value)

  /**
   * 開店時刻の状態
   * 時計モードで使用
   */
  const [openTime, setOpenTime] = useState(open)

  /**
   * 閉店時刻の状態
   * 時計モードで使用
   */
  const [closeTime, setCloseTime] = useState(close)

  /**
   * カスタムテキスト入力モードのフラグ
   * false: 時計モード、true: テキストモード
   */
  const [useCustom, setUseCustom] = useState(false)

  /**
   * カスタムテキスト入力モードの値
   * テキストモードで使用
   */
  const [customText, setCustomText] = useState(value)

  /**
   * 開店時刻変更ハンドラ
   *
   * アナログ時計で開店時刻を変更した際に呼び出される。
   * 新しい値を親コンポーネントに通知する。
   *
   * @param newOpen - 新しい開店時刻（例: "09:00"）
   */
  const handleOpenChange = (newOpen: string) => {
    setOpenTime(newOpen)
    onChange(`${newOpen}〜${closeTime}`)
  }

  /**
   * 閉店時刻変更ハンドラ
   *
   * アナログ時計で閉店時刻を変更した際に呼び出される。
   * 新しい値を親コンポーネントに通知する。
   *
   * @param newClose - 新しい閉店時刻（例: "17:00"）
   */
  const handleCloseChange = (newClose: string) => {
    setCloseTime(newClose)
    onChange(`${openTime}〜${newClose}`)
  }

  /**
   * カスタムテキスト変更ハンドラ
   *
   * テキストモードでテキストが変更された際に呼び出される。
   * 新しい値を親コンポーネントに通知する。
   *
   * @param text - 新しいテキスト
   */
  const handleCustomChange = (text: string) => {
    setCustomText(text)
    onChange(text)
  }

  /**
   * 入力モード切り替えハンドラ
   *
   * 時計モード⇄テキストモードを切り替える。
   * 切り替え時に値を適切に変換して親に通知する。
   */
  const toggleMode = () => {
    if (useCustom) {
      // テキストモード → 時計モードへの切り替え
      // 時計モードの値（HH:MM〜HH:MM形式）を設定
      onChange(`${openTime}〜${closeTime}`)
    } else {
      // 時計モード → テキストモードへの切り替え
      // 現在の値またはデフォルト値をセット
      setCustomText(value || `${openTime}〜${closeTime}`)
    }
    setUseCustom(!useCustom)
  }

  return (
    <div className="space-y-3">
      {/* ヘッダー: ラベルとモード切り替えボタン */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">営業時間</label>
        <button
          type="button"
          onClick={toggleMode}
          disabled={disabled}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          {/* モードに応じてボタンテキストを切り替え */}
          {useCustom ? '時計で入力' : 'テキストで入力'}
        </button>
      </div>

      {useCustom ? (
        // テキスト入力モード
        // 自由形式のテキストで営業時間を入力（不規則な時間帯に対応）
        <input
          type="text"
          value={customText}
          onChange={(e) => handleCustomChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
          placeholder="例: 9:00〜17:00（季節により変動）"
        />
      ) : (
        // 時計入力モード
        // アナログ時計UIで開店・閉店時刻を視覚的に入力
        <div className="flex items-center gap-3">
          {/* 開店時刻の時計ピッカー */}
          <div className="flex-1">
            <AnalogClockPicker
              value={openTime}
              onChange={handleOpenChange}
              label="開店"
              disabled={disabled}
            />
          </div>

          {/* 区切り文字（〜） */}
          <span className="text-lg text-muted-foreground mt-6">〜</span>

          {/* 閉店時刻の時計ピッカー */}
          <div className="flex-1">
            <AnalogClockPicker
              value={closeTime}
              onChange={handleCloseChange}
              label="閉店"
              disabled={disabled}
            />
          </div>
        </div>
      )}

      {/* プレビュー表示（時計モードのみ） */}
      {!useCustom && (
        <p className="text-sm text-muted-foreground">
          設定: {openTime}〜{closeTime}
        </p>
      )}

      {/* よく使う時間帯のプリセットボタン（時計モード、無効化されていない場合のみ表示） */}
      {!useCustom && !disabled && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">よく使う時間:</span>
          {/* プリセット一覧 */}
          {[
            { label: '9:00〜17:00', open: '09:00', close: '17:00' },
            { label: '10:00〜18:00', open: '10:00', close: '18:00' },
            { label: '9:00〜16:00', open: '09:00', close: '16:00' },
            { label: '8:00〜17:00', open: '08:00', close: '17:00' },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                // プリセットボタンクリック時の処理
                // 開店・閉店時刻をプリセット値に設定し、親に通知
                setOpenTime(preset.open)
                setCloseTime(preset.close)
                onChange(`${preset.open}〜${preset.close}`)
              }}
              className="px-2 py-1 text-xs rounded border hover:bg-muted transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
