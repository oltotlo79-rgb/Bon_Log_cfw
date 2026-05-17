import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

import { IngredientSearchForm } from '@/app/(main)/pesticides/ingredients/IngredientSearchForm'

describe('IngredientSearchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('検索ボタンが表示される', () => {
    render(<IngredientSearchForm />)
    expect(screen.getByRole('button', { name: '検索' })).toBeInTheDocument()
  })

  it('検索入力フィールドが表示される', () => {
    render(<IngredientSearchForm />)
    expect(screen.getByPlaceholderText('原体名・FRAC/IRACコードで検索...')).toBeInTheDocument()
  })

  it('defaultSearchが入力フィールドに反映される', () => {
    render(<IngredientSearchForm defaultSearch="テスト検索" />)
    const input = screen.getByPlaceholderText('原体名・FRAC/IRACコードで検索...') as HTMLInputElement
    expect(input.value).toBe('テスト検索')
  })

  it('defaultSearchが未指定の場合は空文字', () => {
    render(<IngredientSearchForm />)
    const input = screen.getByPlaceholderText('原体名・FRAC/IRACコードで検索...') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('入力値を変更できる', () => {
    render(<IngredientSearchForm />)
    const input = screen.getByPlaceholderText('原体名・FRAC/IRACコードで検索...')
    fireEvent.change(input, { target: { value: 'FRAC' } })
    expect((input as HTMLInputElement).value).toBe('FRAC')
  })

  it('フォーム送信時にrouter.pushが呼ばれる（検索語あり）', () => {
    render(<IngredientSearchForm defaultSearch="チオファネート" />)
    const form = screen.getByRole('button', { name: '検索' }).closest('form')!
    fireEvent.submit(form)
    expect(mockPush).toHaveBeenCalledWith('/pesticides/ingredients?search=%E3%83%81%E3%82%AA%E3%83%95%E3%82%A1%E3%83%8D%E3%83%BC%E3%83%88')
  })

  it('フォーム送信時に空白のみの場合はsearchパラメータなし', () => {
    render(<IngredientSearchForm defaultSearch="   " />)
    const form = screen.getByRole('button', { name: '検索' }).closest('form')!
    fireEvent.submit(form)
    expect(mockPush).toHaveBeenCalledWith('/pesticides/ingredients?')
  })

  it('フォーム送信時に空文字の場合はsearchパラメータなし', () => {
    render(<IngredientSearchForm />)
    const form = screen.getByRole('button', { name: '検索' }).closest('form')!
    fireEvent.submit(form)
    expect(mockPush).toHaveBeenCalledWith('/pesticides/ingredients?')
  })
})
