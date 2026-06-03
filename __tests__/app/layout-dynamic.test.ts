/**
 * Root layout の dynamic rendering 保証テスト。
 *
 * Why: strict CSP (nonce + strict-dynamic) はリクエスト毎に変わる nonce を
 * `<script>` タグに適用する必要があるが、static prerendered なページでは
 * これが不可能。app/layout.tsx で `headers()` を呼ぶことで全ルートが
 * dynamic rendering に切り替わり、proxy が設定する nonce が適用される。
 *
 * このテストは `headers()` 呼び出しが消えると即座に fail し、本番デプロイ前に
 * 「ヒーロー画像が表示されない (= ハイドレーションが CSP に弾かれる)」事象の
 * 再発を検知する。
 *
 * 起因コミット: 22370406 (CSP 厳格化)、fc4a9736 (request CSP header 修正)
 *                 → さらに static prerender の問題が残っており、本テスト追加コミットで修正
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('app/layout.tsx: dynamic rendering for CSP nonce', () => {
  const layoutSource = readFileSync(resolve('app/layout.tsx'), 'utf8')

  it('headers() を import している (動的化のため必須)', () => {
    expect(layoutSource).toMatch(/from\s+["']next\/headers["']/)
    expect(layoutSource).toMatch(/import\s+\{[^}]*\bheaders\b[^}]*\}\s+from\s+["']next\/headers["']/)
  })

  it('RootLayout で headers() を呼んでいる (これがないと全ルートが static prerender される)', () => {
    // 'use server' などの構文形式に依らず、layout 内で headers() を呼んでいることを確認する
    expect(layoutSource).toMatch(/(?:await\s+headers\s*\(\s*\))/)
  })

  it('RootLayout が async function である (headers() は dynamic API なので必須)', () => {
    expect(layoutSource).toMatch(/export\s+default\s+async\s+function\s+RootLayout/)
  })
})
