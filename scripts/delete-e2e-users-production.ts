/**
 * 本番環境に残ったE2Eテスト用ユーザーを削除するスクリプト
 *
 * 削除対象（すべて削除）:
 * - メールが e2e-test@example.com のユーザー（E2Eテスト用・本番には不要）
 * - メールが e2e-register-*@example.com のユーザー
 * - ニックネームが「E2Eテストユーザー」「E2E他ユーザー」「E2E登録テスト」「E2E Test User」のユーザー
 *
 * 使用場面: 本番DBに誤って残ったE2Eユーザーを1回だけ削除するとき。
 * 実行前に DATABASE_URL が本番を指していることを確認すること。
 *
 * 実行: CLEANUP_E2E_PRODUCTION=1 npm run e2e:delete-production-users
 *   または: npx tsx scripts/delete-e2e-users-production.ts
 *   （本番用の .env を読み込んだ状態で実行）
 */

try {
  require('dotenv').config({ path: '.env.local' })
  require('dotenv').config({ path: '.env' })
} catch {
  // dotenv がなくても process.env に DATABASE_URL があれば可
}

import { prisma } from '../lib/db'

const E2E_EMAIL_OFFICIAL = 'e2e-test@example.com'
const RESERVED_NICKNAMES = ['E2Eテストユーザー', 'E2E他ユーザー', 'E2E登録テスト', 'E2E Test User']

async function main() {
  const byEmail = await prisma.user.findMany({
    where: {
      OR: [
        { email: E2E_EMAIL_OFFICIAL },
        { email: { contains: 'e2e-register-' } },
      ],
    },
    select: { id: true, email: true, nickname: true },
  })
  const byNickname = await prisma.user.findMany({
    where: { nickname: { in: RESERVED_NICKNAMES } },
    select: { id: true, email: true, nickname: true },
  })
  const toDelete = new Map(byEmail.map((u) => [u.id, u]))
  for (const u of byNickname) {
    toDelete.set(u.id, u)
  }

  if (toDelete.size === 0) {
    console.log('No E2E users found. Nothing to delete.')
    return
  }

  for (const [id, u] of toDelete) {
    await prisma.user.delete({ where: { id } })
    console.log(`Deleted: ${u.email} (${u.nickname})`)
  }
  console.log(`Deleted ${toDelete.size} E2E user(s) from database.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
