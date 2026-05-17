/**
 * ゲストユーザー（のぞいてみる用）のみをDBに作成・更新するスクリプト
 *
 * GUEST_PASSWORD が設定されている場合、guest@example.com のユーザーを upsert する。
 * 本番でゲストログインを有効にするときに使用。
 *
 * 実行手順:
 *   1. .env.local に GUEST_PASSWORD=任意のパスワード を追加（本番では Vercel の環境変数にも同じ値を設定すること）
 *   2. node --env-file=.env.local --import tsx scripts/seed-guest-user.ts
 *   または npm run guest:seed（要 .env.local の GUEST_PASSWORD）
 */

try {
  require('dotenv').config({ path: '.env.local' })
  require('dotenv').config({ path: '.env' })
} catch {
  // dotenv がなくても process.env に DATABASE_URL があれば可
}

import { prisma } from '../lib/db'
import { GUEST_EMAIL } from '../lib/constants/guest'
import bcrypt from 'bcryptjs'
import { BCRYPT_SALT_ROUNDS } from '../lib/constants/limits'

async function main() {
  const password =
    process.env.GUEST_PASSWORD ??
    (process.env.NODE_ENV === 'development' ? 'GuestPass1!' : '')

  if (!password) {
    console.error('GUEST_PASSWORD is not set. Set it in .env.local or environment.')
    process.exit(1)
  }

  const hashed = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
  await prisma.user.upsert({
    where: { email: GUEST_EMAIL },
    update: { password: hashed, emailVerified: new Date(), nickname: 'ゲスト' },
    create: {
      email: GUEST_EMAIL,
      password: hashed,
      nickname: 'ゲスト',
      emailVerified: new Date(),
    },
  })
  console.log('Guest user upserted: %s (nickname: ゲスト)', GUEST_EMAIL)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
