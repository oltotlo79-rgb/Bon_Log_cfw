import { vi } from 'vitest'
import { render, screen, fireEvent } from '../utils/test-utils'
import { StarRating } from '@/components/shop/StarRating'

/**
 * StarRating lines 184-185: handleMouseLeave when interactive is true
 *
 * The existing tests cover click and mouse-enter in interactive mode,
 * but do not exercise the mouseLeave handler that resets hoverRating to 0
 * (lines 183-186). This test explicitly fires mouseLeave on an interactive
 * StarRating and verifies the hover preview is cleared.
 */
describe('StarRating handleMouseLeave branch (lines 184-185)', () => {
  it('resets hover preview when mouse leaves an interactive star', () => {
    const onChange = vi.fn()
    const { container } = render(
      <StarRating rating={1} interactive onChange={onChange} size="md" />
    )

    const buttons = screen.getAllByRole('button')

    // Hover over the 5th star to set hoverRating = 5
    fireEvent.mouseEnter(buttons[4])

    // While hovering at star 5, all 5 stars should be filled
    let filledStars = container.querySelectorAll('svg[fill="currentColor"]')
    expect(filledStars).toHaveLength(5)

    // Now leave the star area
    fireEvent.mouseLeave(buttons[4])

    // After mouse leave, only the original rating (1) star should be filled
    filledStars = container.querySelectorAll('svg[fill="currentColor"]')
    expect(filledStars).toHaveLength(1)
  })

  it('does NOT reset hoverRating when non-interactive (guard clause)', () => {
    const { container } = render(
      <StarRating rating={3} interactive={false} />
    )

    const buttons = screen.getAllByRole('button')

    // mouseEnter on non-interactive should not change display
    fireEvent.mouseEnter(buttons[4])
    let filledStars = container.querySelectorAll('svg[fill="currentColor"]')
    expect(filledStars).toHaveLength(3)

    // mouseLeave on non-interactive should also be a no-op
    fireEvent.mouseLeave(buttons[4])
    filledStars = container.querySelectorAll('svg[fill="currentColor"]')
    expect(filledStars).toHaveLength(3)
  })
})
