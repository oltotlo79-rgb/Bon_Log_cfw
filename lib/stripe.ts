/**
 * @module lib/stripe
 * Stripe Node.js SDK の遅延初期化シングルトン。
 *
 * Why Proxy + 遅延初期化:
 *   Next.js は build 時に全モジュールを評価するため、`STRIPE_SECRET_KEY`
 *   未設定環境 (CI / E2E / Lighthouse / 一部 preview) で `new Stripe(...)` が
 *   throw すると build が落ちる。Proxy で実アクセスまで初期化を遅らせる。
 */

import Stripe from 'stripe'

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  })
}

let _stripe: Stripe | null = null

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripe) {
      _stripe = getStripe()
    }
    return (_stripe as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const STRIPE_PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY
export const STRIPE_PRICE_ID_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY
