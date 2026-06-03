import { test as setup, expect } from '@playwright/test'
import { getFeedPageReadyLocator } from './locators'

const AUTH_FILE = 'e2e/.auth/user.json'

/**
 * 認証セットアップ
 * シードで作成済みのE2Eテスト用ユーザーでログインし、storageStateを保存する。
 * CI の standalone は初回応答が遅いため、タイムアウトを十分に取り、1回だけリトライする。
 */
setup('authenticate', async ({ page }) => {
  const email = 'e2e-test@example.com'
  const password = 'TestPassword123!'

  const tryLogin = async (): Promise<boolean> => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.getByLabel(/メールアドレス/i).waitFor({ state: 'visible', timeout: 20000 })
    await page.getByLabel(/メールアドレス/i).fill(email)
    await page.locator('#password').first().fill(password)
    await page.getByRole('button', { name: 'ログイン', exact: true }).click()
    try {
      // 新規ユーザー扱いだとログイン後に /onboarding へ誘導され得る。
      // シード側で onboardedAt を設定済みだが、未シードの永続DB等でも fixture が壊れないよう完了させる。
      await expect(page).toHaveURL(/\/(feed|onboarding)/, { timeout: 60000 })
    } catch {
      return false
    }
    if (page.url().includes('/onboarding')) {
      await page.getByRole('button', { name: 'はじめる' }).click()
      await expect(page).toHaveURL(/\/feed/, { timeout: 30000 }).catch(() => {})
    }
    return page.url().includes('/feed')
  }

  let reachedFeed = await tryLogin()
  if (!reachedFeed) {
    reachedFeed = await tryLogin()
  }
  await expect(page).toHaveURL(/\/feed/, { timeout: 15000 })
  await page.waitForLoadState('domcontentloaded')

  const feedReady = getFeedPageReadyLocator(page)
  await expect(feedReady).toBeVisible({ timeout: 45000 })

  // Cookie 同意バナーを dismiss しておく。
  // バナーは画面下部に position:fixed で常駐し、リンクや検索ボタンの click を pointer-events で
  // 遮断するため、E2E テストで何百ものテストが flaky / failing になる原因になっていた。
  // localStorage に 'essential' を書き込むことで、CookieConsent が render されなくなる。
  // storageState（このあと保存）に localStorage も含まれるので、全認証テストで再表示されない。
  await page.evaluate(() => {
    localStorage.setItem('cookie-consent', 'essential')
  })

  await page.context().storageState({ path: AUTH_FILE })
})
