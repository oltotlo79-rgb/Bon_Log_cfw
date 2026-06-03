/**
 * @module components/user/FollowButton
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toggleFollow } from '@/lib/actions/follow'
import { sendFollowRequest, cancelFollowRequest } from '@/lib/actions/follow-request'
import { useFollowAction } from '@/hooks/use-follow-action'
import {
  MSG_FOLLOW_REQUEST_CANCELED,
  MSG_FOLLOW_REQUEST_PENDING,
  MSG_FOLLOW_REQUEST_SENT,
} from '@/lib/constants/messages'

type FollowButtonProps = {
  userId: string
  initialIsFollowing: boolean
  isPublic?: boolean
  initialHasRequest?: boolean
}

export function FollowButton({
  userId,
  initialIsFollowing,
  isPublic = true,
  initialHasRequest = false,
}: FollowButtonProps) {

  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [hasRequest, setHasRequest] = useState(initialHasRequest)
  const [isHovered, setIsHovered] = useState(false)
  const { execute, isPending } = useFollowAction()

  function handleFollow() {
    const previousState = isFollowing
    execute({
      onOptimistic: () => setIsFollowing(!isFollowing),
      onRollback: () => setIsFollowing(previousState),
      action: () => toggleFollow(userId),
      getError: (result) => (!result.success ? result.error : null),
    })
  }

  function handleSendRequest() {
    execute({
      onOptimistic: () => setHasRequest(true),
      onRollback: () => setHasRequest(false),
      action: () => sendFollowRequest(userId),
      getError: (result) => ('error' in result ? result.error : null),
      successToast: {
        title: MSG_FOLLOW_REQUEST_SENT,
        description: MSG_FOLLOW_REQUEST_PENDING,
      },
    })
  }

  function handleCancelRequest() {
    execute({
      onOptimistic: () => setHasRequest(false),
      onRollback: () => setHasRequest(true),
      action: () => cancelFollowRequest(userId),
      getError: (result) => (!result.success ? result.error : null),
      successToast: { title: MSG_FOLLOW_REQUEST_CANCELED },
    })
  }

  function handleClick() {
    if (isFollowing) {
      handleFollow()
    } else if (!isPublic && hasRequest) {
      handleCancelRequest()
    } else if (!isPublic) {
      handleSendRequest()
    } else {
      handleFollow()
    }
  }

  const getButtonText = () => {
    if (isPending) return '...'

    if (isFollowing) {
      return isHovered ? 'フォロー解除' : 'フォロー中'
    }

    if (!isPublic) {
      if (hasRequest) {
        return isHovered ? 'キャンセル' : 'リクエスト済み'
      }
      return 'フォローリクエスト'
    }

    return 'フォローする'
  }

  const getButtonClass = () => {
    if (isFollowing && isHovered) {
      return 'border-destructive text-destructive hover:bg-destructive/10'
    }
    if (!isPublic && hasRequest && isHovered) {
      return 'border-destructive text-destructive hover:bg-destructive/10'
    }
    return ''
  }

  const getButtonVariant = () => {
    if (isFollowing || hasRequest) {
      return 'outline'
    }
    // bonsai variant は text-white を担保し、ダークモードで text-primary-foreground が読みにくくなる問題を回避する
    return 'bonsai'
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant={getButtonVariant()}
      className={getButtonClass()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {getButtonText()}
    </Button>
  )
}
