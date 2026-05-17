'use client'

import { useState, useTransition } from 'react'
import { votePoll } from '@/lib/actions/poll'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

type PollOption = {
  id: string
  text: string
  _count: { votes: number }
}

type PollData = {
  id: string
  expiresAt: string | Date
  options: PollOption[]
  votes?: { userId: string; optionId: string }[]
  _count: { votes: number }
}

type PollDisplayProps = {
  poll: PollData
  currentUserId?: string
}

export function PollDisplay({ poll, currentUserId }: PollDisplayProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [hasVoted, setHasVoted] = useState(
    poll.votes && poll.votes.length > 0
  )
  const [userVoteOptionId, setUserVoteOptionId] = useState<string | null>(
    poll.votes?.[0]?.optionId ?? null
  )
  const [localVoteCounts, setLocalVoteCounts] = useState<Record<string, number>>(
    Object.fromEntries(poll.options.map(o => [o.id, o._count.votes]))
  )
  const [localTotalVotes, setLocalTotalVotes] = useState(poll._count.votes)

  const isExpired = new Date() > new Date(poll.expiresAt)
  const showResults = hasVoted || isExpired || !currentUserId

  const expiresAt = new Date(poll.expiresAt)
  const timeLabel = isExpired
    ? '終了済み'
    : `残り${formatDistanceToNow(expiresAt, { locale: ja })}`

  function handleVote() {
    if (!selectedOptionId || !currentUserId) return
    startTransition(async () => {
      const result = await votePoll(poll.id, selectedOptionId)
      if (result.success) {
        setHasVoted(true)
        setUserVoteOptionId(selectedOptionId)
        setLocalVoteCounts(prev => ({
          ...prev,
          [selectedOptionId]: (prev[selectedOptionId] || 0) + 1,
        }))
        setLocalTotalVotes(prev => prev + 1)
      }
    })
  }

  return (
    <div className="my-3 space-y-2" onClick={(e) => e.stopPropagation()}>
      {showResults ? (
        // 結果表示
        <div className="space-y-2">
          {poll.options.map((option) => {
            const count = localVoteCounts[option.id] || 0
            const pct = localTotalVotes > 0 ? Math.round((count / localTotalVotes) * 100) : 0
            const isUserVote = userVoteOptionId === option.id

            return (
              <div key={option.id} className="relative">
                <div
                  className={`absolute inset-0 rounded-md ${isUserVote ? 'bg-bonsai-green/20' : 'bg-muted/60'}`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between px-3 py-2 text-sm">
                  <span className={isUserVote ? 'font-medium' : ''}>
                    {option.text}
                    {isUserVote && ' ✓'}
                  </span>
                  <span className="text-muted-foreground ml-2">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // 投票UI
        <div className="space-y-2">
          {poll.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedOptionId(option.id)}
              className={`w-full text-left px-3 py-2 text-sm border rounded-md transition-colors ${
                selectedOptionId === option.id
                  ? 'border-bonsai-green bg-bonsai-green/10'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              {option.text}
            </button>
          ))}
          <button
            type="button"
            onClick={handleVote}
            disabled={!selectedOptionId || isPending}
            className="w-full py-2 text-sm font-medium rounded-md bg-bonsai-green text-white hover:bg-bonsai-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? '投票中...' : '投票する'}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{localTotalVotes}票</span>
        <span>・</span>
        <span>{timeLabel}</span>
      </div>
    </div>
  )
}
