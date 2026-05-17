import { render, screen } from '@testing-library/react'
import {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/ui/card'

describe('Cardサブコンポーネント共通', () => {
  const components = [
    { Component: Card, slot: 'card', name: 'Card' },
    { Component: CardHeader, slot: 'card-header', name: 'CardHeader' },
    { Component: CardTitle, slot: 'card-title', name: 'CardTitle' },
    { Component: CardDescription, slot: 'card-description', name: 'CardDescription' },
    { Component: CardContent, slot: 'card-content', name: 'CardContent' },
    { Component: CardFooter, slot: 'card-footer', name: 'CardFooter' },
    { Component: CardAction, slot: 'card-action', name: 'CardAction' },
  ] as const

  it.each(components)(
    '$name はdata-slot="$slot"を設定する',
    ({ Component, slot }) => {
      render(<Component>テスト</Component>)

      expect(screen.getByText('テスト')).toHaveAttribute('data-slot', slot)
    }
  )

  it.each(components)(
    '$name は子要素を表示する',
    ({ Component }) => {
      render(<Component>子コンテンツ</Component>)

      expect(screen.getByText('子コンテンツ')).toBeInTheDocument()
    }
  )

  it.each(components)(
    '$name はカスタムclassNameをマージする',
    ({ Component }) => {
      render(<Component className="my-custom-class">テスト</Component>)

      expect(screen.getByText('テスト')).toHaveClass('my-custom-class')
    }
  )

  it.each(components)(
    '$name はHTML属性を透過する',
    ({ Component }) => {
      render(
        <Component id="test-id" aria-label="テストラベル">
          テスト
        </Component>
      )

      const element = screen.getByText('テスト')
      expect(element).toHaveAttribute('id', 'test-id')
      expect(element).toHaveAttribute('aria-label', 'テストラベル')
    }
  )
})

describe('Card完全な構成', () => {
  it('すべてのパーツを組み合わせて表示する', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>テストカード</CardTitle>
          <CardDescription>これは説明文です</CardDescription>
          <CardAction>
            <button>編集</button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p>メインコンテンツ</p>
        </CardContent>
        <CardFooter>
          <button>アクション</button>
        </CardFooter>
      </Card>
    )

    expect(screen.getByText('テストカード')).toBeInTheDocument()
    expect(screen.getByText('これは説明文です')).toBeInTheDocument()
    expect(screen.getByText('メインコンテンツ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'アクション' })).toBeInTheDocument()
  })

  it('各パーツが正しいdata-slotを持つ', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>タイトル</CardTitle>
          <CardDescription>説明</CardDescription>
          <CardAction>
            <button>操作</button>
          </CardAction>
        </CardHeader>
        <CardContent>本文</CardContent>
        <CardFooter>フッター</CardFooter>
      </Card>
    )

    expect(screen.getByText('タイトル').closest('[data-slot="card-title"]')).toBeInTheDocument()
    expect(screen.getByText('説明').closest('[data-slot="card-description"]')).toBeInTheDocument()
    expect(screen.getByText('本文').closest('[data-slot="card-content"]')).toBeInTheDocument()
    expect(screen.getByText('フッター').closest('[data-slot="card-footer"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '操作' }).closest('[data-slot="card-action"]')).toBeInTheDocument()
  })

  it('ネストされたHTML要素を正しくレンダリングする', () => {
    render(
      <Card>
        <CardContent>
          <ul>
            <li>項目1</li>
            <li>項目2</li>
          </ul>
        </CardContent>
      </Card>
    )

    expect(screen.getByText('項目1')).toBeInTheDocument()
    expect(screen.getByText('項目2')).toBeInTheDocument()
  })
})
