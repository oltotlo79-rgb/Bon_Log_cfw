 
/**
 * メインシードオーケストレーター。
 *
 * ジャンル → ゲストユーザー → E2Eデータ → 農薬 → 辞典 → ホルモン の順で実行。
 * 各ドメインの実データは prisma/seed/ 以下のサブモジュールに分離。
 */

import bcrypt from 'bcryptjs'
import { BCRYPT_SALT_ROUNDS } from '@/lib/constants/limits'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { createSeedPrismaClient } from './seed/shared/create-client'
import { POST_GENRES, SHOP_GENRES } from './seed/genre/genre-data'
import { seedE2EData } from './seed/e2e/seed-e2e-data'
import { main as seedPesticides } from './seed/pesticide/seed-pesticide-data'
import { seedPesticideAdditions } from './seed/pesticide/seed-pesticide-additions'
import { DICTIONARY_TERMS } from './seed/dictionary/seed-dictionary'
import { main as seedFertilizer } from './seed/fertilizer/seed-fertilizer-data'
import { seedHormoneData } from './seed/hormone/seed-hormone-data'

const prisma = createSeedPrismaClient()

async function main() {
  console.log('Seeding genres...')

  // 投稿用ジャンル
  for (const genre of POST_GENRES) {
    await prisma.genre.upsert({
      where: {
        id: `${genre.category}-${genre.name}`.replace(/[・]/g, '-'),
      },
      update: genre,
      create: {
        id: `${genre.category}-${genre.name}`.replace(/[・]/g, '-'),
        ...genre,
      },
    })
  }

  // 盆栽園用ジャンル
  for (const genre of SHOP_GENRES) {
    await prisma.genre.upsert({
      where: {
        id: `shop-${genre.category}-${genre.name}`.replace(/[・]/g, '-'),
      },
      update: genre,
      create: {
        id: `shop-${genre.category}-${genre.name}`.replace(/[・]/g, '-'),
        ...genre,
      },
    })
  }

  console.log(`Seeded ${POST_GENRES.length} post genres and ${SHOP_GENRES.length} shop genres`)

  // E2Eテスト用データ（ローカルDB + 非本番環境のみ）
  const dbUrl = process.env.DATABASE_URL ?? ''
  const isLocalDb = /localhost|127\.0\.0\.1/.test(dbUrl)
  const shouldSeedE2E = process.env.NODE_ENV !== 'production' && isLocalDb
  if (shouldSeedE2E) {
    await seedE2EData(prisma)
  }

  // ゲストユーザー（トップの「のぞいてみる」でログインする共有アカウント）
  const guestPassword =
    process.env.GUEST_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'GuestPass1!')
  if (guestPassword) {
    const guestHashed = await bcrypt.hash(guestPassword, BCRYPT_SALT_ROUNDS)
    await prisma.user.upsert({
      where: { email: GUEST_EMAIL },
      update: { password: guestHashed, emailVerified: new Date() },
      create: {
        email: GUEST_EMAIL,
        password: guestHashed,
        nickname: 'ゲスト',
        emailVerified: new Date(),
      },
    })
    console.log('Seeded guest user')
  }
}

async function seedDictionary() {
  const existing = await prisma.bonsaiTerm.count()
  if (existing > 0) {
    console.log('Dictionary data already seeded, skipping')
    return
  }
  await prisma.bonsaiTerm.createMany({ data: DICTIONARY_TERMS })
  console.log(`Seeded ${DICTIONARY_TERMS.length} bonsai terms`)
}

main()
  .then(() => seedPesticides())
  .then(() => seedPesticideAdditions())
  .then(() => seedFertilizer())
  .then(() => seedDictionary())
  .then(() => seedHormoneData())
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
