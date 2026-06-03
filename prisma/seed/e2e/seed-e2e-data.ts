/**
 * E2Eテスト用シードデータ。
 *
 * ローカルDB（localhost/127.0.0.1）かつ非本番環境でのみ実行される。
 * テストユーザー・投稿・コメント・通知・フォロー・投票・下書き・メッセージ・
 * 盆栽・イベント・盆栽園・レビューを作成する。
 */

import type { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { BCRYPT_SALT_ROUNDS } from '@/lib/constants/limits'

export async function seedE2EData(prisma: PrismaClient): Promise<void> {
  const e2eTestPassword = await bcrypt.hash('TestPassword123!', BCRYPT_SALT_ROUNDS)
  const e2eUser = await prisma.user.upsert({
    where: { email: 'e2e-test@example.com' },
    // 既存ユーザー扱いにしオンボーディング誘導を抑止する (未設定だと /feed が /onboarding へ恒久リダイレクト)
    update: { emailVerified: new Date(), onboardedAt: new Date() },
    create: {
      email: 'e2e-test@example.com',
      password: e2eTestPassword,
      nickname: 'E2Eテストユーザー',
      emailVerified: new Date(),
      onboardedAt: new Date(),
    },
  })
  console.log('Seeded E2E test user')

  const e2eTestPassword2 = await bcrypt.hash('TestPassword123!', BCRYPT_SALT_ROUNDS)
  const e2eUser2 = await prisma.user.upsert({
    where: { email: 'e2e-test2@example.com' },
    update: { emailVerified: new Date(), onboardedAt: new Date() },
    create: {
      email: 'e2e-test2@example.com',
      password: e2eTestPassword2,
      nickname: 'E2Eテストユーザー2',
      emailVerified: new Date(),
      onboardedAt: new Date(),
    },
  })
  console.log('Seeded E2E test user 2')

  // テスト投稿
  const existingPost = await prisma.post.findFirst({ where: { userId: e2eUser.id } })
  if (!existingPost) {
    const firstGenre = await prisma.genre.findFirst({ where: { type: 'post' } })
    const post = await prisma.post.create({
      data: {
        userId: e2eUser.id,
        content: 'E2Eテスト用の投稿です。五葉松の植え替えを行いました。',
        ...(firstGenre ? { genres: { create: { genreId: firstGenre.id } } } : {}),
      },
    })
    console.log('Seeded E2E test post:', post.id)

    // コメント
    await prisma.comment.create({
      data: {
        postId: post.id,
        userId: e2eUser2.id,
        content: 'E2Eテスト用コメントです。きれいな五葉松ですね！',
      },
    })
    console.log('Seeded E2E test comment on post')

    // 通知
    const existingNotification = await prisma.notification.findFirst({
      where: { userId: e2eUser.id, actorId: e2eUser2.id },
    })
    if (!existingNotification) {
      await prisma.notification.create({
        data: {
          userId: e2eUser.id,
          actorId: e2eUser2.id,
          type: 'like',
          postId: post.id,
        },
      })
      console.log('Seeded E2E test notification')
    }
  }

  // 2人目の投稿
  const existingPost2 = await prisma.post.findFirst({ where: { userId: e2eUser2.id } })
  if (!existingPost2) {
    await prisma.post.create({
      data: {
        userId: e2eUser2.id,
        content: 'E2Eテストユーザー2の投稿です。黒松の芽摘みをしました。',
      },
    })
    console.log('Seeded E2E test post for user 2')
  }

  // フォロー関係
  const existingFollow = await prisma.follow.findFirst({
    where: { followerId: e2eUser.id, followingId: e2eUser2.id },
  })
  if (!existingFollow) {
    await prisma.follow.create({
      data: { followerId: e2eUser.id, followingId: e2eUser2.id },
    })
    console.log('Seeded E2E follow relationship')
  }

  // 投票付き投稿
  const existingPoll = await prisma.poll.findFirst({
    where: { post: { userId: e2eUser.id } },
  })
  if (!existingPoll) {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    await prisma.post.create({
      data: {
        userId: e2eUser.id,
        content: 'E2Eテスト用の投票です。どの樹種が好きですか？',
        poll: {
          create: {
            duration: 604800,
            expiresAt,
            options: {
              create: [
                { text: '五葉松', sortOrder: 0 },
                { text: '真柏', sortOrder: 1 },
                { text: '紅葉', sortOrder: 2 },
              ],
            },
          },
        },
      },
    })
    console.log('Seeded E2E test poll post')
  }

  // 下書き
  const existingDraft = await prisma.draftPost.findFirst({ where: { userId: e2eUser.id } })
  if (!existingDraft) {
    await prisma.draftPost.create({
      data: {
        userId: e2eUser.id,
        content: 'E2Eテスト用の下書きです。まだ投稿していません。',
      },
    })
    console.log('Seeded E2E test draft')
  }

  // メッセージ会話
  const existingConversation = await prisma.conversation.findFirst({
    where: { participants: { some: { userId: e2eUser.id } } },
  })
  if (!existingConversation) {
    await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: e2eUser.id },
            { userId: e2eUser2.id },
          ],
        },
        messages: {
          create: {
            senderId: e2eUser2.id,
            content: 'E2Eテスト用のメッセージです。盆栽の育て方について質問があります。',
          },
        },
      },
    })
    console.log('Seeded E2E test conversation')
  }

  // 盆栽
  const existingBonsai = await prisma.bonsai.findFirst({ where: { userId: e2eUser.id } })
  if (!existingBonsai) {
    await prisma.bonsai.create({
      data: { userId: e2eUser.id, name: 'E2E用テスト盆栽', species: '五葉松' },
    })
    console.log('Seeded E2E test bonsai')
  }

  // イベント
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 7)
  const existingEvent = await prisma.event.findFirst({ where: { createdBy: e2eUser.id } })
  if (!existingEvent) {
    await prisma.event.create({
      data: {
        title: 'E2E用テストイベント',
        description: 'E2Eテスト用',
        startDate: futureDate,
        createdBy: e2eUser.id,
      },
    })
    console.log('Seeded E2E test event')
  }

  // 盆栽園 + レビュー
  const firstShopGenre = await prisma.genre.findFirst({ where: { type: 'shop' } })
  const existingShop = await prisma.bonsaiShop.findFirst({ where: { createdBy: e2eUser.id } })
  if (!existingShop && firstShopGenre) {
    const shop = await prisma.bonsaiShop.create({
      data: {
        name: 'E2E用テスト盆栽園',
        address: '東京都渋谷区1-2-3',
        createdBy: e2eUser.id,
      },
    })
    await prisma.shopGenre.create({
      data: { shopId: shop.id, genreId: firstShopGenre.id },
    })
    console.log('Seeded E2E test shop')

    const existingReview = await prisma.shopReview.findFirst({ where: { shopId: shop.id } })
    if (!existingReview) {
      await prisma.shopReview.create({
        data: {
          shopId: shop.id,
          userId: e2eUser.id,
          rating: 4,
          content: 'E2Eテスト用レビューです。品揃えが豊富で良い盆栽園でした。',
        },
      })
      console.log('Seeded E2E test shop review')
    }
  }
}
