'use client'

import { useEffect } from 'react'

/**
 * 墨滴リップルエフェクトの初期化
 *
 * .btn-washi ボタンのクリック時にクリック位置から
 * 墨が滲むような波紋が広がるマイクロインタラクション。
 * グローバルイベントデリゲーションで全btn-washiに適用。
 */
export function InkRippleInit() {
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return
      const target = e.target.closest('.btn-washi')
      if (!target) return

      const rect = target.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const ripple = document.createElement('span')
      ripple.className = 'ink-ripple'
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`
      target.appendChild(ripple)

      ripple.addEventListener('animationend', () => ripple.remove())
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return null
}
