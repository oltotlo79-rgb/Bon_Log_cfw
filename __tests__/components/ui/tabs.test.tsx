import { vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

describe('Tabs', () => {
  describe('Tabs (ルートコンポーネント)', () => {
    it('子要素を表示する', () => {
      render(
        <Tabs defaultValue="tab1">
          <span data-testid="child">Child</span>
        </Tabs>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })

    it('data-slot属性をtabsに設定する', () => {
      const { container } = render(<Tabs defaultValue="tab1">Content</Tabs>)

      expect(container.firstChild).toHaveAttribute('data-slot', 'tabs')
    })

    it('基本的なスタイルクラスを適用する', () => {
      const { container } = render(<Tabs defaultValue="tab1">Content</Tabs>)

      expect(container.firstChild).toHaveClass('flex')
      expect(container.firstChild).toHaveClass('flex-col')
      expect(container.firstChild).toHaveClass('gap-2')
    })

    it('追加のクラスを適用する', () => {
      const { container } = render(<Tabs defaultValue="tab1" className="custom-class">Content</Tabs>)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('TabsList', () => {
    it('タブトリガーを表示する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      expect(screen.getByRole('tablist')).toBeInTheDocument()
    })

    it('data-slot属性をtabs-listに設定する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      expect(screen.getByRole('tablist')).toHaveAttribute('data-slot', 'tabs-list')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      const tablist = screen.getByRole('tablist')
      expect(tablist).toHaveClass('bg-muted')
      expect(tablist).toHaveClass('inline-flex')
      expect(tablist).toHaveClass('rounded-lg')
    })

    it('追加のクラスを適用する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList className="custom-class">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      expect(screen.getByRole('tablist')).toHaveClass('custom-class')
    })
  })

  describe('TabsTrigger', () => {
    it('タブボタンを表示する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">投稿</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      expect(screen.getByRole('tab', { name: '投稿' })).toBeInTheDocument()
    })

    it('data-slot属性をtabs-triggerに設定する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      expect(screen.getByRole('tab')).toHaveAttribute('data-slot', 'tabs-trigger')
    })

    it('アクティブなタブはdata-state="active"を持つ', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('data-state', 'active')
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('data-state', 'inactive')
    })

    it('タブトリガーがクリック可能である', () => {
      const handleClick = vi.fn()
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" onClick={handleClick}>Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      fireEvent.click(screen.getByRole('tab', { name: 'Tab 2' }))

      expect(handleClick).toHaveBeenCalled()
    })

    it('disabledの場合は無効化する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2" disabled>Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      expect(screen.getByRole('tab', { name: 'Tab 2' })).toBeDisabled()
    })

    it('スタイルクラスを適用する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      const trigger = screen.getByRole('tab')
      expect(trigger).toHaveClass('inline-flex')
      expect(trigger).toHaveClass('items-center')
      expect(trigger).toHaveClass('justify-center')
      expect(trigger).toHaveClass('rounded-md')
    })

    it('追加のクラスを適用する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1" className="custom-class">Tab</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      expect(screen.getByRole('tab')).toHaveClass('custom-class')
    })
  })

  describe('TabsContent', () => {
    it('アクティブなタブのコンテンツを表示する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">
            <p>Tab 1 Content</p>
          </TabsContent>
          <TabsContent value="tab2">
            <p>Tab 2 Content</p>
          </TabsContent>
        </Tabs>
      )

      expect(screen.getByText('Tab 1 Content')).toBeInTheDocument()
    })

    it('data-slot属性をtabs-contentに設定する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      )

      expect(screen.getByRole('tabpanel')).toHaveAttribute('data-slot', 'tabs-content')
    })

    it('初期状態でアクティブなタブのコンテンツが表示される', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      )

      // 初期状態ではtab1がアクティブ
      expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('data-state', 'active')
      expect(screen.getByRole('tabpanel')).toHaveTextContent('Content 1')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content</TabsContent>
        </Tabs>
      )

      const content = screen.getByRole('tabpanel')
      expect(content).toHaveClass('flex-1')
      expect(content).toHaveClass('outline-none')
    })

    it('追加のクラスを適用する', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" className="custom-class">Content</TabsContent>
        </Tabs>
      )

      expect(screen.getByRole('tabpanel')).toHaveClass('custom-class')
    })
  })

  describe('制御コンポーネント', () => {
    it('valueプロパティで初期タブを設定できる', () => {
      render(
        <Tabs value="tab2">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
        </Tabs>
      )

      // tab2がアクティブになっている
      expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('data-state', 'active')
    })
  })

  describe('完全な構成', () => {
    it('すべてのパーツを組み合わせて表示する', () => {
      render(
        <Tabs defaultValue="posts">
          <TabsList>
            <TabsTrigger value="posts">投稿</TabsTrigger>
            <TabsTrigger value="media">メディア</TabsTrigger>
            <TabsTrigger value="likes">いいね</TabsTrigger>
          </TabsList>
          <TabsContent value="posts">
            <p>投稿一覧</p>
          </TabsContent>
          <TabsContent value="media">
            <p>メディア一覧</p>
          </TabsContent>
          <TabsContent value="likes">
            <p>いいね一覧</p>
          </TabsContent>
        </Tabs>
      )

      expect(screen.getByRole('tablist')).toBeInTheDocument()
      expect(screen.getAllByRole('tab')).toHaveLength(3)
      expect(screen.getByText('投稿一覧')).toBeInTheDocument()
    })
  })
})
