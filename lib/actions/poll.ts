'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { ERR_INVALID_INPUT, ERR_POLL_NOT_FOUND, ERR_POLL_ENDED, ERR_POLL_INVALID_OPTION, ERR_POLL_ALREADY_VOTED, ERR_POLL_VOTE_FAILED } from '@/lib/constants/errors'
import { ROUTE_FEED } from '@/lib/constants/routes'
import logger from '@/lib/logger'

const idSchema = z.string().min(1)

/**
 * アンケートに投票
 */
export async function votePoll(pollId: string, optionId: string) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  if (!idSchema.safeParse(pollId).success || !idSchema.safeParse(optionId).success) {
    return actionError(ERR_INVALID_INPUT)
  }

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      select: { expiresAt: true, options: { select: { id: true } } },
    })

    if (!poll) {
      return actionError(ERR_POLL_NOT_FOUND)
    }

    if (new Date() > poll.expiresAt) {
      return actionError(ERR_POLL_ENDED)
    }

    if (!poll.options.some(o => o.id === optionId)) {
      return actionError(ERR_POLL_INVALID_OPTION)
    }

    const existing = await prisma.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
    })

    if (existing) {
      return actionError(ERR_POLL_ALREADY_VOTED)
    }

    await prisma.pollVote.create({
      data: {
        pollId,
        optionId,
        userId,
      },
    })

    revalidatePath(ROUTE_FEED)

    return actionSuccess()
  } catch (error) {
    logger.error('Vote poll error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_POLL_VOTE_FAILED)
  }
}

/**
 * アンケート結果を取得
 */
export async function getPollResults(pollId: string) {
  const session = await auth()
  const currentUserId = session?.user?.id

  try {
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { votes: true } },
          },
        },
        _count: { select: { votes: true } },
      },
    })

    if (!poll) {
      return actionError(ERR_POLL_NOT_FOUND)
    }

    let userVoteOptionId: string | null = null
    if (currentUserId) {
      const vote = await prisma.pollVote.findUnique({
        where: { pollId_userId: { pollId, userId: currentUserId } },
        select: { optionId: true },
      })
      userVoteOptionId = vote?.optionId ?? null
    }

    return actionSuccess({
      poll: {
        id: poll.id,
        expiresAt: poll.expiresAt,
        isExpired: new Date() > poll.expiresAt,
        totalVotes: poll._count.votes,
        userVoteOptionId,
        options: poll.options.map(o => ({
          id: o.id,
          text: o.text,
          voteCount: o._count.votes,
        })),
      },
    })
  } catch (error) {
    logger.error('Get poll results error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_POLL_NOT_FOUND)
  }
}
