'use client'

interface NinjaAdProps {
  /** 忍者AdMaxの広告枠ID */
  adId?: string
  /** 広告の幅 */
  width?: number
  /** 広告の高さ */
  height?: number
  /** 追加のCSSクラス */
  className?: string
}

/**
 * 忍者AdMax広告コンポーネント
 *
 * 忍者AdMaxは多数の第三者ドメインとunsafe-evalを必要とするため、
 * 専用APIルート(/api/ad-frame)経由でiframeに読み込む。
 * APIルートは独自の緩和CSPを返すため、親ページのCSPに影響されない。
 */
export function NinjaAd({ adId, width = 300, height = 250, className = '' }: NinjaAdProps) {
  if (!adId) {
    return (
      <div
        className={`bg-muted/50 border border-dashed border-border rounded-lg flex items-center justify-center ${className}`}
        style={{
          width: `${width}px`,
          minHeight: `${height}px`,
          maxWidth: '100%',
        }}
      >
        <div className="text-center text-muted-foreground p-4">
          <p className="text-xs">広告スペース</p>
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={`/api/ad-frame?id=${adId}`}
      className={className}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        maxWidth: '100%',
        border: 'none',
        overflow: 'hidden',
      }}
      title="広告"
      scrolling="no"
    />
  )
}

/**
 * 忍者AdMax フィード内広告
 */
export function NinjaInFeedAd({
  adId,
  className = '',
}: {
  adId?: string
  className?: string
}) {
  return (
    <div className={`py-4 ${className}`}>
      <NinjaAd adId={adId} width={300} height={250} className="mx-auto" />
    </div>
  )
}

/**
 * 忍者AdMax サイドバー広告
 */
export function NinjaSidebarAd({
  adId,
  className = '',
}: {
  adId?: string
  className?: string
}) {
  return (
    <div className={className}>
      <NinjaAd adId={adId} width={300} height={250} className="mx-auto" />
    </div>
  )
}
