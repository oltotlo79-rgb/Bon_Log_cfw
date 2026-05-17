/**
 * `getExtension` の MIME → 拡張子マッピング検証。
 *
 * Why: `/api/upload` が image + video を受け付けるのに対し、旧実装は image MIME しか
 * マップを持たず、video が `.jpg` で保存される回帰があった。video MIME を含めて
 * 正しい拡張子が返ることをガードする。
 */

import { describe, it, expect } from 'vitest'
import { getExtension } from '@/lib/storage/helpers'

describe('getExtension (image)', () => {
  it.each([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
    ['image/gif', '.gif'],
  ])('%s → %s', (mime, ext) => {
    expect(getExtension(mime)).toBe(ext)
  })
})

describe('getExtension (video)', () => {
  it.each([
    ['video/mp4', '.mp4'],
    ['video/webm', '.webm'],
    ['video/quicktime', '.mov'],
  ])('%s → %s (video が .jpg として保存される回帰を防ぐ)', (mime, ext) => {
    expect(getExtension(mime)).toBe(ext)
  })
})

describe('getExtension (fallback)', () => {
  it('未知 MIME は .jpg にフォールバックする', () => {
    expect(getExtension('application/octet-stream')).toBe('.jpg')
    expect(getExtension('')).toBe('.jpg')
  })
})
