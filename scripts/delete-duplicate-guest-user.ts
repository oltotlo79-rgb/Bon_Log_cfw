/**
 * 本番DBの重複ゲストアカウントを削除するスクリプト
 *
 * アプリが使用するゲストは「メール = guest@example.com」の1件のみ。
 * ニックネームが「ゲストユーザー」で、メールが guest@example.com でないユーザーを削除する。
 *
 * 実行: 本番の DATABASE_URL を指した状態で
 *   npx tsx scripts/delete-duplicate-guest-user.ts
 */

try {
  require('dotenv').config({ path: '.env.local' })
  require('dotenv').config({ path: '.env' })
} catch {
  // dotenv がなくても process.env に DATABASE_URL があれば可
}

import { prisma } from '../lib/db'
import { GUEST_EMAIL } from '../lib/constants/guest'

const UNUSED_GUEST_NICKNAME = 'ゲストユーザー'

async function main() {
  const toDelete = await prisma.user.findMany({
    where: {
      nickname: UNUSED_GUEST_NICKNAME,
      email: { not: GUEST_EMAIL },
    },
    select: { id: true, email: true, nickname: true },
  })

  if (toDelete.length === 0) {
    console.log('No duplicate guest user to delete (no user with nickname "%s" and email != %s).', UNUSED_GUEST_NICKNAME, GUEST_EMAIL)
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
