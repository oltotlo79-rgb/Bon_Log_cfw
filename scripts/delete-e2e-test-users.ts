/**
 * E2Eテストで作成された不要ユーザーを削除するスクリプト
 *
 * 削除対象（すべて削除）:
 * - メールが e2e-test@example.com または e2e-register-*@example.com のユーザー
 * - ニックネームが「E2Eテストユーザー」「E2E他ユーザー」「E2E登録テスト」「E2E Test User」のユーザー
 *
 * 実行: npm run e2e:delete-test-users または npx tsx scripts/delete-e2e-test-users.ts
 * E2E実行時は playwright の globalTeardown で自動実行（成功・失敗どちらでも削除）
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

try {
  require('dotenv').config({ path: path.join(projectRoot, '.env.local') })
  require('dotenv').config({ path: path.join(projectRoot, '.env') })
} catch {
  // dotenv がなくても process.env に DATABASE_URL があれば可
}

const E2E_EMAIL_OFFICIAL = 'e2e-test@example.com'
const E2E_EMAIL_OFFICIAL_2 = 'e2e-test2@example.com'
const E2E_NICKNAMES = ['E2Eテストユーザー', 'E2Eテストユーザー2', 'E2E他ユーザー', 'E2E登録テスト', 'E2E Test User']

async function main() {
  const { prisma } = await import('../lib/db')
  const byEmail = await prisma.user.findMany({
    where: {
      OR: [
        { email: E2E_EMAIL_OFFICIAL },
        { email: E2E_EMAIL_OFFICIAL_2 },
        { email: { contains: 'e2e-register-' } },
      ],
    },
    select: { id: true, email: true, nickname: true },
  })
  const byNickname = await prisma.user.findMany({
    where: { nickname: { in: E2E_NICKNAMES } },
    select: { id: true, email: true, nickname: true },
  })
  const toDelete = new Map(byEmail.map((u) => [u.id, u]))
  for (const u of byNickname) {
    toDelete.set(u.id, u)
  }

  if (toDelete.size === 0) {
    console.log('No E2E leftover users to delete.')
  } else {
    for (const [id, u] of toDelete) {
      await prisma.user.delete({ where: { id } })
      console.log(`Deleted: ${u.email} (${u.nickname})`)
    }
    console.log(`Deleted ${toDelete.size} user(s).`)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
