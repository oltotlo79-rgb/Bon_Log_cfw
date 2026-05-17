/**
 * ニックネームが「ゲスト」のアカウントを本番DBから削除するスクリプト
 *
 * 削除対象: nickname が「ゲスト」のユーザー（1件のみ想定）
 *
 * 実行: 本番の DATABASE_URL を指した状態で
 *   npm run guest:delete-nickname
 * または
 *   npx tsx scripts/delete-guest-nickname-user.ts
 */

try {
  require('dotenv').config({ path: '.env.local' })
  require('dotenv').config({ path: '.env' })
} catch {
  // dotenv がなくても process.env に DATABASE_URL があれば可
}

import { prisma } from '../lib/db'

const NICKNAME_TO_DELETE = 'ゲスト'

async function main() {
  const toDelete = await prisma.user.findMany({
    where: { nickname: NICKNAME_TO_DELETE },
    select: { id: true, email: true, nickname: true },
  })

  if (toDelete.length === 0) {
    console.log('No user with nickname "%s" found.', NICKNAME_TO_DELETE)
    return
  }

  for (const u of toDelete) {
    await prisma.user.delete({ where: { id: u.id } })
    console.log('Deleted: %s (%s)', u.email, u.nickname)
  }
  console.log('Deleted %d user(s).', toDelete.length)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
