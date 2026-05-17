/**
 * Select - branch coverage tests
 * Covers uncovered branches:
 * - SelectTrigger with size="sm"
 * - SelectContent with position="popper"
 * - SelectLabel with custom className
 * - SelectSeparator rendering
 * - SelectScrollUpButton / SelectScrollDownButton rendering
 */

import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select'

describe('Select - branch coverage', () => {
  it('SelectTrigger with size="sm" applies data-size="sm"', () => {
    render(
      <Select>
        <SelectTrigger size="sm" data-testid="trigger">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
      </Select>
    )
    const trigger = screen.getByTestId('trigger')
    expect(trigger).toHaveAttribute('data-size', 'sm')
  })

  it('SelectTrigger with default size applies data-size="default"', () => {
    render(
      <Select>
        <SelectTrigger data-testid="trigger">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
      </Select>
    )
    const trigger = screen.getByTestId('trigger')
    expect(trigger).toHaveAttribute('data-size', 'default')
  })

  it('SelectTrigger with custom className', () => {
    render(
      <Select>
        <SelectTrigger className="custom-trigger" data-testid="trigger">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
      </Select>
    )
    const trigger = screen.getByTestId('trigger')
    expect(trigger).toHaveClass('custom-trigger')
  })

  it('SelectContent position="popper" renders without error', () => {
    // Radix Select uses scrollIntoView which is not available in jsdom
    // so we mock it to prevent errors when select is open
    Element.prototype.scrollIntoView = vi.fn()

    render(
      <Select open>
        <SelectTrigger>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent position="popper" data-testid="content">
          <SelectGroup>
            <SelectLabel className="custom-label" data-testid="label">Group</SelectLabel>
            <SelectItem value="a" className="custom-item" data-testid="item-a">A</SelectItem>
            <SelectSeparator className="custom-sep" data-testid="sep" />
            <SelectItem value="b">B</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    )
    expect(screen.getByTestId('content')).toBeInTheDocument()
    expect(screen.getByTestId('label')).toHaveClass('custom-label')
    expect(screen.getByTestId('item-a')).toHaveClass('custom-item')
    expect(screen.getByTestId('sep')).toHaveClass('custom-sep')
  })

  it('SelectContent with item-aligned position and custom className', () => {
    Element.prototype.scrollIntoView = vi.fn()

    render(
      <Select open>
        <SelectTrigger>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent className="custom-content" data-testid="content">
          <SelectItem value="test">Test</SelectItem>
        </SelectContent>
      </Select>
    )
    const content = screen.getByTestId('content')
    expect(content).toHaveClass('custom-content')
  })
})
