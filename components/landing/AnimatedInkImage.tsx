'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import {
  LANDING_FRAME_CROSSFADE_EASING,
  LANDING_FRAME_CROSSFADE_MS,
  type LandingFrameSet,
} from '@/lib/constants/landing-animation'
import { useIsClient } from '@/hooks/use-is-client'

type AnimatedInkImageProps = {
  frames: LandingFrameSet
  alt: string
  fill?: boolean
  sizes?: string
  priority?: boolean
  frameDurationMs?: number
  /** 1 フレームの fade-in にかける時間。default は LANDING_FRAME_CROSSFADE_MS。 */
  crossfadeMs?: number
  loop?: boolean
  /**
   * loop=true 時、最終フレームに到達した後この時間 (ms) だけ最終フレームで静止してから
   * 先頭 (frame 0) に戻る。default は frameDurationMs (即時 restart、従来動作)。
   */
  loopPauseMs?: number
  lazyStart?: boolean
  width?: number
  height?: number
  className?: string
  imageClassName?: string
}

const MOBILE_MEDIA_QUERY = '(max-width: 767px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

// useSyncExternalStore で MediaQuery を購読 (cascading render を避けつつ React 19 idiomatic)。
function subscribeMediaQuery(query: string) {
  return (onStoreChange: () => void) => {
    if (typeof window === 'undefined') return () => {}
    const mq = window.matchMedia(query)
    mq.addEventListener('change', onStoreChange)
    return () => mq.removeEventListener('change', onStoreChange)
  }
}

function getMediaQuerySnapshot(query: string) {
  if (typeof window === 'undefined') return false
  return window.matchMedia(query).matches
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribeMediaQuery(query),
    () => getMediaQuerySnapshot(query),
    () => false
  )
}

function subscribeDarkClass(onStoreChange: () => void) {
  if (typeof document === 'undefined') return () => {}
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

function getDarkClassSnapshot() {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

function useDarkClass(): boolean {
  return useSyncExternalStore(
    subscribeDarkClass,
    getDarkClassSnapshot,
    () => false
  )
}

function selectFrames(
  frames: LandingFrameSet,
  isDark: boolean,
  isMobile: boolean
): readonly string[] {
  if (isDark && isMobile && frames.darkMobile) return frames.darkMobile
  if (isDark && frames.darkDesktop) return frames.darkDesktop
  if (isMobile && frames.lightMobile) return frames.lightMobile
  return frames.lightDesktop
}

/**
 * 連番 WebP をクロスフェードで連続再生し擬似動画を作るランディング専用 Image。
 *
 * - theme (`.dark` クラス) と viewport (max-width: 767px) を実行時に判定し
 *   該当する frame 配列のみを描画する (帯域節約)。
 * - `lazyStart` (default true) の場合 IntersectionObserver で初めて見えた時に再生開始。
 * - `prefers-reduced-motion: reduce` の場合は最終フレームを表示しアニメ停止。
 * - SSR では何も描画しない。クライアントでマウントしてから差し替える。
 */
export function AnimatedInkImage({
  frames,
  alt,
  fill = false,
  sizes,
  priority = false,
  frameDurationMs = 600,
  crossfadeMs = LANDING_FRAME_CROSSFADE_MS,
  loop = false,
  loopPauseMs,
  lazyStart = true,
  width,
  height,
  className,
  imageClassName,
}: AnimatedInkImageProps) {
  // loopPauseMs 未指定時は frameDurationMs (即時 restart、従来動作と等価)。
  const effectiveLoopPauseMs = loopPauseMs ?? frameDurationMs
  const containerRef = useRef<HTMLDivElement>(null)
  const mounted = useIsClient()
  const isDark = useDarkClass()
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY)
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)
  const [isInView, setIsInView] = useState(!lazyStart)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!lazyStart) return
    const node = containerRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '120px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [lazyStart])

  const activeFrames = selectFrames(frames, isDark, isMobile)

  useEffect(() => {
    if (!mounted) return
    if (reducedMotion) return
    if (!isInView) return

    // chained setTimeout で次フレームをスケジュールする。
    // 最終フレームに到達したら loop=true なら effectiveLoopPauseMs 待機してから
    // 先頭に戻る。loop=false なら停止。setInterval だと「最終フレーム到達時に
    // 余韻を持たせる」ような可変 delay を表現できないため setTimeout chain で実装。
    let timeoutId: number | undefined
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      setActiveIndex((prev) => {
        if (prev < activeFrames.length - 1) {
          timeoutId = window.setTimeout(tick, frameDurationMs)
          return prev + 1
        }
        if (loop) {
          // 最終フレームに留まり、loopPauseMs 後に先頭に戻す。
          timeoutId = window.setTimeout(() => {
            if (cancelled) return
            setActiveIndex(0)
            timeoutId = window.setTimeout(tick, frameDurationMs)
          }, effectiveLoopPauseMs)
        }
        return prev
      })
    }

    timeoutId = window.setTimeout(tick, frameDurationMs)

    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [
    mounted,
    isInView,
    reducedMotion,
    activeFrames.length,
    frameDurationMs,
    effectiveLoopPauseMs,
    loop,
  ])

  // 内部の <Image fill> は親要素に position と寸法を要求するため、
  // fill=false の場合は wrapper に明示的に position:relative + 幅高さを与える。
  const wrapperStyle: React.CSSProperties | undefined = fill
    ? undefined
    : { position: 'relative', width, height }

  if (!mounted) {
    // hydration mismatch を避けるため SSR では空のプレースホルダ。
    // 親セクションが背景色を持つので視覚的に問題なし。
    return (
      <div
        ref={containerRef}
        className={className}
        style={wrapperStyle}
        aria-hidden="true"
      />
    )
  }

  // reduced motion 時は最終フレームを表示し、アニメは止める。
  // バリアントが変わった場合に activeIndex が範囲外になることがあるので Math.min でクランプ。
  const displayedIndex = reducedMotion
    ? activeFrames.length - 1
    : Math.min(activeIndex, activeFrames.length - 1)

  return (
    <div ref={containerRef} className={className} style={wrapperStyle}>
      {activeFrames.map((src, i) => {
        // cumulative opacity: 一度活性化したフレームは fade-out させず opacity 1 を保つ。
        // 新フレームは上に乗って fade-in するため、washout の瞬間がなく "ふわっと" 滲み出る。
        const isVisible = i <= displayedIndex
        const isLast = i === activeFrames.length - 1
        return (
          <Image
            key={`${src}-${i}`}
            src={src}
            alt={isLast ? alt : ''}
            fill
            sizes={sizes}
            priority={i === 0 && priority}
            className={imageClassName ?? 'object-cover'}
            style={{
              opacity: isVisible ? 1 : 0,
              transition: `opacity ${crossfadeMs}ms ${LANDING_FRAME_CROSSFADE_EASING}`,
            }}
          />
        )
      })}
    </div>
  )
}
