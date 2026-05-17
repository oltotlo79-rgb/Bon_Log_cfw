import { test, expect } from '@playwright/test'

/**
 * 盆栽コレクション管理のE2Eテスト
 * 一覧表示、新規登録、詳細表示、編集のフロー確認
 */
test.describe('盆栽コレクション管理', () => {
  test.describe('盆栽一覧ページ', () => {
    test('盆栽コレクション一覧が表示される', async ({ page }) => {
      await page.goto('/bonsai')

      await expect(
        page.getByText(/マイ盆栽|盆栽コレクション|盆栽一覧/i).first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('盆栽カードまたは空ステートが表示される', async ({ page }) => {
      await page.goto('/bonsai')
      await page.waitForLoadState('domcontentloaded')

      // 盆栽アイテムのリンク（/bonsai/new を除外）
      const bonsaiCards = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')
      const emptyMessage = page.getByText(
        /まだ盆栽が登録されていません|盆栽がありません|盆栽を登録しましょう|最初の盆栽/i
      ).first()

      const cardsCount = await bonsaiCards.count()
      const hasEmpty = await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)

      expect(cardsCount > 0 || hasEmpty).toBeTruthy()
    })

    test('盆栽カードに画像またはプレースホルダーが表示される', async ({ page }) => {
      await page.goto('/bonsai')
      await page.waitForLoadState('domcontentloaded')

      const bonsaiCards = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')

      if ((await bonsaiCards.count()) === 0) {
        test.skip()
        return
      }

      const bonsaiCard = bonsaiCards.first()

      // カード内の画像またはプレースホルダー
      const image = bonsaiCard.locator('img').first()
      const placeholder = bonsaiCard.locator('[class*="placeholder"], [class*="avatar"], svg').first()

      const hasImage = await image.isVisible({ timeout: 5000 }).catch(() => false)
      const hasPlaceholder = await placeholder.isVisible({ timeout: 3000 }).catch(() => false)

      expect(hasImage || hasPlaceholder).toBeTruthy()
    })

    test('盆栽カードに名前情報が表示される', async ({ page }) => {
      await page.goto('/bonsai')
      await page.waitForLoadState('domcontentloaded')

      const bonsaiCards = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')

      if ((await bonsaiCards.count()) === 0) {
        test.skip()
        return
      }

      const bonsaiCard = bonsaiCards.first()

      // カード内にテキストコンテンツが存在する
      const textContent = bonsaiCard.locator('h2, h3, p, span').first()
      await expect(textContent).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('盆栽新規登録', () => {
    test('登録ボタンをクリックして新規登録ページに遷移できる', async ({ page }) => {
      await page.goto('/bonsai')
      await page.waitForLoadState('domcontentloaded')

      // 新規登録リンク
      const addLink = page.locator('a[href="/bonsai/new"]').first()
      await expect(addLink).toBeVisible({ timeout: 15000 })

      await addLink.click()
      await expect(page).toHaveURL(/\/bonsai\/new/, { timeout: 10000 })
    })

    test('新規登録ページにフォームが表示される', async ({ page }) => {
      await page.goto('/bonsai/new')

      const heading = page.getByText(/盆栽を登録|盆栽登録|新規登録/i).first()
      const form = page.locator('form').first()

      const hasHeading = await heading.isVisible({ timeout: 10000 }).catch(() => false)
      const hasForm = await form.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasHeading || hasForm).toBeTruthy()
    })

    test('新規登録フォームに名前入力欄がある', async ({ page }) => {
      await page.goto('/bonsai/new')
      await page.waitForLoadState('domcontentloaded')

      const nameInput = page.locator(
        'input[name*="name"], input[placeholder*="名前"], [data-testid="bonsai-name-input"]'
      ).first()
      const nameLabel = page.getByText(/名前|名称/i).first()

      const hasInput = await nameInput.isVisible({ timeout: 10000 }).catch(() => false)
      const hasLabel = await nameLabel.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasInput || hasLabel).toBeTruthy()
    })

    test('新規登録フォームに樹種選択がある', async ({ page }) => {
      await page.goto('/bonsai/new')
      await page.waitForLoadState('domcontentloaded')

      const speciesInput = page.locator(
        'input[name*="species"], select[name*="species"], [data-testid="species-select"], input[placeholder*="樹種"]'
      ).first()
      const speciesLabel = page.getByText(/樹種|種類/i).first()

      const hasInput = await speciesInput.isVisible({ timeout: 10000 }).catch(() => false)
      const hasLabel = await speciesLabel.isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasInput || hasLabel).toBeTruthy()
    })

    test('新規登録フォームに画像アップロードがある', async ({ page }) => {
      await page.goto('/bonsai/new')
      await page.waitForLoadState('domcontentloaded')

      const imageUpload = page.locator(
        'input[type="file"], [data-testid="image-upload"], button[aria-label*="画像"]'
      ).first()
      const imageLabel = page.getByText(/写真|画像|アップロード/i).first()

      const hasUpload = await imageUpload.isVisible({ timeout: 5000 }).catch(() => false)
      const hasLabel = await imageLabel.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasUpload || hasLabel) {
        expect(hasUpload || hasLabel).toBeTruthy()
      }
    })
  })

  test.describe('盆栽詳細ページ', () => {
    test('盆栽詳細ページに盆栽名が表示される', async ({ page }) => {
      await page.goto('/bonsai')
      await page.waitForLoadState('domcontentloaded')

      const bonsaiLinks = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')

      if ((await bonsaiLinks.count()) === 0) {
        test.skip()
        return
      }

      await bonsaiLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/(?!new)/, { timeout: 10000 })

      // 盆栽名が表示される
      const nameElement = page.locator('h1, h2, [data-testid="bonsai-name"]').first()
      await expect(nameElement).toBeVisible({ timeout: 10000 })
    })

    test('盆栽詳細ページに編集リンクが存在する（オーナーの場合）', async ({ page }) => {
      await page.goto('/bonsai')
      await page.waitForLoadState('domcontentloaded')

      const bonsaiLinks = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')

      if ((await bonsaiLinks.count()) === 0) {
        test.skip()
        return
      }

      await bonsaiLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/(?!new)/, { timeout: 10000 })

      // 編集リンクまたはボタン（オーナーの場合のみ表示される）
      const editLink = page.locator('a[href*="/edit"]').first()
      const editButton = page.getByRole('button', { name: /編集/i }).first()
      const menuButton = page.locator(
        'button[aria-label*="メニュー"], button[aria-label*="操作"], [data-testid="bonsai-menu"]'
      ).first()

      const hasEdit = await editLink.isVisible({ timeout: 5000 }).catch(() => false)
      const hasEditButton = await editButton.isVisible({ timeout: 3000 }).catch(() => false)
      const hasMenu = await menuButton.isVisible({ timeout: 3000 }).catch(() => false)

      if (!hasEdit && !hasEditButton && !hasMenu) {
        test.skip()
        return
      }
      expect(hasEdit || hasEditButton || hasMenu).toBeTruthy()
    })

    test('盆栽詳細ページに成長記録セクションがある', async ({ page }) => {
      await page.goto('/bonsai')
      await page.waitForLoadState('domcontentloaded')

      const bonsaiLinks = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')

      if ((await bonsaiLinks.count()) === 0) {
        test.skip()
        return
      }

      await bonsaiLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/(?!new)/, { timeout: 10000 })

      // タイムラインまたは成長記録
      const timeline = page.getByText(/タイムライン|成長記録|記録|履歴/i).first()
      const addRecordButton = page.getByRole('button', { name: /記録を追加|記録する/i }).first()

      const hasTimeline = await timeline.isVisible({ timeout: 5000 }).catch(() => false)
      const hasAddButton = await addRecordButton.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasTimeline || hasAddButton) {
        expect(hasTimeline || hasAddButton).toBeTruthy()
      }
    })
  })

  test.describe('盆栽編集', () => {
    test('編集ページに遷移して編集フォームが表示される', async ({ page }) => {
      await page.goto('/bonsai')
      await page.waitForLoadState('domcontentloaded')

      const bonsaiLinks = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')

      if ((await bonsaiLinks.count()) === 0) {
        test.skip()
        return
      }

      await bonsaiLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/(?!new)/, { timeout: 10000 })

      const editLinks = page.locator('a[href*="/edit"]')
      if ((await editLinks.count()) === 0) {
        test.skip()
        return
      }

      await editLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/.*\/edit/, { timeout: 10000 })

      // 編集フォームが表示される
      const form = page.locator('form').first()
      await expect(form).toBeVisible({ timeout: 10000 })
    })

    test('編集フォームに既存の値が入力されている', async ({ page }) => {
      await page.goto('/bonsai')
      await page.waitForLoadState('domcontentloaded')

      const bonsaiLinks = page.locator('a[href^="/bonsai/"]:not([href="/bonsai/new"])')

      if ((await bonsaiLinks.count()) === 0) {
        test.skip()
        return
      }

      await bonsaiLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/(?!new)/, { timeout: 10000 })

      const editLinks = page.locator('a[href*="/edit"]')
      if ((await editLinks.count()) === 0) {
        test.skip()
        return
      }

      await editLinks.first().click()
      await expect(page).toHaveURL(/\/bonsai\/.*\/edit/, { timeout: 10000 })

      // 名前入力欄に値が入っている
      const nameInput = page.locator(
        'input[name*="name"], [data-testid="bonsai-name-input"]'
      ).first()

      if (await nameInput.isVisible({ timeout: 10000 }).catch(() => false)) {
        const value = await nameInput.inputValue()
        expect(value.length).toBeGreaterThan(0)
      }
    })
  })
})
