/**
 * Select (shadcn/ui) - Coverage boost for uncovered lines 18, 94, 134
 *
 * Line 18: SelectGroup function body
 * Line 94: SelectLabel function body with className merging
 * Line 134: SelectSeparator function body with className merging
 *
 * Radix UI Select content renders in portals that jsdom inconsistently supports.
 * We render the wrapper functions directly to exercise their function bodies.
 */

import { render } from '../../utils/test-utils'
import React from 'react'
import {
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from '@/components/ui/select'

describe('Select sub-components - coverage boost', () => {
  describe('SelectGroup', () => {
    it('renders with data-slot="select-group"', () => {
      // Render standalone to exercise the function body (line 18)
      const { container } = render(
        React.createElement(SelectGroup, { role: 'group' }, 'Group content')
      )

      const el = container.querySelector('[data-slot="select-group"]')
      expect(el).toBeInTheDocument()
      expect(el?.textContent).toBe('Group content')
    })
  })

  describe('SelectLabel', () => {
    it('renders with data-slot and custom className inside SelectGroup', () => {
      // SelectLabel requires SelectGroup context (line 94)
      const { container } = render(
        React.createElement(SelectGroup, {},
          React.createElement(SelectLabel, { className: 'my-custom-label' }, 'Category')
        )
      )

      const el = container.querySelector('[data-slot="select-label"]')
      expect(el).toBeInTheDocument()
      expect(el).toHaveClass('my-custom-label')
      expect(el?.textContent).toBe('Category')
    })

    it('renders with default styles when no className provided', () => {
      const { container } = render(
        React.createElement(SelectGroup, {},
          React.createElement(SelectLabel, {}, 'Default label')
        )
      )

      const el = container.querySelector('[data-slot="select-label"]')
      expect(el).toBeInTheDocument()
      expect(el?.textContent).toBe('Default label')
    })
  })

  describe('SelectSeparator', () => {
    it('renders with data-slot and custom className', () => {
      // Render standalone to exercise className merging (line 134)
      const { container } = render(
        React.createElement(SelectSeparator, { className: 'my-separator' })
      )

      const el = container.querySelector('[data-slot="select-separator"]')
      expect(el).toBeInTheDocument()
      expect(el).toHaveClass('my-separator')
    })

    it('renders with default styles when no className provided', () => {
      const { container } = render(
        React.createElement(SelectSeparator, {})
      )

      const el = container.querySelector('[data-slot="select-separator"]')
      expect(el).toBeInTheDocument()
    })
  })

  describe('SelectScrollUpButton', () => {
    it('is a valid function component', () => {
      expect(typeof SelectScrollUpButton).toBe('function')
    })
  })

  describe('SelectScrollDownButton', () => {
    it('is a valid function component', () => {
      expect(typeof SelectScrollDownButton).toBe('function')
    })
  })
})
