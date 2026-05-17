import { describe, it, expect } from 'vitest'
import { isJsonObject, toJsonObject, parseJsonObject } from '@/lib/utils/json'

describe('isJsonObject', () => {
  it('plain オブジェクトは true', () => {
    expect(isJsonObject({})).toBe(true)
    expect(isJsonObject({ a: 1 })).toBe(true)
  })

  it('null / 配列 / プリミティブは false', () => {
    expect(isJsonObject(null)).toBe(false)
    expect(isJsonObject([])).toBe(false)
    expect(isJsonObject([1, 2])).toBe(false)
    expect(isJsonObject('str')).toBe(false)
    expect(isJsonObject(42)).toBe(false)
    expect(isJsonObject(undefined)).toBe(false)
  })
})

describe('toJsonObject', () => {
  it('plain オブジェクトはそのまま返す', () => {
    const obj = { a: 1 }
    expect(toJsonObject(obj)).toBe(obj)
  })

  it('null / 配列 / プリミティブは null を返す', () => {
    expect(toJsonObject(null)).toBeNull()
    expect(toJsonObject([])).toBeNull()
    expect(toJsonObject('str')).toBeNull()
  })
})

describe('parseJsonObject', () => {
  it('plain オブジェクトはそのまま返す', () => {
    const obj = { a: 1 }
    expect(parseJsonObject(obj)).toBe(obj)
  })

  it('JSON 文字列はパースして返す', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 })
  })

  it('不正な JSON 文字列は fallback を返す', () => {
    expect(parseJsonObject('{invalid')).toEqual({})
    expect(parseJsonObject('{invalid', { fallback: true })).toEqual({ fallback: true })
  })

  it('JSON 文字列の結果がオブジェクトでない場合は fallback', () => {
    expect(parseJsonObject('[1,2]')).toEqual({})
    expect(parseJsonObject('"plain"')).toEqual({})
    expect(parseJsonObject('42')).toEqual({})
  })

  it('null / undefined は fallback', () => {
    expect(parseJsonObject(null)).toEqual({})
    expect(parseJsonObject(undefined)).toEqual({})
  })
})
