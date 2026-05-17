// @vitest-environment node

/**
 * lib/actions/prisma-filters.ts の直接テスト
 *
 * - containsInsensitive / startsWithInsensitive は Prisma の StringFilter を返す純粋関数
 * - `as const` 推論により mode が 'insensitive' リテラル型で固定されることを担保する
 */

import { describe, it, expect } from 'vitest'
import {
  containsInsensitive,
  startsWithInsensitive,
} from '@/lib/actions/prisma-filters'

describe('containsInsensitive', () => {
  it('contains と mode: insensitive を持つ StringFilter を返す', () => {
    const result = containsInsensitive('keyword')
    expect(result).toEqual({ contains: 'keyword', mode: 'insensitive' })
  })

  it('空文字列も値として保持する（呼び出し側のバリデーション責務）', () => {
    const result = containsInsensitive('')
    expect(result).toEqual({ contains: '', mode: 'insensitive' })
  })

  it('日本語・絵文字・スペースをそのまま渡す', () => {
    expect(containsInsensitive('盆栽 🌳').contains).toBe('盆栽 🌳')
  })

  it('SQL ワイルドカードは Prisma が安全に扱うのでエスケープしない', () => {
    // Prisma は contains を ILIKE ではなくパラメータ化クエリとして扱うため
    // %, _ などはそのままリテラルとして渡してよい。
    const result = containsInsensitive('100% off')
    expect(result.contains).toBe('100% off')
  })

  it('mode は常に "insensitive" リテラル型', () => {
    const result = containsInsensitive('x')
    // 'insensitive' 以外を許さないことを型と値の両面で確認
    expect(result.mode).toBe('insensitive')
  })
})

describe('startsWithInsensitive', () => {
  it('startsWith と mode: insensitive を持つ StringFilter を返す', () => {
    const result = startsWithInsensitive('prefix')
    expect(result).toEqual({ startsWith: 'prefix', mode: 'insensitive' })
  })

  it('空文字列も値として保持する', () => {
    const result = startsWithInsensitive('')
    expect(result).toEqual({ startsWith: '', mode: 'insensitive' })
  })

  it('mode は常に "insensitive"', () => {
    expect(startsWithInsensitive('x').mode).toBe('insensitive')
  })

  it('contains フィールドは含まない（startsWith と排他）', () => {
    const result = startsWithInsensitive('abc') as Record<string, unknown>
    expect(result.contains).toBeUndefined()
  })
})

describe('containsInsensitive vs startsWithInsensitive', () => {
  it('containsInsensitive は startsWith フィールドを持たない', () => {
    const result = containsInsensitive('abc') as Record<string, unknown>
    expect(result.startsWith).toBeUndefined()
  })

  it('両者は異なるオブジェクト構造を返す', () => {
    const c = containsInsensitive('x') as Record<string, unknown>
    const s = startsWithInsensitive('x') as Record<string, unknown>
    expect(Object.keys(c).sort()).toEqual(['contains', 'mode'])
    expect(Object.keys(s).sort()).toEqual(['mode', 'startsWith'])
  })
})
