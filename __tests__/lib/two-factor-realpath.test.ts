// @vitest-environment node
/**
 * verifyTOTP の「本物の otplib を通した」検証テスト。
 *
 * two-factor.test.ts は otplib をモックしているため、verifyTOTP の TOTP 検証分岐は
 * モックの戻り値を確認しているにすぎない。本ファイルは otplib をモックせず、
 * 実際に生成した現在時刻のトークンが verifyTOTP で受理されることを検証し、
 * 実運用の検証ロジック（正規化・時刻トレランス・base32 秘密）を担保する。
 */

import { describe, it, expect } from 'vitest'
import { OTP } from 'otplib'
import { verifyTOTP, generateSecret } from '@/lib/two-factor'

describe('verifyTOTP（otplib 実経路）', () => {
  it('現在時刻の正しい TOTP トークンを受理する', async () => {
    const secret = generateSecret()
    // lib と同一設定（strategy: 'totp', 既定 30 秒 / 6 桁 / SHA1）でトークンを生成する
    const token = await new OTP({ strategy: 'totp' }).generate({ secret })

    await expect(verifyTOTP(token, secret)).resolves.toBe(true)
  })

  it('別シークレットで生成したトークンは拒否する', async () => {
    const secret = generateSecret()
    const otherSecret = generateSecret()
    const tokenForOther = await new OTP({ strategy: 'totp' }).generate({ secret: otherSecret })

    await expect(verifyTOTP(tokenForOther, secret)).resolves.toBe(false)
  })

  it('生成トークンにハイフン/空白が混じっても正規化して受理する', async () => {
    const secret = generateSecret()
    const token = await new OTP({ strategy: 'totp' }).generate({ secret })
    const spaced = `${token.slice(0, 3)} ${token.slice(3)}`

    await expect(verifyTOTP(spaced, secret)).resolves.toBe(true)
  })
})
