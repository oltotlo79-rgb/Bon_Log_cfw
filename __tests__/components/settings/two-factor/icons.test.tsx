import { describe, it, expect } from 'vitest'
import { render } from '../../../utils/test-utils'
import { CopyIcon, CheckIcon, EyeIcon, EyeOffIcon } from '@/components/settings/two-factor/icons'

describe('two-factor icons', () => {
  describe('CopyIcon', () => {
    it('SVG要素をレンダリングする', () => {
      const { container } = render(<CopyIcon />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('classNameを受け取れる', () => {
      const { container } = render(<CopyIcon className="w-4 h-4" />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('w-4', 'h-4')
    })
  })

  describe('CheckIcon', () => {
    it('SVG要素をレンダリングする', () => {
      const { container } = render(<CheckIcon />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('classNameを受け取れる', () => {
      const { container } = render(<CheckIcon className="text-green-500" />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('text-green-500')
    })
  })

  describe('EyeIcon', () => {
    it('SVG要素をレンダリングする', () => {
      const { container } = render(<EyeIcon />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('classNameを受け取れる', () => {
      const { container } = render(<EyeIcon className="w-5" />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('w-5')
    })
  })

  describe('EyeOffIcon', () => {
    it('SVG要素をレンダリングする', () => {
      const { container } = render(<EyeOffIcon />)
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('classNameを受け取れる', () => {
      const { container } = render(<EyeOffIcon className="opacity-50" />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveClass('opacity-50')
    })
  })

  it('classNameを指定しない場合もエラーにならない', () => {
    const { container } = render(
      <>
        <CopyIcon />
        <CheckIcon />
        <EyeIcon />
        <EyeOffIcon />
      </>
    )
    const svgs = container.querySelectorAll('svg')
    expect(svgs).toHaveLength(4)
  })
})
