/**
 * generateBackupCodes の乱数バッファ枯渇フォールバックのテスト
 *
 * generateBackupCodes は `crypto.randomBytes(BACKUP_CODE_LENGTH * 2)` を初期バッファとして
 * モジュラバイアス回避のためリジェクトサンプリングを行う。統計的にはリジェクトが連続して
 * 初期バッファを使い切ることは通常起こらないため、その枯渇時フォールバック（追加バッファ取得）
 * を検証するには crypto.randomBytes を制御する必要がある。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import crypto from 'crypto'
import { generateBackupCodes } from '@/lib/two-factor'
import { BACKUP_CODE_LENGTH, BACKUP_CODE_COUNT } from '@/lib/constants/limits'

describe('generateBackupCodes - 初期バッファ枯渇時のフォールバック', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('初期バッファが全てリジェクト対象でも、追加バッファから正しい長さのコードを生成する', () => {
    const originalRandomBytes = crypto.randomBytes.bind(crypto)
    let callCount = 0

    vi.spyOn(crypto, 'randomBytes').mockImplementation(((size: number) => {
      callCount += 1
      if (callCount === 1) {
        // 初期バッファ: 全バイトを 255 (>= maxValid=252) にしてリジェクトさせ、枯渇を誘発する
        return Buffer.alloc(size, 255)
      }
      if (callCount === 2) {
        // 枯渇後の追加バッファ: 全て有効な値にして1回で完成させる
        const buf = Buffer.alloc(size)
        for (let i = 0; i < size; i++) buf[i] = i
        return buf
      }
      // 2つ目以降のコード生成には実装本来の乱数生成を使う（他コードの生成に影響させない）
      return originalRandomBytes(size)
    }) as typeof crypto.randomBytes)

    const codes = generateBackupCodes()

    expect(codes).toHaveLength(BACKUP_CODE_COUNT)
    codes.forEach((code) => {
      expect(code).toHaveLength(BACKUP_CODE_LENGTH)
      expect(code).toMatch(/^[A-Z0-9]+$/)
    })
    // 追加バッファ経由でも重複コード無しに生成できていること
    expect(new Set(codes).size).toBe(codes.length)
  })
})
