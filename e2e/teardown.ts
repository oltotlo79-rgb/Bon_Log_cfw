/**
 * E2E 全テスト終了後（成功・失敗どちらでも）に実行される teardown プロジェクト用テスト。
 * テストで作成されたユーザー（e2e-register-*@example.com 等）を削除する。
 * playwright.config.ts の teardown プロジェクトでこのファイルにマッチさせる。
 */
import { test as teardown } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'

teardown('delete E2E test users', async () => {
  const scriptPath = path.join(__dirname, '../scripts/delete-e2e-test-users.ts')
  try {
    execSync(`npx tsx "${scriptPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: process.env,
    })
  } catch (e) {
    // DB未接続・CI環境などでは失敗する場合がある。警告のみでテストは成功扱いにする
    console.warn('[E2E teardown] delete-e2e-test-users failed:', (e as Error).message)
  }
})
