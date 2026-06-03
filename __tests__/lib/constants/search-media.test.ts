// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { SEARCH_MEDIA_TYPES, isSearchMediaType } from '@/lib/constants/search-media'

describe('SEARCH_MEDIA_TYPES', () => {
  it('images / videos / text の 3 種を持つ', () => {
    expect(SEARCH_MEDIA_TYPES).toEqual(['images', 'videos', 'text'])
  })

  it('readonly tuple として const アサートされている', () => {
    expect(Object.isFrozen(SEARCH_MEDIA_TYPES)).toBe(false)
    // 値そのものは固定。実行時凍結ではなく TS 型レベルの保証なので、
    // ここでは中身が想定どおりであることを検証する。
    expect([...SEARCH_MEDIA_TYPES].sort()).toEqual(['images', 'text', 'videos'])
  })
})

describe('isSearchMediaType', () => {
  it('undefined は false', () => {
    expect(isSearchMediaType(undefined)).toBe(false)
  })

  it('空文字は false', () => {
    expect(isSearchMediaType('')).toBe(false)
  })

  it('規定値 images / videos / text は true', () => {
    expect(isSearchMediaType('images')).toBe(true)
    expect(isSearchMediaType('videos')).toBe(true)
    expect(isSearchMediaType('text')).toBe(true)
  })

  it('規定外の文字列は false', () => {
    expect(isSearchMediaType('image')).toBe(false) // single
    expect(isSearchMediaType('video')).toBe(false)
    expect(isSearchMediaType('audio')).toBe(false)
    expect(isSearchMediaType('IMAGES')).toBe(false) // 大文字
  })
})
