/**
 * E2E 全テスト終了後（成功・失敗どちらでも）に実行される teardown。
 * テストで作成されたユーザー（および CASCADE で削除される投稿等）を削除する。
 */
import { execSync } from 'child_process'
import path from 'path'

async function globalTeardown() {
  try {
    const scriptPath = path.join(__dirname, '../scripts/delete-e2e-test-users.ts')
    execSync(`npx tsx "${scriptPath}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: process.env,
    })
  } catch (e) {
    // 削除スクリプトの失敗は警告のみ（DB未接続のCIなどではスキップされる想定）
    console.warn('[E2E teardown] delete-e2e-test-users skipped or failed:', (e as Error).message)
  }
}

export default globalTeardown
