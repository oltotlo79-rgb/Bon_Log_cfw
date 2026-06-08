import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelpFaqSearch } from '@/components/help/HelpFaqSearch'

const sections = [
  {
    title: 'はじめに',
    items: [
      { question: 'BON-LOGとは何ですか？', answer: '盆栽愛好家のためのSNSです。' },
      { question: 'ログインできない場合は？', answer: 'パスワードをリセットしてください。' },
    ],
  },
  {
    title: '投稿について',
    items: [{ question: '文字数制限は？', answer: '無料会員は500文字までです。' }],
  },
]

const SEARCH_LABEL = 'ヘルプ内をキーワードで検索'

describe('HelpFaqSearch', () => {
  it('クエリが空のときは全ての質問を表示する', () => {
    render(<HelpFaqSearch sections={sections} />)
    expect(screen.getByText('BON-LOGとは何ですか？')).toBeInTheDocument()
    expect(screen.getByText('ログインできない場合は？')).toBeInTheDocument()
    expect(screen.getByText('文字数制限は？')).toBeInTheDocument()
  })

  it('質問文のキーワードで絞り込み、一致しないセクションは非表示にする', async () => {
    const user = userEvent.setup()
    render(<HelpFaqSearch sections={sections} />)
    await user.type(screen.getByLabelText(SEARCH_LABEL), 'ログイン')
    expect(screen.getByText('ログインできない場合は？')).toBeInTheDocument()
    expect(screen.queryByText('BON-LOGとは何ですか？')).not.toBeInTheDocument()
    expect(screen.queryByText('文字数制限は？')).not.toBeInTheDocument()
    expect(screen.queryByText('投稿について')).not.toBeInTheDocument()
  })

  it('回答文のキーワードでも絞り込む', async () => {
    const user = userEvent.setup()
    render(<HelpFaqSearch sections={sections} />)
    await user.type(screen.getByLabelText(SEARCH_LABEL), 'パスワード')
    expect(screen.getByText('ログインできない場合は？')).toBeInTheDocument()
    expect(screen.queryByText('文字数制限は？')).not.toBeInTheDocument()
  })

  it('大文字小文字を区別せず絞り込む', async () => {
    const user = userEvent.setup()
    render(
      <HelpFaqSearch sections={[{ title: 'X', items: [{ question: 'BON-LOG Premium とは', answer: 'aaa' }] }]} />,
    )
    await user.type(screen.getByLabelText(SEARCH_LABEL), 'premium')
    expect(screen.getByText('BON-LOG Premium とは')).toBeInTheDocument()
  })

  it('検索中は結果件数を表示する', async () => {
    const user = userEvent.setup()
    render(<HelpFaqSearch sections={sections} />)
    await user.type(screen.getByLabelText(SEARCH_LABEL), 'BON-LOG')
    expect(screen.getByText('「BON-LOG」の検索結果: 1件')).toBeInTheDocument()
  })

  it('一致が無いときは結果なしメッセージを表示する', async () => {
    const user = userEvent.setup()
    render(<HelpFaqSearch sections={sections} />)
    await user.type(screen.getByLabelText(SEARCH_LABEL), 'まったく一致しない語句')
    expect(screen.getByText(/該当する質問が見つかりませんでした/)).toBeInTheDocument()
    expect(screen.queryByText('BON-LOGとは何ですか？')).not.toBeInTheDocument()
  })
})
