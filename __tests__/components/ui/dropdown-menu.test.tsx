import { render, screen } from '@testing-library/react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'

describe('DropdownMenu', () => {
  describe('DropdownMenu (ルートコンポーネント)', () => {
    it('子要素を表示する', () => {
      render(
        <DropdownMenu>
          <span data-testid="child">Child</span>
        </DropdownMenu>
      )

      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  describe('DropdownMenuTrigger', () => {
    it('トリガーを表示する', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        </DropdownMenu>
      )

      expect(screen.getByText('Open Menu')).toBeInTheDocument()
    })

    it('data-slot属性を設定する', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        </DropdownMenu>
      )

      expect(screen.getByText('Open')).toHaveAttribute('data-slot', 'dropdown-menu-trigger')
    })

    it('asChildでカスタム要素をトリガーにできる', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button data-testid="custom-trigger">Custom Button</button>
          </DropdownMenuTrigger>
        </DropdownMenu>
      )

      expect(screen.getByTestId('custom-trigger')).toBeInTheDocument()
    })
  })

  describe('DropdownMenuContent', () => {
    it('開いているときにコンテンツを表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>Menu Content</DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Menu Content')).toBeInTheDocument()
    })

    it('data-slot属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>Content</DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Content').closest('[data-slot="dropdown-menu-content"]')).toBeInTheDocument()
    })

    it('追加のクラスを適用する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent className="custom-class">Content</DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Content').closest('[data-slot="dropdown-menu-content"]')).toHaveClass('custom-class')
    })
  })

  describe('DropdownMenuItem', () => {
    it('メニューアイテムを表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Item 1')).toBeInTheDocument()
    })

    it('data-slot属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Item')).toHaveAttribute('data-slot', 'dropdown-menu-item')
    })

    it('insetプロパティでdata-inset属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem inset>Inset Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Inset Item')).toHaveAttribute('data-inset', 'true')
    })

    it('destructiveバリアントを適用する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Delete')).toHaveAttribute('data-variant', 'destructive')
    })

    it('追加のクラスを適用する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem className="custom-class">Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Item')).toHaveClass('custom-class')
    })
  })

  describe('DropdownMenuCheckboxItem', () => {
    it('チェックボックスアイテムを表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked>Checked Item</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Checked Item')).toBeInTheDocument()
    })

    it('data-slot属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem>Item</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Item').closest('[data-slot="dropdown-menu-checkbox-item"]')).toBeInTheDocument()
    })

    it('チェック状態を表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked>Checked</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      const item = screen.getByText('Checked').closest('[data-slot="dropdown-menu-checkbox-item"]')
      expect(item).toHaveAttribute('data-state', 'checked')
    })
  })

  describe('DropdownMenuRadioGroup & DropdownMenuRadioItem', () => {
    it('ラジオグループを表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="option1">
              <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
    })

    it('ラジオアイテムにdata-slot属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="option1">
              <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Option 1').closest('[data-slot="dropdown-menu-radio-item"]')).toBeInTheDocument()
    })

    it('選択状態を表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value="option1">
              <DropdownMenuRadioItem value="option1">Selected</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="option2">Not Selected</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      const selectedItem = screen.getByText('Selected').closest('[data-slot="dropdown-menu-radio-item"]')
      const unselectedItem = screen.getByText('Not Selected').closest('[data-slot="dropdown-menu-radio-item"]')

      expect(selectedItem).toHaveAttribute('data-state', 'checked')
      expect(unselectedItem).toHaveAttribute('data-state', 'unchecked')
    })
  })

  describe('DropdownMenuLabel', () => {
    it('ラベルを表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Label Text</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Label Text')).toBeInTheDocument()
    })

    it('data-slot属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Label</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Label')).toHaveAttribute('data-slot', 'dropdown-menu-label')
    })

    it('insetプロパティでdata-inset属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel inset>Inset Label</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Inset Label')).toHaveAttribute('data-inset', 'true')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Label</DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      const label = screen.getByText('Label')
      expect(label).toHaveClass('text-sm')
      expect(label).toHaveClass('font-medium')
    })
  })

  describe('DropdownMenuSeparator', () => {
    it('区切り線を表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuSeparator data-testid="separator" />
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByTestId('separator')).toBeInTheDocument()
    })

    it('data-slot属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSeparator data-testid="separator" />
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByTestId('separator')).toHaveAttribute('data-slot', 'dropdown-menu-separator')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSeparator data-testid="separator" />
          </DropdownMenuContent>
        </DropdownMenu>
      )

      const separator = screen.getByTestId('separator')
      expect(separator).toHaveClass('bg-border')
      expect(separator).toHaveClass('h-px')
    })
  })

  describe('DropdownMenuShortcut', () => {
    it('ショートカットを表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Copy
              <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('⌘C')).toBeInTheDocument()
    })

    it('data-slot属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Item
              <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('⌘K')).toHaveAttribute('data-slot', 'dropdown-menu-shortcut')
    })

    it('スタイルクラスを適用する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>
              Item
              <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      const shortcut = screen.getByText('⌘X')
      expect(shortcut).toHaveClass('text-muted-foreground')
      expect(shortcut).toHaveClass('text-xs')
      expect(shortcut).toHaveClass('ml-auto')
    })
  })

  describe('DropdownMenuGroup', () => {
    it('グループを表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup data-testid="group">
              <DropdownMenuItem>Item 1</DropdownMenuItem>
              <DropdownMenuItem>Item 2</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByTestId('group')).toBeInTheDocument()
    })

    it('data-slot属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup data-testid="group">
              <DropdownMenuItem>Item</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByTestId('group')).toHaveAttribute('data-slot', 'dropdown-menu-group')
    })
  })

  describe('DropdownMenuSub', () => {
    it('サブメニューを表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>More Options</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Sub Item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('More Options')).toBeInTheDocument()
    })

    it('サブトリガーにdata-slot属性を設定する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Trigger</DropdownMenuSubTrigger>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('Trigger').closest('[data-slot="dropdown-menu-sub-trigger"]')).toBeInTheDocument()
    })

    it('サブトリガーにinsetプロパティを設定できる', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>Inset Trigger</DropdownMenuSubTrigger>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      const trigger = screen.getByText('Inset Trigger').closest('[data-slot="dropdown-menu-sub-trigger"]')
      expect(trigger).toHaveAttribute('data-inset', 'true')
    })
  })

  describe('完全な構成', () => {
    it('すべてのパーツを組み合わせて表示する', () => {
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger asChild>
            <button>メニューを開く</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>アカウント</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem>
                プロフィール
                <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>設定</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked>通知を有効にする</DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">ログアウト</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      expect(screen.getByText('アカウント')).toBeInTheDocument()
      expect(screen.getByText('プロフィール')).toBeInTheDocument()
      expect(screen.getByText('⌘P')).toBeInTheDocument()
      expect(screen.getByText('設定')).toBeInTheDocument()
      expect(screen.getByText('通知を有効にする')).toBeInTheDocument()
      expect(screen.getByText('ログアウト')).toBeInTheDocument()
    })

    it('トリガーの初期状態はclosedである', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )

      const trigger = screen.getByText('Open')

      // 初期状態ではclosed
      expect(trigger).toHaveAttribute('data-state', 'closed')
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    })
  })
})
