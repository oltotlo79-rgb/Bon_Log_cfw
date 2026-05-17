// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { getFormString, getFormStringArray } from '@/lib/utils/form-data'

describe('getFormString', () => {
  it('文字列値はそのまま返す', () => {
    const fd = new FormData()
    fd.set('key', 'hello')
    expect(getFormString(fd, 'key')).toBe('hello')
  })

  it('空文字列もそのまま返す', () => {
    const fd = new FormData()
    fd.set('key', '')
    expect(getFormString(fd, 'key')).toBe('')
  })

  it('キーが存在しない場合は null', () => {
    const fd = new FormData()
    expect(getFormString(fd, 'missing')).toBeNull()
  })

  it('File 値は null を返す（型ガード）', () => {
    const fd = new FormData()
    const file = new File(['data'], 'a.txt', { type: 'text/plain' })
    fd.set('upload', file)
    expect(getFormString(fd, 'upload')).toBeNull()
  })

  it('同一キーの複数値のうち最初の値を返す（File の場合は null）', () => {
    const fd = new FormData()
    fd.append('mix', new File(['x'], 'x.txt'))
    fd.append('mix', 'string-value')
    // FormData.get() returns the first appended value
    expect(getFormString(fd, 'mix')).toBeNull()
  })
})

describe('getFormStringArray', () => {
  it('文字列値のみを抽出する', () => {
    const fd = new FormData()
    fd.append('tags', 'a')
    fd.append('tags', 'b')
    fd.append('tags', 'c')
    expect(getFormStringArray(fd, 'tags')).toEqual(['a', 'b', 'c'])
  })

  it('File エントリは除外される', () => {
    const fd = new FormData()
    fd.append('mix', 'first')
    fd.append('mix', new File(['data'], 'a.txt'))
    fd.append('mix', 'second')
    expect(getFormStringArray(fd, 'mix')).toEqual(['first', 'second'])
  })

  it('キーが存在しない場合は空配列', () => {
    const fd = new FormData()
    expect(getFormStringArray(fd, 'missing')).toEqual([])
  })

  it('全て File なら空配列', () => {
    const fd = new FormData()
    fd.append('files', new File(['a'], 'a.txt'))
    fd.append('files', new File(['b'], 'b.txt'))
    expect(getFormStringArray(fd, 'files')).toEqual([])
  })

  it('空文字列も含める', () => {
    const fd = new FormData()
    fd.append('tags', '')
    fd.append('tags', 'x')
    expect(getFormStringArray(fd, 'tags')).toEqual(['', 'x'])
  })
})
