import { vi } from 'vitest'
import { render, screen } from '../../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiSelectorSection } from '@/components/post/form/BonsaiSelectorSection'

const mockBonsaiList = [
  { id: 'bonsai-1', name: '黒松', species: '黒松' },
  { id: 'bonsai-2', name: '五葉松', species: null },
  { id: 'bonsai-3', name: 'もみじ', species: 'もみじ' },
]

describe('BonsaiSelectorSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('盆栽リストがある場合にセレクターが表示される', () => {
    render(
      <BonsaiSelectorSection
        selectedBonsaiId={null}
        bonsaiList={mockBonsaiList}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('関連する盆栽（任意）')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('盆栽リストが空の場合は何も表示されない', () => {
    const { container } = render(
      <BonsaiSelectorSection
        selectedBonsaiId={null}
        bonsaiList={[]}
        onChange={vi.fn()}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('全ての盆栽がオプションとして表示される', () => {
    render(
      <BonsaiSelectorSection
        selectedBonsaiId={null}
        bonsaiList={mockBonsaiList}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('黒松 (黒松)')).toBeInTheDocument()
    expect(screen.getByText('五葉松')).toBeInTheDocument()
    expect(screen.getByText('もみじ (もみじ)')).toBeInTheDocument()
  })

  it('"選択しない"オプションが存在する', () => {
    render(
      <BonsaiSelectorSection
        selectedBonsaiId={null}
        bonsaiList={mockBonsaiList}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('選択しない')).toBeInTheDocument()
  })

  it('selectedBonsaiIdが設定されている場合にその盆栽が選択状態になる', () => {
    render(
      <BonsaiSelectorSection
        selectedBonsaiId="bonsai-1"
        bonsaiList={mockBonsaiList}
        onChange={vi.fn()}
      />
    )
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('bonsai-1')
  })

  it('selectedBonsaiIdがnullの場合に空文字が選択状態になる', () => {
    render(
      <BonsaiSelectorSection
        selectedBonsaiId={null}
        bonsaiList={mockBonsaiList}
        onChange={vi.fn()}
      />
    )
    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('')
  })

  it('盆栽を選択するとonChangeが呼ばれる', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <BonsaiSelectorSection
        selectedBonsaiId={null}
        bonsaiList={mockBonsaiList}
        onChange={onChange}
      />
    )
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'bonsai-2')
    expect(onChange).toHaveBeenCalledWith('bonsai-2')
  })

  it('"選択しない"を選択するとonChangeにnullが渡される', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <BonsaiSelectorSection
        selectedBonsaiId="bonsai-1"
        bonsaiList={mockBonsaiList}
        onChange={onChange}
      />
    )
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '')
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('species がない盆栽は名前のみ表示される', () => {
    render(
      <BonsaiSelectorSection
        selectedBonsaiId={null}
        bonsaiList={[{ id: 'b1', name: '五葉松', species: null }]}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('五葉松')).toBeInTheDocument()
    expect(screen.queryByText(/\(/)).not.toBeInTheDocument()
  })

  it('species がある盆栽は "名前 (種類)" 形式で表示される', () => {
    render(
      <BonsaiSelectorSection
        selectedBonsaiId={null}
        bonsaiList={[{ id: 'b1', name: '黒松', species: '黒松' }]}
        onChange={vi.fn()}
      />
    )
    expect(screen.getByText('黒松 (黒松)')).toBeInTheDocument()
  })
})
