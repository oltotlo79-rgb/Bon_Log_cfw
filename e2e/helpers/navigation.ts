/**
 * @module e2e/helpers/navigation
 *
 * E2E テストの「クリック → URL 遷移」を atomic に待機する共通ヘルパー。
 *
 * Why: 以下のような非 atomic パターンが CI で flaky / failing になっていた:
 *
 *   await link.click()
 *   await expect(page).toHaveURL(/\/foo\//, { timeout: 10000 })
 *
 * 問題:
 *   - クリックが起きた瞬間に Next.js Link が hydrate されていないと、`<a>` の native
 *     ナビゲーションが発火する前に React の onClick が阻害して URL 更新が遅れる。
 *   - `expect(...).toHaveURL` は polling だが、polling 開始時点で既にナビゲーションが
 *     開始済みだと「最初の URL を見て pass」してしまったり、逆に SPA 遷移完了前に
 *     timeout に達するケースがある。
 *
 * 解決:
 *   `Promise.all([page.waitForURL(regex), locator.click()])` のように、
 *   先に `waitForURL` を仕掛けてからクリックすることで、ナビゲーション開始から完了まで
 *   確実に補足できる。Next.js App Router の startTransition + router.push の遅延にも追随する。
 *
 * 参考: https://playwright.dev/docs/navigations#navigation-events
 */

import type { Locator, Page } from '@playwright/test'

const DEFAULT_NAV_TIMEOUT_MS = 15_000

type ClickAndWaitOptions = {
  /** ナビゲーション完了までの最大待機時間 (ms)。CI の遅延を考慮してデフォルト 15s。 */
  timeout?: number
}

/**
 * `locator.click()` と `page.waitForURL(url)` を atomic に並列実行する。
 *
 * クリックを起点に発生するナビゲーション (Next.js Link / router.push / form submit など)
 * を確実に補足する。click だけ先に発火させてから `toHaveURL` で polling するパターンは
 * hydration / startTransition の遅延で flake するため、新規 E2E では本ヘルパーを使う。
 */
export async function clickAndWaitForUrl(
  page: Page,
  locator: Locator,
  url: string | RegExp,
  options: ClickAndWaitOptions = {},
): Promise<void> {
  const timeout = options.timeout ?? DEFAULT_NAV_TIMEOUT_MS
  await Promise.all([
    page.waitForURL(url, { timeout }),
    locator.click(),
  ])
}
