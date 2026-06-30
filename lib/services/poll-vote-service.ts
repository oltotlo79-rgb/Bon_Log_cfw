/**
 * @module lib/services/poll-vote-service
 * アンケート投票のドメインロジック（v1 API 用）。
 *
 * app/api/v1/polls/[id]/vote から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import {
  ERR_POLL_NOT_FOUND,
  ERR_POLL_ENDED,
  ERR_POLL_INVALID_OPTION,
  ERR_POLL_ALREADY_VOTED,
  ERR_POLL_VOTE_FAILED,
} from '@/lib/constants/errors'

export type PollOptionResult = {
  id: string
  text: string
  voteCount: number
  /** 全票に占める割合（0〜100、小数第1位まで）。totalVotes が 0 なら 0 */
  percentage: number
}

export type PollVoteResult = {
  id: string
  expiresAt: string
  isExpired: boolean
  totalVotes: number
  userVoteOptionId: string | null
  options: PollOptionResult[]
}

export type VoteResult =
  | { ok: true; poll: PollVoteResult }
  | { ok: false; error: string; status: 400 | 404 | 500 }

/**
 * アンケートに投票し、最新の集計結果を返す。
 *
 * - 期限切れの場合は 400 POLL_ENDED
 * - 無効な選択肢は 400 POLL_INVALID_OPTION
 * - 二重投票（並行リクエスト含む）は 400 POLL_ALREADY_VOTED
 */
export async function castVote(
  pollId: string,
  optionId: string,
  userId: string,
): Promise<VoteResult> {
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { votes: true } } },
      },
      _count: { select: { votes: true } },
    },
  })

  if (!poll) {
    return { ok: false, error: ERR_POLL_NOT_FOUND, status: 404 }
  }

  const now = new Date()
  if (now > poll.expiresAt) {
    return { ok: false, error: ERR_POLL_ENDED, status: 400 }
  }

  if (!poll.options.some((o) => o.id === optionId)) {
    return { ok: false, error: ERR_POLL_INVALID_OPTION, status: 400 }
  }

  const existing = await prisma.pollVote.findUnique({
    where: { pollId_userId: { pollId, userId } },
  })
  if (existing) {
    return { ok: false, error: ERR_POLL_ALREADY_VOTED, status: 400 }
  }

  try {
    await prisma.pollVote.create({ data: { pollId, optionId, userId } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, error: ERR_POLL_ALREADY_VOTED, status: 400 }
    }
    logger.error('castVote failed', {
      userId,
      pollId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_POLL_VOTE_FAILED, status: 500 }
  }

  // 最新状態を再取得して返す
  const updated = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: {
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { votes: true } } },
      },
      _count: { select: { votes: true } },
    },
  })

  if (!updated) {
    return { ok: false, error: ERR_POLL_VOTE_FAILED, status: 500 }
  }

  const totalVotes = updated._count.votes
  const options: PollOptionResult[] = updated.options.map((o) => ({
    id: o.id,
    text: o.text,
    voteCount: o._count.votes,
    percentage:
      totalVotes > 0
        ? Math.round((o._count.votes / totalVotes) * 1000) / 10
        : 0,
  }))

  return {
    ok: true,
    poll: {
      id: updated.id,
      expiresAt: updated.expiresAt.toISOString(),
      isExpired: now > updated.expiresAt,
      totalVotes,
      userVoteOptionId: optionId,
      options,
    },
  }
}
