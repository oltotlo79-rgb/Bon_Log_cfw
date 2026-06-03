/**
 * auth ページ群のダークモード可読性 回帰テスト。
 *
 * Why: 過去にこれらのテキスト/ボタンが dark variant 抜けで読みにくい問題が発生していた。
 * 視覚的な再発を機械検知するため、Tailwind の `dark:` 修飾子の存在を className レベルで保証する。
 *
 * - /register, /verify-email, /register/verify-email-sent: 見出し (text-sumi) に dark:text-washi が併記されているか
 * - 共通 Button (default variant) の濃墨グラデーションが dark mode で反転されているか
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (rel: string) => readFileSync(resolve(rel), 'utf8')

describe('auth ページの dark mode 見出し色', () => {
  it('register/page.tsx の h1 は dark:text-washi を持つ', () => {
    const src = read('app/(auth)/register/page.tsx')
    // 見出し行が text-sumi と dark:text-washi の両方を含むことを保証する
    expect(src).toMatch(/text-sumi[^"]*dark:text-washi|dark:text-washi[^"]*text-sumi/)
  })

  it('register/verify-email-sent/page.tsx の h2 は dark:text-washi を持つ', () => {
    const src = read('app/(auth)/register/verify-email-sent/page.tsx')
    expect(src).toMatch(/text-sumi[^"]*dark:text-washi|dark:text-washi[^"]*text-sumi/)
  })

  it('verify-email/page.tsx の h1 は dark:text-washi を持つ', () => {
    const src = read('app/(auth)/verify-email/page.tsx')
    expect(src).toMatch(/text-sumi[^"]*dark:text-washi|dark:text-washi[^"]*text-sumi/)
  })
})

describe('auth レイアウトの dark mode は背景画像を覆わない', () => {
  const src = read('app/(auth)/layout.tsx')

  it('カード div は dark mode で透明背景になっている (overlay を持たない)', () => {
    // `dark:bg-black/...` や `dark:bg-white/...` のような不透明 overlay が
    // 残っていないことを保証する。再発すると背景の墨絵が再び見えなくなる。
    expect(src).not.toMatch(/dark:bg-black\/\d/)
    expect(src).not.toMatch(/dark:bg-white\/\d/)
    expect(src).toMatch(/dark:bg-transparent/)
  })

  it('カード div は dark mode で backdrop-blur を無効化している', () => {
    // backdrop-blur があると背面画像が滲んで景観要素として機能しないため、
    // dark mode では明示的に無効化する。
    expect(src).toMatch(/dark:backdrop-blur-none/)
  })
})

describe('共通 default Button の dark gradient 反転', () => {
  // globals.css の [data-slot="button"][data-variant="default"] override が
  // theme-aware であること (dark で背景 grad が反転している) を保証する。
  // 元実装は単一のダーク grad のみで、dark mode の primary-foreground (黒寄り) と
  // 衝突して文字が読めなくなる事象があった。
  const css = read('app/globals.css')

  it('default variant ボタンに通常 (light) gradient ルールが存在する', () => {
    // 行頭 `[data-slot=...]` から開始するブロックを (=「.dark 接頭辞なし」を) 探す
    expect(css).toMatch(
      /^\[data-slot="button"\]\[data-variant="default"\][\s\S]*?background-image:\s*linear-gradient/m,
    )
  })

  it('default variant ボタンに dark gradient override ルールが存在する', () => {
    expect(css).toMatch(
      /\.dark\s+\[data-slot="button"\]\[data-variant="default"\][\s\S]*?background-image:\s*linear-gradient/,
    )
  })

  it('dark mode 用 gradient は反転して薄い色 (oklch >= 0.7) を含む', () => {
    // dark mode のセレクタブロック内に oklch(0.7+) が含まれることで「反転 (light grad)」を保証する。
    // この行が消えると暗背景+暗文字に戻り読みにくくなる。
    const darkBlock = css.match(
      /\.dark\s+\[data-slot="button"\]\[data-variant="default"\]:not\(:disabled\):not\(\.btn-washi\)\s*\{([^}]+)\}/,
    )
    expect(darkBlock).not.toBeNull()
    expect(darkBlock?.[1]).toMatch(/oklch\(0\.[789]/)
  })
})
