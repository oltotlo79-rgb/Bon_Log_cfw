import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2Eテスト設定
 *
 * 実行方法:
 *   npx playwright test              # 全テスト実行（終了後に teardown プロジェクトでテストユーザー削除）
 *   npx playwright test --ui         # UI モードで実行
 *   npx playwright test --headed     # ブラウザを表示して実行
 *   npx playwright test auth.spec.ts # 特定ファイルのみ実行
 *
 * クリーンアップ: 成功・失敗どちらでも teardown プロジェクトが delete-e2e-test-users を実行する。
 * （globalTeardown に加え、プロジェクト teardown で確実に実行される）
 */

export default defineConfig({
  // テストファイルの場所
  testDir: './e2e',

  // 全テスト終了後（成功・失敗どちらでも）E2Eで作成したユーザー等を削除（二重で実行されても害はない）
  globalTeardown: './e2e/global-teardown.ts',

  // テストの並列実行設定
  fullyParallel: true,

  // CI環境でのリトライ設定
  retries: process.env.CI ? 2 : 0,

  // CI環境でのワーカー数
  // GitHub Actions の標準ランナー（ubuntu-latest = 2 vCPU / 7GB RAM）でも安全に動かせる範囲。
  // 過去 workers=1 で 5 ブラウザ × 59 spec が逐次実行となり CI 時間が肥大化していたため並列化。
  // 上書きしたい場合は環境変数 `PLAYWRIGHT_WORKERS` を指定する。
  workers: process.env.CI
    ? Number(process.env.PLAYWRIGHT_WORKERS) || 3
    : undefined,

  // レポーター設定
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // 共通設定
  use: {
    // ベースURL
    baseURL: 'http://localhost:3000',

    // スクリーンショット設定
    screenshot: 'only-on-failure',

    // ビデオ録画設定
    video: 'retain-on-failure',

    // トレース設定
    trace: 'on-first-retry',

    // タイムアウト（初回コンパイル・standalone の遅延を考慮）
    actionTimeout: 15000,
    navigationTimeout: process.env.CI ? 60000 : 45000,
  },

  // プロジェクト（ブラウザ）設定
  projects: [
    // 認証セットアップ（storageState生成）
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      timeout: 180000, // ログイン〜フィード表示まで（CI standalone の初回遅延を考慮）
    },

    // Chromium (デスクトップ)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: [/.*\.setup\.ts/, /teardown\.ts/, /auth\.spec\.ts/, /public-pages\.spec\.ts/, /error-handling\.spec\.ts/, /legal-pages\.spec\.ts/, /contact-form\.spec\.ts/, /maintenance\.spec\.ts/],
    },

    // Firefox (デスクトップ)
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: [/.*\.setup\.ts/, /teardown\.ts/, /auth\.spec\.ts/, /public-pages\.spec\.ts/, /error-handling\.spec\.ts/, /legal-pages\.spec\.ts/, /contact-form\.spec\.ts/, /maintenance\.spec\.ts/],
    },

    // WebKit (デスクトップ)
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: [/.*\.setup\.ts/, /teardown\.ts/, /auth\.spec\.ts/, /public-pages\.spec\.ts/, /error-handling\.spec\.ts/, /legal-pages\.spec\.ts/, /contact-form\.spec\.ts/, /maintenance\.spec\.ts/],
    },

    // モバイル Chrome
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: [/.*\.setup\.ts/, /teardown\.ts/, /auth\.spec\.ts/, /public-pages\.spec\.ts/, /error-handling\.spec\.ts/, /legal-pages\.spec\.ts/, /contact-form\.spec\.ts/, /maintenance\.spec\.ts/],
    },

    // モバイル Safari
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: [/.*\.setup\.ts/, /teardown\.ts/, /auth\.spec\.ts/, /public-pages\.spec\.ts/, /error-handling\.spec\.ts/, /legal-pages\.spec\.ts/, /contact-form\.spec\.ts/, /maintenance\.spec\.ts/],
    },

    // 未認証テスト（認証不要のページ・エラーハンドリング・ゲスト制限）
    {
      name: 'chromium-noauth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [/auth\.spec\.ts/, /public-pages\.spec\.ts/, /error-handling\.spec\.ts/, /legal-pages\.spec\.ts/, /contact-form\.spec\.ts/, /maintenance\.spec\.ts/, /settings-guest\.spec\.ts/],
    },

    // 全テスト終了後に必ず実行（成功・失敗どちらでも E2E テストユーザーを削除）
    {
      name: 'teardown',
      testMatch: /teardown\.ts$/,
      dependencies: ['chromium', 'firefox', 'webkit', 'Mobile Chrome', 'Mobile Safari', 'chromium-noauth'],
    },
  ],

  // 開発サーバー設定（CI では standalone サーバーを起動。instrumentation のセキュリティチェック通過のため NEXTAUTH_* を明示）
  webServer: process.env.CI
    ? {
      command: 'node server.js',
      cwd: '.next/standalone',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 180000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        PORT: '3000',
        HOSTNAME: '0.0.0.0',
        NODE_ENV: 'production',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
        AUTH_TRUST_HOST: 'true',
        // 弱いパターン（secret/test-secret等）を含まない値。未設定時のみ使用
        NEXTAUTH_SECRET:
          process.env.NEXTAUTH_SECRET ??
          'E2eSigningKey0Kq8mP7xR2vN5bW9fJ3hL6tY4dA0cE1gI8kO7nQ2sU5w',
      },
    }
    : {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        PORT: '3000',
        HOSTNAME: '0.0.0.0',
      },
    },

  // グローバルタイムアウト（初回コンパイル遅延を考慮してローカルも60s）
  timeout: process.env.CI ? 90000 : 60000,

  // expectのタイムアウト
  expect: {
    timeout: process.env.CI ? 20000 : 10000,
  },
})
