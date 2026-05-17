/**
 * DropdownMenu - branch coverage tests
 * Covers uncovered branches:
 * - DropdownMenuItem with inset=true
 * - DropdownMenuItem with variant="destructive"
 * - DropdownMenuLabel with inset=true
 * - DropdownMenuSubTrigger with inset=true
 * - DropdownMenuShortcut rendering
 * - Custom className propagation on all components
 */

import { render, screen } from '../../utils/test-utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'

describe('DropdownMenu - branch coverage', () => {
  it('DropdownMenuItem with inset=true applies data-inset', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem inset data-testid="inset-item">Inset Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const item = screen.getByTestId('inset-item')
    expect(item).toHaveAttribute('data-inset', 'true')
  })

  it('DropdownMenuItem with variant="destructive" applies data-variant', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem variant="destructive" data-testid="destructive-item">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const item = screen.getByTestId('destructive-item')
    expect(item).toHaveAttribute('data-variant', 'destructive')
  })

  it('DropdownMenuLabel with inset=true applies data-inset', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel inset data-testid="inset-label">Label</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const label = screen.getByTestId('inset-label')
    expect(label).toHaveAttribute('data-inset', 'true')
  })

  it('DropdownMenuShortcut renders with custom className', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Item
            <DropdownMenuShortcut className="custom-class" data-testid="shortcut">Ctrl+D</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const shortcut = screen.getByTestId('shortcut')
    expect(shortcut).toHaveTextContent('Ctrl+D')
    expect(shortcut).toHaveClass('custom-class')
  })

  it('DropdownMenuSeparator renders with custom className', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSeparator className="custom-sep" data-testid="sep" />
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const sep = screen.getByTestId('sep')
    expect(sep).toHaveClass('custom-sep')
  })

  it('DropdownMenuGroup renders children', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuItem>Group Item</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(screen.getByText('Group Item')).toBeInTheDocument()
  })

  it('DropdownMenuPortal renders', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent>
            <DropdownMenuItem>Portal Item</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    )
    expect(screen.getByText('Portal Item')).toBeInTheDocument()
  })

  it('DropdownMenuContent with custom className', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent className="custom-content" data-testid="content">
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const content = screen.getByTestId('content')
    expect(content).toHaveClass('custom-content')
  })

  it('DropdownMenuSubTrigger with inset=true applies data-inset', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger inset data-testid="sub-trigger">
              Sub Menu
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub Item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const subTrigger = screen.getByTestId('sub-trigger')
    expect(subTrigger).toHaveAttribute('data-inset', 'true')
  })
})
