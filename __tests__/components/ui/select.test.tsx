/**
 * Select (shadcn/ui) - 基本レンダリングテスト
 *
 * Note: Radix UI Select uses portals which don't render in jsdom when opened.
 * Tests focus on trigger rendering and static configurations.
 */

import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

describe('Select コンポーネント', () => {
  it('SelectTriggerをレンダリングする', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="選択してください" />
        </SelectTrigger>
      </Select>
    )

    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('選択してください')).toBeInTheDocument()
  })

  it('SelectTriggerにカスタムclassNameを適用する', () => {
    render(
      <Select>
        <SelectTrigger className="custom-class">
          <SelectValue placeholder="選択" />
        </SelectTrigger>
      </Select>
    )

    expect(screen.getByRole('combobox')).toHaveClass('custom-class')
  })

  it('SelectTriggerのsize="sm"を適用する', () => {
    render(
      <Select>
        <SelectTrigger size="sm">
          <SelectValue placeholder="選択" />
        </SelectTrigger>
      </Select>
    )

    expect(screen.getByRole('combobox')).toHaveAttribute('data-size', 'sm')
  })

  it('SelectTriggerのデフォルトsize="default"を適用する', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="選択" />
        </SelectTrigger>
      </Select>
    )

    expect(screen.getByRole('combobox')).toHaveAttribute('data-size', 'default')
  })

  it('data-slot属性が正しく設定される', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="選択" />
        </SelectTrigger>
      </Select>
    )

    expect(screen.getByRole('combobox')).toHaveAttribute('data-slot', 'select-trigger')
  })

  it('disabledの場合にトリガーが無効化される', () => {
    render(
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="選択" />
        </SelectTrigger>
      </Select>
    )

    expect(screen.getByRole('combobox')).toBeDisabled()
  })

  it('初期値が設定される', () => {
    render(
      <Select defaultValue="option1">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">オプション1</SelectItem>
          <SelectItem value="option2">オプション2</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByText('オプション1')).toBeInTheDocument()
  })

  it('SelectValueにプレースホルダーを設定する', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="カテゴリを選択" />
        </SelectTrigger>
      </Select>
    )

    expect(screen.getByText('カテゴリを選択')).toBeInTheDocument()
  })

  it('SelectTriggerにChevronDownアイコンが含まれる', () => {
    const { container } = render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="選択" />
        </SelectTrigger>
      </Select>
    )

    // ChevronDownIcon is rendered as svg inside the trigger
    const svg = container.querySelector('[data-slot="select-trigger"] svg')
    expect(svg).toBeInTheDocument()
  })

  it('制御値が設定される', () => {
    render(
      <Select value="option2">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">オプション1</SelectItem>
          <SelectItem value="option2">オプション2</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByText('オプション2')).toBeInTheDocument()
  })

  it('onValueChangeコールバックを受け付ける', () => {
    const onChange = vi.fn()
    render(
      <Select onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="選択" />
        </SelectTrigger>
      </Select>
    )

    // Just verify it renders without error
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('SelectGroupコンポーネントが存在する', () => {
    expect(SelectGroup).toBeDefined()
  })

  it('SelectLabelコンポーネントが存在する', () => {
    expect(SelectLabel).toBeDefined()
  })

  it('SelectSeparatorコンポーネントが存在する', () => {
    expect(SelectSeparator).toBeDefined()
  })

  it('SelectContentコンポーネントが存在する', () => {
    expect(SelectContent).toBeDefined()
  })

  it('複数のSelectを並べてレンダリングできる', () => {
    render(
      <div>
        <Select>
          <SelectTrigger data-testid="trigger-1">
            <SelectValue placeholder="選択1" />
          </SelectTrigger>
        </Select>
        <Select>
          <SelectTrigger data-testid="trigger-2">
            <SelectValue placeholder="選択2" />
          </SelectTrigger>
        </Select>
      </div>
    )

    expect(screen.getByTestId('trigger-1')).toBeInTheDocument()
    expect(screen.getByTestId('trigger-2')).toBeInTheDocument()
  })

  it('aria-labelを適用できる', () => {
    render(
      <Select>
        <SelectTrigger aria-label="カテゴリ選択">
          <SelectValue placeholder="選択" />
        </SelectTrigger>
      </Select>
    )

    expect(screen.getByLabelText('カテゴリ選択')).toBeInTheDocument()
  })
})
