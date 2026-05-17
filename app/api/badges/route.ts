import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { BADGES_CONVERSATIONS_LIMIT } from '@/lib/constants/limits'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ notifications: 0, messages: 0 })
    }

    const userId = session.user.id

    // ミュートしているユーザーのIDを取得
    const mutedUsers = await prisma.mute.findMany({
      where: { muterId: userId },
      select: { mutedId: true },
    })
    const mutedUserIds = mutedUsers.map((m: typeof mutedUsers[number]) => m.mutedId)

    // 未読通知数（ミュートユーザーからの通知を除外）
    const unreadNotifications = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
        ...(mutedUserIds.length > 0 && {
          actorId: { notIn: mutedUserIds },
        }),
      },
    })

    // 未読メッセージ数（直近 N 会話のみ対象で負荷を抑える）
    const participants = await prisma.conversationParticipant.findMany({
      where: { userId },
      take: BADGES_CONVERSATIONS_LIMIT,
      orderBy: { conversation: { updatedAt: 'desc' } },
      include: {
        conversation: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    let unreadMessages = 0
    for (const participant of participants) {
      const lastMessage = participant.conversation.messages[0]
      if (lastMessage) {
        // 自分が送ったメッセージは未読カウントしない
        if (lastMessage.senderId === userId) {
          continue
        }
        // 既読時刻より後のメッセージがあれば未読
        if (
          !participant.lastReadAt ||
          lastMessage.createdAt > participant.lastReadAt
        ) {
          unreadMessages++
        }
      }
    }

    const messagesCapReached = participants.length >= BADGES_CONVERSATIONS_LIMIT

    return NextResponse.json({
      notifications: unreadNotifications,
      messages: unreadMessages,
      messagesCapReached: messagesCapReached || undefined,
    })
  } catch (error) {
    logger.error('Badge API error:', error)
    return NextResponse.json({ notifications: 0, messages: 0 })
  }
}
