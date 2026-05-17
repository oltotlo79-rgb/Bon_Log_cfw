/**
 * シェアボタンコンポーネント
 *
 * @module components/post/ShareButtons
 */

'use client'

/**
 * React useState Hook
 * URLコピー完了状態の管理に使用
 */
import { useState } from 'react'
import { TIMEOUT_COPIED_FEEDBACK, SHARE_WINDOW_WIDTH, SHARE_WINDOW_HEIGHT } from '@/lib/constants/limits'

/**
 * shadcn/uiのButtonコンポーネント
 * 各SNSボタンのスタイリングに使用
 */
import { Button } from '@/components/ui/button'

/**
 * ShareButtonsコンポーネントのProps型
 *
 * @property url - シェア対象のURL
 * @property title - シェア時のタイトル（OGPタイトルなど）
 * @property text - シェア時のテキスト（省略時はtitleを使用）
 */
type ShareButtonsProps = {
  url: string
  title: string
  text?: string
}

/**
 * X（旧Twitter）アイコン
 *
 * @param className - 追加のCSSクラス
 */
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/**
 * Facebookアイコン
 *
 * @param className - 追加のCSSクラス
 */
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

/**
 * LINEアイコン
 *
 * @param className - 追加のCSSクラス
 */
function LineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  )
}

/**
 * リンクアイコン
 * URLコピーボタンに使用
 *
 * @param className - 追加のCSSクラス
 */
function LinkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

/**
 * チェックアイコン
 * URLコピー完了時に表示
 *
 * @param className - 追加のCSSクラス
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/**
 * シェアボタンコンポーネント
 *
 * ## 機能
 * - X、Facebook、LINEへのシェアボタン
 * - URLコピーボタン（コピー完了フィードバック付き）
 *
 * ## シェア方式
 * 各SNSのシェアURLを新しいウィンドウで開く。
 * window.openを使用し、適切なサイズのウィンドウを開く。
 *
 * ## URLコピー
 * Clipboard APIを使用（navigator.clipboard.writeText）。
 * 古いブラウザ向けにtextareaを使ったフォールバックも実装。
 *
 * @param url - シェア対象のURL
 * @param title - シェア時のタイトル
 * @param text - シェア時のテキスト（省略可）
 *
 * @example
 * ```tsx
 * <ShareButtons
 *   url="https://example.com/posts/123"
 *   title="素敵な盆栽の投稿"
 *   text="この盆栽、とても綺麗ですね！"
 * />
 * ```
 */
export function ShareButtons({ url, title, text }: ShareButtonsProps) {

  /**
   * URLコピー完了状態
   * trueの場合、チェックアイコンと「コピー済」を表示
   */
  const [copied, setCopied] = useState(false)

  /**
   * シェア用テキスト
   * textが指定されていない場合はtitleを使用
   */
  const shareText = text || title

  /**
   * URLエンコード済みのURL
   * シェアURLのパラメータとして使用
   */
  const encodedUrl = encodeURIComponent(url)

  /**
   * URLエンコード済みのテキスト
   * シェアURLのパラメータとして使用
   */
  const encodedText = encodeURIComponent(shareText)

  /**
   * 各SNSのシェアURL
   *
   * - x: X（旧Twitter）のツイート投稿画面
   * - facebook: Facebookのシェアダイアログ
   * - line: LINEのシェア画面
   */
  const shareLinks = {
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    line: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
  }

  /**
   * URLコピーハンドラ
   *
   * ## 処理フロー
   * 1. Clipboard APIでURLをコピー
   * 2. 成功時: copiedをtrueにして2秒後にfalseに戻す
   * 3. 失敗時: フォールバック（textarea使用）でコピー
   */
  const handleCopyLink = async () => {
    try {
      /**
       * Clipboard APIを使用してURLをコピー
       * 新しいブラウザで利用可能
       */
      await navigator.clipboard.writeText(url)
      setCopied(true)
      /**
       * 2秒後にコピー完了表示を解除
       */
      setTimeout(() => setCopied(false), TIMEOUT_COPIED_FEEDBACK)
    } catch {
      /**
       * フォールバック: 古いブラウザ向け
       *
       * 1. 非表示のtextareaを作成
       * 2. URLを設定して選択
       * 3. document.execCommand('copy')でコピー
       * 4. textareaを削除
       */
      const textArea = document.createElement('textarea')
      textArea.value = url
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), TIMEOUT_COPIED_FEEDBACK)
    }
  }

  /**
   * シェアウィンドウを開くハンドラ
   *
   * 指定されたURLを新しいウィンドウで開く。
   * ウィンドウサイズは600x400に設定。
   *
   * @param shareUrl - 開くシェアURL
   */
  const openShareWindow = (shareUrl: string) => {
    window.open(shareUrl, '_blank', `width=${SHARE_WINDOW_WIDTH},height=${SHARE_WINDOW_HEIGHT},noopener,noreferrer`)
  }

  return (
    <div className="flex items-center gap-2">
      {/* シェアラベル */}
      <span className="text-sm text-muted-foreground mr-1">シェア:</span>

      {/* X（旧Twitter）シェアボタン */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => openShareWindow(shareLinks.x)}
        aria-label="X(Twitter)でシェア"
      >
        <XIcon className="h-4 w-4" aria-hidden="true" />
      </Button>

      {/* Facebookシェアボタン */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => openShareWindow(shareLinks.facebook)}
        aria-label="Facebookでシェア"
      >
        <FacebookIcon className="h-4 w-4" aria-hidden="true" />
      </Button>

      {/* LINEシェアボタン */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={() => openShareWindow(shareLinks.line)}
        aria-label="LINEでシェア"
      >
        <LineIcon className="h-4 w-4" aria-hidden="true" />
      </Button>

      {/* URLコピーボタン */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 px-2 gap-1"
        onClick={handleCopyLink}
        aria-label={copied ? 'リンクをコピーしました' : 'リンクをコピー'}
      >
        {copied ? (
          /* コピー完了時の表示 */
          <>
            <CheckIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs">コピー済</span>
          </>
        ) : (
          /* 通常時の表示 */
          <>
            <LinkIcon className="h-4 w-4" aria-hidden="true" />
            <span className="text-xs">リンク</span>
          </>
        )}
      </Button>
    </div>
  )
}
