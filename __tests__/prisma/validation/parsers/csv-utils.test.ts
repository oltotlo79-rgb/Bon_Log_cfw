// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { toCsv, dedup, parseCsv } from '@/prisma/validation/parsers/csv-utils'

describe('csv-utils', () => {
  describe('toCsv', () => {
    it('ヘッダーとデータ行をCSV文字列に変換する', () => {
      const result = toCsv(['name', 'slug'], [{ name: 'テスト', slug: 'test' }])
      expect(result).toContain('name,slug')
      expect(result).toContain('テスト,test')
    })

    it('BOM付きで出力される', () => {
      const result = toCsv(['a'], [{ a: '1' }])
      expect(result.charCodeAt(0)).toBe(0xfeff)
    })

    it('カンマを含む値はダブルクォートで囲む', () => {
      const result = toCsv(['desc'], [{ desc: 'a,b' }])
      expect(result).toContain('"a,b"')
    })

    it('ダブルクォートを含む値はエスケープする', () => {
      const result = toCsv(['desc'], [{ desc: 'say "hello"' }])
      expect(result).toContain('"say ""hello"""')
    })

    it('空配列の場合ヘッダーのみ出力する', () => {
      const result = toCsv(['a', 'b'], [])
      const lines = result.replace(/^\uFEFF/, '').trim().split('\n')
      expect(lines).toHaveLength(1)
      expect(lines[0]).toBe('a,b')
    })

    it('存在しないキーは空文字になる', () => {
      const result = toCsv(['a', 'b'], [{ a: 'x' }])
      expect(result).toContain('x,')
    })
  })

  describe('dedup', () => {
    it('単一キーで重複を除去する', () => {
      const rows = [
        { slug: 'a', name: '1' },
        { slug: 'b', name: '2' },
        { slug: 'a', name: '3' },
      ]
      const result = dedup(rows, 'slug')
      expect(result).toHaveLength(2)
      expect(result[0]!.name).toBe('1')
    })

    it('複合キー（カンマ区切り）で重複を除去する', () => {
      const rows = [
        { slug1: 'a', slug2: 'b' },
        { slug1: 'b', slug2: 'a' },
        { slug1: 'a', slug2: 'b' },
      ]
      const result = dedup(rows, 'slug1,slug2')
      expect(result).toHaveLength(2)
    })

    it('空配列を返す', () => {
      expect(dedup([], 'slug')).toEqual([])
    })

    it('重複がない場合は全件返す', () => {
      const rows = [{ slug: 'a' }, { slug: 'b' }, { slug: 'c' }]
      expect(dedup(rows, 'slug')).toHaveLength(3)
    })
  })

  describe('parseCsv', () => {
    it('BOM付きCSVをパースする', () => {
      const csv = '\uFEFFname,slug\nテスト,test\n'
      const result = parseCsv(csv)
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe('テスト')
      expect(result[0]!.slug).toBe('test')
    })

    it('BOMなしCSVもパースする', () => {
      const csv = 'a,b\n1,2\n3,4\n'
      const result = parseCsv(csv)
      expect(result).toHaveLength(2)
      expect(result[0]!.a).toBe('1')
      expect(result[1]!.b).toBe('4')
    })

    it('ヘッダーのみの場合は空配列を返す', () => {
      expect(parseCsv('name,slug\n')).toEqual([])
    })

    it('空文字列の場合は空配列を返す', () => {
      expect(parseCsv('')).toEqual([])
    })
  })
})
