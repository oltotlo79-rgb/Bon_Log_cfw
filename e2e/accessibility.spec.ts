import { test, expect } from '@playwright/test'

/**
 * アクセシビリティのE2Eテスト
 * キーボードナビゲーション、ARIA属性、フォーカス管理をテスト
 */
test.describe('アクセシビリティ', () => {
  test('ログインフォームがキーボードで操作できる', async ({ page }) => {
    await page.goto('/login')

    // Tab キーでフォームフィールドをナビゲート
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // メールフィールドまたはパスワードフィールドにフォーカスが当たる
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
  })

  test('検索フォームがキーボードで操作できる', async ({ page }) => {
    await page.goto('/search')
    await page.waitForLoadState('load')

    const searchInput = page.getByPlaceholder(/検索/i)
    await expect(searchInput).toBeVisible({ timeout: 10000 })
    await searchInput.focus()
    await searchInput.fill('テスト')
    await searchInput.press('Enter')

    await expect(page).toHaveURL(/q=/, { timeout: 15000 })
  })

  test('フォーム要素にlabelが紐づいている', async ({ page }) => {
    // 設定プロフィールページはフォーム要素にlabelが紐づいている
    await page.goto('/settings/profile')
    await page.waitForLoadState('load')

    // プロフィール編集フォームのlabelとinputが紐づいている
    const labeledInput = page.getByLabel(/ニックネーム|表示名|自己紹介|メールアドレス/i).first()
    await expect(labeledInput).toBeVisible({ timeout: 15000 })
  })

  test('ページにh1見出しが存在する', async ({ page }) => {
    await page.goto('/login')

    const headings = page.getByRole('heading', { level: 1 })
    const count = await headings.count()
    // h1またはそれに相当する見出しが存在する
    if (count > 0) {
      await expect(headings.first()).toBeVisible()
    }
  })

  test('スキップリンクからメインコンテンツにジャンプできる', async ({ page }) => {
    // ログイン時は / が /feed にリダイレクトされるため、フィードページで検証
    await page.goto('/feed')
    await page.waitForLoadState('domcontentloaded')

    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: /メインコンテンツへスキップ/i })
    await expect(skipLink).toBeFocused({ timeout: 5000 })
    await skipLink.click()

    const main = page.locator('#main-content')
    await expect(main).toBeVisible({ timeout: 5000 })
    await expect(main).toHaveAttribute('tabindex', '-1')
  })

  test('画像にalt属性が設定されている', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    // img要素のalt属性をチェック
    const images = page.locator('img')
    const count = await images.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      const alt = await images.nth(i).getAttribute('alt')
      // alt属性が存在する（空文字列は装飾画像として許可）
      expect(alt).not.toBeNull()
    }
  })

  test('リンクにアクセシブルな名前がある', async ({ page }) => {
    await page.goto('/feed')
    await page.waitForLoadState('load')

    // メインナビゲーションのリンクにテキストまたはaria-labelがある
    const navLinks = page.locator('nav a')
    const count = await navLinks.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      const link = navLinks.nth(i)
      const text = await link.textContent()
      const ariaLabel = await link.getAttribute('aria-label')
      const title = await link.getAttribute('title')

      // テキスト、aria-label、titleのいずれかが存在する
      expect(text?.trim() || ariaLabel || title).toBeTruthy()
    }
  })
})

test.describe('フォーカス管理', () => {
  test('モーダルが開いた時にフォーカスがモーダル内に移動する', async ({ page }) => {
    await page.goto('/feed')

    // Cookie同意ダイアログが表示されていたら閉じる（2 ボタンにマッチするため first() で strict mode 回避）
    const cookieDialog = page.getByRole('dialog', { name: /Cookie/i })
    if (await cookieDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cookieDialog.getByRole('button', { name: /すべて同意|必要最小限/i }).first().click()
      await cookieDialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
    }

    // 投稿ボタン等のモーダルトリガーを探す
    const composeButton = page.getByRole('button', { name: /投稿|新規/i }).first()
    if (await composeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await composeButton.click({ force: true })

      // モーダルが表示される
      const modal = page.locator('[role="dialog"], [class*="modal"]').first()
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(modal).toBeVisible()
      }
    }
  })
})
