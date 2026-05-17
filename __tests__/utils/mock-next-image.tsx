/**
 * @module __tests__/utils/mock-next-image
 *
 * テストで `next/image` を `<img>` に差し替えるとき、Next.js 固有の props
 * (`fill`, `priority`, `unoptimized`, `quality`, `placeholder`, `blurDataURL`,
 * `loader`, `loading`) をそのまま DOM に渡すと React が
 *   `Received true for a non-boolean attribute fill`
 * のような警告を出すため、これらを除去して残りを `<img>` に流すヘルパー。
 *
 * 使用例:
 *   vi.mock('next/image', () => ({
 *     __esModule: true,
 *     default: MockNextImage,
 *   }))
 */

import React from 'react'

type AnyProps = Record<string, unknown>

const NEXT_IMAGE_ONLY_PROPS = [
  'fill',
  'priority',
  'unoptimized',
  'quality',
  'placeholder',
  'blurDataURL',
  'loader',
  'loading',
  'fetchPriority',
] as const

/** Next.js Image の React コンポーネント interface に従いつつ DOM 警告を出さない `<img>` 代替。 */
export function MockNextImage(props: AnyProps) {
  const cleaned: AnyProps = {}
  for (const [k, v] of Object.entries(props)) {
    if ((NEXT_IMAGE_ONLY_PROPS as readonly string[]).includes(k)) continue
    cleaned[k] = v
  }
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...cleaned} />
}
