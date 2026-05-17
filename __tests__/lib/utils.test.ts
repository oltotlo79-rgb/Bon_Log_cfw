// @vitest-environment node

import { cn, getEndOfDay, getStartOfToday, getStartOfNDaysAgo } from '@/lib/utils'

describe('cn (className utility)', () => {
  // ============================================================
  // 基本的な文字列結合
  // ============================================================

  describe('基本的な文字列結合', () => {
    it('単一の文字列を返す', () => {
      expect(cn('text-red-500')).toBe('text-red-500')
    })

    it('複数の文字列を結合する', () => {
      expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
    })

    it('3つ以上の文字列を結合する', () => {
      expect(cn('p-4', 'm-2', 'rounded', 'shadow')).toBe('p-4 m-2 rounded shadow')
    })

    it('空文字列を無視する', () => {
      expect(cn('text-red-500', '', 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
    })

    it('引数なしで空文字列を返す', () => {
      expect(cn()).toBe('')
    })
  })

  // ============================================================
  // 条件付きクラス
  // ============================================================

  describe('条件付きクラス', () => {
    it('trueの条件はクラスを含める', () => {
      expect(cn('base', true && 'active')).toBe('base active')
    })

    it('falseの条件はクラスを除外する', () => {
      expect(cn('base', false && 'active')).toBe('base')
    })

    it('nullを無視する', () => {
      expect(cn('base', null, 'end')).toBe('base end')
    })

    it('undefinedを無視する', () => {
      expect(cn('base', undefined, 'end')).toBe('base end')
    })

    it('複数の条件を組み合わせる', () => {
      const isActive = true
      const isDisabled = false
      const isHovered = true

      expect(cn(
        'base',
        isActive && 'active',
        isDisabled && 'disabled',
        isHovered && 'hovered'
      )).toBe('base active hovered')
    })

    it('0（数値）は含めない', () => {
      expect(cn('base', 0 && 'zero')).toBe('base')
    })
  })

  // ============================================================
  // オブジェクト形式
  // ============================================================

  describe('オブジェクト形式', () => {
    it('trueのキーのみを含める', () => {
      expect(cn({ 'text-red-500': true, 'text-blue-500': false }))
        .toBe('text-red-500')
    })

    it('すべてtrueの場合すべて含める', () => {
      expect(cn({ 'p-4': true, 'm-2': true, 'rounded': true }))
        .toBe('p-4 m-2 rounded')
    })

    it('すべてfalseの場合空文字列', () => {
      expect(cn({ 'p-4': false, 'm-2': false })).toBe('')
    })

    it('文字列とオブジェクトを組み合わせる', () => {
      expect(cn('base', { 'active': true, 'disabled': false }))
        .toBe('base active')
    })

    it('空のオブジェクトは無視する', () => {
      expect(cn('base', {}, 'end')).toBe('base end')
    })
  })

  // ============================================================
  // 配列形式
  // ============================================================

  describe('配列形式', () => {
    it('配列内の文字列を結合する', () => {
      expect(cn(['p-4', 'm-2'])).toBe('p-4 m-2')
    })

    it('ネストした配列を処理する', () => {
      expect(cn(['p-4', ['m-2', 'rounded']])).toBe('p-4 m-2 rounded')
    })

    it('配列内のfalsy値を無視する', () => {
      expect(cn(['p-4', null, undefined, false, 'm-2'])).toBe('p-4 m-2')
    })

    it('配列と文字列を組み合わせる', () => {
      expect(cn('base', ['active', 'hover'], 'end')).toBe('base active hover end')
    })
  })

  // ============================================================
  // Tailwind CSSの競合解決（twMerge）
  // ============================================================

  describe('Tailwind CSSの競合解決', () => {
    it('同じプロパティの競合を解決する（padding）', () => {
      expect(cn('p-4', 'p-2')).toBe('p-2')
    })

    it('px/py と p の競合を解決する', () => {
      expect(cn('px-4', 'py-2', 'p-6')).toBe('p-6')
    })

    it('text-colorの競合を解決する', () => {
      expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    })

    it('bg-colorの競合を解決する', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500')
    })

    it('marginの競合を解決する', () => {
      expect(cn('m-4', 'm-8')).toBe('m-8')
    })

    it('異なるプロパティは競合しない', () => {
      expect(cn('p-4', 'm-2', 'text-red-500'))
        .toBe('p-4 m-2 text-red-500')
    })

    it('条件付きで上書きする', () => {
      const isPrimary = true
      expect(cn('text-gray-500', isPrimary && 'text-blue-500'))
        .toBe('text-blue-500')
    })

    it('widthの競合を解決する', () => {
      expect(cn('w-full', 'w-1/2')).toBe('w-1/2')
    })

    it('heightの競合を解決する', () => {
      expect(cn('h-screen', 'h-64')).toBe('h-64')
    })

    it('flexの競合を解決する', () => {
      expect(cn('flex-row', 'flex-col')).toBe('flex-col')
    })

    it('justify/alignの競合を解決する', () => {
      expect(cn('justify-start', 'justify-center')).toBe('justify-center')
      expect(cn('items-start', 'items-center')).toBe('items-center')
    })

    it('roundedの競合を解決する', () => {
      expect(cn('rounded-sm', 'rounded-lg')).toBe('rounded-lg')
    })

    it('shadowの競合を解決する', () => {
      expect(cn('shadow-sm', 'shadow-lg')).toBe('shadow-lg')
    })

    it('font-weightの競合を解決する', () => {
      expect(cn('font-normal', 'font-bold')).toBe('font-bold')
    })

    it('text-sizeの競合を解決する', () => {
      expect(cn('text-sm', 'text-lg')).toBe('text-lg')
    })
  })

  // ============================================================
  // 実践的なユースケース
  // ============================================================

  describe('実践的なユースケース', () => {
    it('ボタンコンポーネントのスタイリング', () => {
      const variant: string = 'primary'
      const disabled = false
      const className = 'custom-class'

      const result = cn(
        'px-4 py-2 rounded',
        variant === 'primary' && 'bg-blue-500 text-white',
        variant === 'secondary' && 'bg-gray-200 text-gray-800',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )

      expect(result).toBe('px-4 py-2 rounded bg-blue-500 text-white custom-class')
    })

    it('親からのclassNameで上書きする', () => {
      const baseClasses = 'p-4 bg-white'
      const propClassName = 'p-8 bg-gray-100'

      expect(cn(baseClasses, propClassName)).toBe('p-8 bg-gray-100')
    })

    it('状態に応じたスタイリング', () => {
      const isOpen = true
      const isError = false
      const isLoading = true

      expect(cn(
        'transition-all',
        isOpen && 'opacity-100 visible',
        !isOpen && 'opacity-0 invisible',
        isError && 'border-red-500',
        isLoading && 'animate-pulse'
      )).toBe('transition-all opacity-100 visible animate-pulse')
    })

    it('レスポンシブクラスの組み合わせ', () => {
      expect(cn(
        'w-full',
        'md:w-1/2',
        'lg:w-1/3'
      )).toBe('w-full md:w-1/2 lg:w-1/3')
    })

    it('ホバー/フォーカス状態のクラス', () => {
      expect(cn(
        'bg-white',
        'hover:bg-gray-100',
        'focus:ring-2',
        'focus:ring-blue-500'
      )).toBe('bg-white hover:bg-gray-100 focus:ring-2 focus:ring-blue-500')
    })

    it('ダークモード対応', () => {
      expect(cn(
        'bg-white text-black',
        'dark:bg-gray-800 dark:text-white'
      )).toBe('bg-white text-black dark:bg-gray-800 dark:text-white')
    })
  })

  // ============================================================
  // エッジケース
  // ============================================================

  describe('エッジケース', () => {
    it('非常に長いクラス名を処理する', () => {
      const longClassName = 'a'.repeat(100)
      expect(cn(longClassName)).toBe(longClassName)
    })

    it('特殊文字を含むクラス名', () => {
      expect(cn('[&>*]:p-4')).toBe('[&>*]:p-4')
    })

    it('任意の値を含むクラス名', () => {
      expect(cn('w-[200px]', 'h-[100px]')).toBe('w-[200px] h-[100px]')
    })

    it('複数のスペースを正規化する', () => {
      expect(cn('p-4  ', '  m-2')).toBe('p-4 m-2')
    })

    it('数値0は文字列として扱わない', () => {
      // 0 && 'class' は 0 を返すので、クラスには含まれない
      expect(cn(0 as unknown as string)).toBe('')
    })
  })
})

describe('getEndOfDay', () => {
  it('引数なしの場合は今日の23:59:59.999を返す', () => {
    const result = getEndOfDay()
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
    expect(result.getMilliseconds()).toBe(999)
  })

  it('指定日の23:59:59.999を返す', () => {
    const input = new Date('2025-06-15T10:30:00')
    const result = getEndOfDay(input)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(5)
    expect(result.getDate()).toBe(15)
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
    expect(result.getMilliseconds()).toBe(999)
  })

  it('元のDateを変更しない', () => {
    const input = new Date('2025-06-15T10:30:00')
    getEndOfDay(input)
    expect(input.getHours()).toBe(10)
  })
})

describe('getStartOfToday', () => {
  it('今日の0:00:00.000を返す', () => {
    const result = getStartOfToday()
    const now = new Date()
    expect(result.getFullYear()).toBe(now.getFullYear())
    expect(result.getMonth()).toBe(now.getMonth())
    expect(result.getDate()).toBe(now.getDate())
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })
})

describe('getStartOfNDaysAgo', () => {
  it('N日前の0:00:00.000を返す', () => {
    const result = getStartOfNDaysAgo(7)
    const expected = new Date()
    expected.setDate(expected.getDate() - 7)
    expected.setHours(0, 0, 0, 0)
    expect(result.getTime()).toBe(expected.getTime())
  })
})
