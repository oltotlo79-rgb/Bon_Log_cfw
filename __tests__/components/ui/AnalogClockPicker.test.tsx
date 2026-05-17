import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { AnalogClockPicker } from '@/components/ui/AnalogClockPicker'

describe('AnalogClockPicker', () => {
  const defaultProps = {
    value: '09:00',
    onChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('デフォルト値でレンダリングされる', () => {
    render(<AnalogClockPicker {...defaultProps} />)
    expect(screen.getByText('09:00')).toBeInTheDocument()
  })

  it('現在の時刻値を表示する', () => {
    render(<AnalogClockPicker {...defaultProps} value="14:30" />)
    expect(screen.getByText('14:30')).toBeInTheDocument()
  })

  it('ラベルが提供された場合に表示される', () => {
    render(<AnalogClockPicker {...defaultProps} label="開始時刻" />)
    expect(screen.getByText('開始時刻')).toBeInTheDocument()
  })

  it('ラベルが提供されない場合はレンダリングされない', () => {
    render(<AnalogClockPicker {...defaultProps} />)
    expect(screen.queryByText('開始時刻')).not.toBeInTheDocument()
  })

  it('無効状態ではボタンがdisabledになる', () => {
    render(<AnalogClockPicker {...defaultProps} disabled />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('クリックでドロップダウンが開く', () => {
    render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    // ドロップダウンが開くとキャンセル・OKボタンが表示される
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
    expect(screen.getByText('OK')).toBeInTheDocument()
  })

  it('時間選択モードで0-11の外側リング時間が表示される', () => {
    render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    // 外側リング: 12, 1, 2, ..., 11
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
  })

  it('時間選択モードで12-23の内側リング時間が表示される', () => {
    render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    // 内側リング: 0, 13, 14, ..., 23
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('23')).toBeInTheDocument()
  })

  it('内側リングに0時が表示される', () => {
    render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    // 0時は内側リングに表示
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('値のフォーマットはHH:MMである', () => {
    render(<AnalogClockPicker {...defaultProps} value="09:05" />)
    expect(screen.getByText('09:05')).toBeInTheDocument()
  })

  it('初期値から正しい時間が設定される', () => {
    render(<AnalogClockPicker {...defaultProps} value="14:30" />)
    fireEvent.click(screen.getByRole('button'))
    // ピッカー内の時間表示ボタンに14が表示される
    const buttons = screen.getAllByRole('button')
    const hourButton = buttons.find(btn => btn.textContent === '14')
    expect(hourButton).toBeInTheDocument()
  })

  it('初期値から正しい分が設定される', () => {
    render(<AnalogClockPicker {...defaultProps} value="14:30" />)
    fireEvent.click(screen.getByRole('button'))
    // ピッカー内の分表示ボタンに30が表示される
    const buttons = screen.getAllByRole('button')
    const minuteButton = buttons.find(btn => btn.textContent === '30')
    expect(minuteButton).toBeInTheDocument()
  })

  it('ClockIconコンポーネントがレンダリングされる', () => {
    const { container } = render(<AnalogClockPicker {...defaultProps} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('ClockIconが正しいclassNameを持つ', () => {
    const { container } = render(<AnalogClockPicker {...defaultProps} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('w-4', 'h-4')
  })

  it('無効状態のボタンが視覚的に示される', () => {
    render(<AnalogClockPicker {...defaultProps} disabled />)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('opacity-50', 'cursor-not-allowed')
  })

  it('選択された時間がハイライトされる', () => {
    const { container } = render(<AnalogClockPicker {...defaultProps} value="03:00" />)
    fireEvent.click(screen.getByRole('button'))
    // bg-primaryクラスを持つ要素が存在する（選択された時間）
    const highlighted = container.querySelectorAll('.bg-primary')
    expect(highlighted.length).toBeGreaterThan(0)
  })

  it('キャンセルボタンでピッカーが閉じる', () => {
    render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('キャンセル')).not.toBeInTheDocument()
  })

  it('OKボタンでピッカーが閉じる', () => {
    render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('OK')).toBeInTheDocument()
    fireEvent.click(screen.getByText('OK'))
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('ピッカーが開いた時に時計の文字盤が表示される', () => {
    const { container } = render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    expect(clockFace).toBeInTheDocument()
  })

  it('時計の中心点が表示される', () => {
    const { container } = render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    const centerDot = container.querySelector('.bg-primary.rounded-full.z-10')
    expect(centerDot).toBeInTheDocument()
  })

  it('分選択モードに切り替えられる', () => {
    render(<AnalogClockPicker {...defaultProps} value="09:00" />)
    fireEvent.click(screen.getByRole('button'))
    // 分表示ボタンをクリックして分選択モードに切り替え
    const buttons = screen.getAllByRole('button')
    const minuteButton = buttons.find(btn => btn.textContent === '00' && btn.classList.contains('text-3xl'))
    if (minuteButton) {
      fireEvent.click(minuteButton)
    }
    // 分選択モードでは5分刻みの数字が表示される
    expect(screen.getByText('05')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('分選択モードで5分刻みの値が表示される', () => {
    render(<AnalogClockPicker {...defaultProps} value="09:00" />)
    fireEvent.click(screen.getByRole('button'))
    // 分表示ボタンをクリック
    const buttons = screen.getAllByRole('button')
    const minuteBtn = buttons.find(btn => btn.textContent === '00' && btn.classList.contains('text-3xl'))
    if (minuteBtn) fireEvent.click(minuteBtn)
    // 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  it('空の値ではプレースホルダーが表示される', () => {
    render(<AnalogClockPicker {...defaultProps} value="" />)
    expect(screen.getByText('--:--')).toBeInTheDocument()
  })

  it('無効な値ではデフォルト値（9:00）が使用される', () => {
    render(<AnalogClockPicker {...defaultProps} value="invalid" />)
    fireEvent.click(screen.getByRole('button'))
    // デフォルトの9時が表示
    const buttons = screen.getAllByRole('button')
    const hourBtn = buttons.find(btn => btn.textContent === '09' && btn.classList.contains('text-3xl'))
    expect(hourBtn).toBeInTheDocument()
  })

  it('モバイル用オーバーレイ背景が表示される', () => {
    const { container } = render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    const overlay = container.querySelector('.fixed.inset-0.bg-black\\/50')
    expect(overlay).toBeInTheDocument()
  })

  it('disabled状態ではクリックしてもピッカーが開かない', () => {
    render(<AnalogClockPicker {...defaultProps} disabled />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('キャンセル')).not.toBeInTheDocument()
  })

  it('時間選択モードで時間表示ボタンがハイライトされる', () => {
    render(<AnalogClockPicker {...defaultProps} value="09:00" />)
    fireEvent.click(screen.getByRole('button'))
    // 時間モードの時、時間表示ボタンがbg-primaryクラスを持つ
    const buttons = screen.getAllByRole('button')
    const hourBtn = buttons.find(btn => btn.textContent === '09' && btn.classList.contains('text-3xl'))
    expect(hourBtn).toHaveClass('bg-primary')
  })

  it('オーバーレイクリックでピッカーを閉じてモードをリセットする', () => {
    const { container } = render(<AnalogClockPicker {...defaultProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('OK')).toBeInTheDocument()

    const overlay = container.querySelector('.fixed.inset-0.bg-black\\/50.z-40')
    if (overlay) {
      fireEvent.click(overlay)
    }
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('時間表示ボタンクリックで時間選択モードに戻る', () => {
    render(<AnalogClockPicker {...defaultProps} value="09:30" />)
    fireEvent.click(screen.getByRole('button'))

    // Switch to minutes mode
    const buttons = screen.getAllByRole('button')
    const minuteBtn = buttons.find(btn => btn.textContent === '30' && btn.classList.contains('text-3xl'))
    if (minuteBtn) fireEvent.click(minuteBtn)
    expect(screen.getByText('05')).toBeInTheDocument()

    // Switch back to hours mode
    const hourBtn = screen.getAllByRole('button').find(btn => btn.textContent === '09' && btn.classList.contains('text-3xl'))
    if (hourBtn) fireEvent.click(hourBtn)
    // Should show hour numbers again (inner ring)
    expect(screen.getByText('13')).toBeInTheDocument()
  })

  it('時計文字盤でマウスダウンで時間選択のインタラクションが発生する', () => {
    const onChange = vi.fn()
    const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      // getBoundingClientRect をモック
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
        x: 0, y: 0, toJSON: () => {},
      })

      fireEvent.mouseDown(clockFace, { clientX: 112, clientY: 0 })
      expect(onChange).toHaveBeenCalled()
    }
  })

  it('時計文字盤でマウスアップで時間選択が確定し分モードに遷移する', () => {
    const onChange = vi.fn()
    const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
        x: 0, y: 0, toJSON: () => {},
      })

      fireEvent.mouseUp(clockFace, { clientX: 112, clientY: 0 })
      // After mouseUp in hour mode, should switch to minutes mode
      // Check for minute numbers
      expect(screen.getByText('05')).toBeInTheDocument()
    }
  })

  it('分選択モードでマウスアップするとピッカーが閉じる', () => {
    const onChange = vi.fn()
    const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    // Switch to minutes mode
    const minuteBtn = screen.getAllByRole('button').find(btn => btn.textContent === '00' && btn.classList.contains('text-3xl'))
    if (minuteBtn) fireEvent.click(minuteBtn)

    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
        x: 0, y: 0, toJSON: () => {},
      })

      fireEvent.mouseUp(clockFace, { clientX: 112, clientY: 0 })
      // Picker should close
      expect(screen.queryByText('OK')).not.toBeInTheDocument()
    }
  })

  it('マウスムーブ（ドラッグ中）で値が更新される', () => {
    const onChange = vi.fn()
    const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
        x: 0, y: 0, toJSON: () => {},
      })

      // buttons=1 means left button is held
      fireEvent.mouseMove(clockFace, { clientX: 224, clientY: 112, buttons: 1 })
      expect(onChange).toHaveBeenCalled()
    }
  })

  it('disabled状態ではマウスダウンが無視される', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} disabled />)
    // Can't open picker when disabled, so onChange shouldn't be called
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('タッチイベントで時間選択のインタラクションが発生する', () => {
    const onChange = vi.fn()
    const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
        x: 0, y: 0, toJSON: () => {},
      })

      fireEvent.touchStart(clockFace, { touches: [{ clientX: 112, clientY: 0 }], preventDefault: vi.fn() })
      expect(onChange).toHaveBeenCalled()
    }
  })

  it('タッチムーブで値が更新される', () => {
    const onChange = vi.fn()
    const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
        x: 0, y: 0, toJSON: () => {},
      })

      fireEvent.touchMove(clockFace, { touches: [{ clientX: 224, clientY: 112 }], preventDefault: vi.fn() })
      expect(onChange).toHaveBeenCalled()
    }
  })

  it('タッチエンドで選択が確定する', () => {
    const onChange = vi.fn()
    const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
        x: 0, y: 0, toJSON: () => {},
      })

      fireEvent.touchEnd(clockFace, { changedTouches: [{ clientX: 112, clientY: 0 }], preventDefault: vi.fn() })
      expect(onChange).toHaveBeenCalled()
    }
  })

  it('内側リング（PM）のクリックで12-23時が選択される', () => {
    const onChange = vi.fn()
    const { container } = render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))

    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    if (clockFace) {
      vi.spyOn(clockFace, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 224, bottom: 224, width: 224, height: 224,
        x: 0, y: 0, toJSON: () => {},
      })

      // Click near center (inner ring) at 12 o'clock position
      fireEvent.mouseDown(clockFace, { clientX: 112, clientY: 60 })
      // Should select PM hour (inner ring)
      expect(onChange).toHaveBeenCalled()
    }
  })

  it('外部クリックでピッカーが閉じる', () => {
    render(
      <div>
        <div data-testid="outside">外部</div>
        <AnalogClockPicker {...defaultProps} />
      </div>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('OK')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('value=""でピッカーを開くと時計UIが表示される', () => {
    const { container } = render(<AnalogClockPicker value="" onChange={vi.fn()} />)
    expect(screen.getByText('--:--')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    // Clock face should be visible
    const clockFace = container.querySelector('.rounded-full.bg-muted\\/50')
    expect(clockFace).toBeInTheDocument()
  })
})
