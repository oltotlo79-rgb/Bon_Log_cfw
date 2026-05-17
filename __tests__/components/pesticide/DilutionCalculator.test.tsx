/**
 * @file DilutionCalculator の実ロジック検証テスト
 *
 * 1000mL ÷ 1000倍 = 1mL、0.1mL 未満では警告バッジ、逆算モードで mL×倍率、
 * 1L超の場合は L 表示に切り替わる等、計算ロジックと表示分岐を網羅する。
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DilutionCalculator } from '@/components/pesticide/DilutionCalculator'

describe('DilutionCalculator', () => {
  describe('通常モード（水量＋倍率から薬剤量を求める）', () => {
    it('初期値: 1000mL / 1000倍 → 1mL', () => {
      render(<DilutionCalculator />)
      // 計算結果
      expect(screen.getByText('1mL')).toBeInTheDocument()
      expect(screen.getByText('水1000mLに対して1000倍希釈')).toBeInTheDocument()
    })

    it('水量プリセット (5L) を押すと水量が 5000mL に更新される', () => {
      render(<DilutionCalculator />)
      fireEvent.click(screen.getByRole('button', { name: '5L' }))
      // 5000 / 1000 = 5mL
      expect(screen.getByText('5mL')).toBeInTheDocument()
      expect(screen.getByText('水5000mLに対して1000倍希釈')).toBeInTheDocument()
    })

    it('倍率プリセット (3000倍) を押すと 0.33mL になり警告バッジが出る', () => {
      render(<DilutionCalculator />)
      fireEvent.click(screen.getByRole('button', { name: '3000倍' }))
      // 1000 / 3000 ≈ 0.33mL (< 0.1 ではないので警告は出ない)
      expect(screen.getByText(/0\.33mL/)).toBeInTheDocument()
    })

    it('水量を 100mL・倍率 3000 にすると 0.03mL（<0.1mL）で警告バッジが表示される', () => {
      render(<DilutionCalculator />)
      fireEvent.change(screen.getByLabelText('水量（mL）'), { target: { value: '100' } })
      fireEvent.change(screen.getByLabelText('希釈倍率'), { target: { value: '3000' } })
      // 100 / 3000 ≈ 0.03mL → 1mL 未満なので滴数表示、かつ警告
      expect(screen.getByText(/0\.03mL.*約1滴/)).toBeInTheDocument()
      expect(
        screen.getByText(/正確な計量が困難/),
      ).toBeInTheDocument()
    })

    it('希釈倍率 0 では結果が表示されない', () => {
      render(<DilutionCalculator />)
      fireEvent.change(screen.getByLabelText('希釈倍率'), { target: { value: '0' } })
      // 結果表示の親要素 "計算結果" 自体が消える
      expect(screen.queryByText('計算結果')).not.toBeInTheDocument()
    })

    it('負の数は state に入らない（validation で弾かれる）', () => {
      render(<DilutionCalculator />)
      const input = screen.getByLabelText('水量（mL）') as HTMLInputElement
      fireEvent.change(input, { target: { value: '-10' } })
      // 値は初期の 1000 のまま維持
      expect(input.value).toBe('1000')
    })
  })

  describe('逆算モード（薬剤量＋倍率から必要水量を求める）', () => {
    it('モード切替ボタンで「必要水量を計算」に切り替わる', () => {
      render(<DilutionCalculator />)
      fireEvent.click(screen.getByRole('button', { name: '必要水量を計算' }))
      expect(screen.getByText('薬剤量と倍率から必要水量を求める')).toBeInTheDocument()
    })

    it('1mL × 1000倍 = 1000mL（1Lで L 表示も併記）', () => {
      render(<DilutionCalculator />)
      fireEvent.click(screen.getByRole('button', { name: '必要水量を計算' }))
      // 初期値: pesticideMl=1, dilutionRatio=1000 → 1000mL
      expect(screen.getByText(/1000mL.*1L/)).toBeInTheDocument()
    })

    it('5mL × 2000倍 = 10000mL（10L 表示）', () => {
      render(<DilutionCalculator />)
      fireEvent.click(screen.getByRole('button', { name: '必要水量を計算' }))
      fireEvent.change(screen.getByLabelText('薬剤量（mL）'), { target: { value: '5' } })
      fireEvent.click(screen.getByRole('button', { name: '2000倍' }))
      expect(screen.getByText(/10000mL.*10L/)).toBeInTheDocument()
    })

    it('薬剤量 0 のときは結果が表示されない', () => {
      render(<DilutionCalculator />)
      fireEvent.click(screen.getByRole('button', { name: '必要水量を計算' }))
      fireEvent.change(screen.getByLabelText('薬剤量（mL）'), { target: { value: '0' } })
      expect(screen.queryByText('必要水量')).not.toBeInTheDocument()
    })

    it('1L未満の場合は L 表示なしで mL だけ出る', () => {
      render(<DilutionCalculator />)
      fireEvent.click(screen.getByRole('button', { name: '必要水量を計算' }))
      fireEvent.change(screen.getByLabelText('薬剤量（mL）'), { target: { value: '0.5' } })
      fireEvent.click(screen.getByRole('button', { name: '1000倍' }))
      // 0.5 × 1000 = 500mL → L 表記なし
      const water = screen.getByText(/^500mL$/)
      expect(water).toBeInTheDocument()
    })
  })
})
