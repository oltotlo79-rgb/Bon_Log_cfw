import { test, expect } from '@playwright/test'

/**
 * 公開ページ（認証不要）のE2Eテスト
 * 未ログイン状態でもアクセスできるページをテスト
 */
test.describe('公開ページ', () => {
  test('トップページが表示される', async ({ page }) => {
    await page.goto('/')

    // トップページのコンテンツが表示される
    await expect(page.getByText(/BON-LOG|盆栽/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('トップページにのぞいてみるボタンが表示される', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('button', { name: 'のぞいてみる' }).first()).toBeVisible({ timeout: 10000 })
  })

  test('ログインページが表示される', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: /ログイン/i })).toBeVisible()
  })

  test('新規登録ページが表示される', async ({ page }) => {
    await page.goto('/register', { waitUntil: 'load', timeout: 60000 })

    // h2見出しまたはフォーム要素がDOMに存在することを確認
    // CI standalone環境ではviewport外にレンダリングされhiddenになることがあるためattachedで検証
    // 両方ヒットするケース（DOM 上に両方存在）でも strict mode に抵触しないよう .first() を付与
    const heading = page.getByRole('heading', { name: /新規登録/i })
    const nicknameInput = page.getByPlaceholder('表示名')
    await expect(heading.or(nicknameInput).first()).toBeAttached({ timeout: 30000 })
  })

  test('パスワードリセットページが表示される', async ({ page }) => {
    await page.goto('/password-reset')

    await expect(page.getByText('パスワードリセット', { exact: true })).toBeVisible()
  })

  test('メール確認送信完了ページが表示される', async ({ page }) => {
    await page.goto('/register/verify-email-sent')

    await expect(page.getByText(/確認メールを送りました/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /ログインページへ/i })).toBeVisible()
  })

  test('verify-email にtokenなしでアクセスするとログインページにリダイレクトされる', async ({ page }) => {
    await page.goto('/verify-email')

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })

  test('verify-email に無効なトークンでアクセスするとエラーメッセージが表示される', async ({ page }) => {
    await page.goto('/verify-email?token=invalid-token-long-enough-to-pass-length-check')

    // エラー文言 or ログインへのリンクのいずれかでエラー画面と判定
    const errorMessage = page.getByText(/メールの確認に失敗しました/i)
    const loginLink = page.getByRole('link', { name: /ログインページへ/i })
    await expect(errorMessage.or(loginLink).first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('ヘルスチェック', () => {
  test('APIヘルスチェックが応答する', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
  })
})

test.describe('SEO・メタデータ', () => {
  test('トップページのtitleが設定されている', async ({ page }) => {
    await page.goto('/')

    const title = await page.title()
    expect(title).toContain('BON-LOG')
  })

  test('ログインページのtitleが設定されている', async ({ page }) => {
    await page.goto('/login')

    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('sitemap.xmlが応答する', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toContain('xml')
  })

  test('robots.txtが応答する', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
  })

  test('feed.xmlが応答する', async ({ request }) => {
    const response = await request.get('/feed.xml')
    expect(response.status()).toBe(200)
  })
})
