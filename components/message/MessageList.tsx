/**
 * @module components/message/MessageList
 */

'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

interface Message {
  id: string
  content: string
  createdAt: Date
  sender: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
}

interface MessageListProps {
  initialMessages: Message[]
  conversationId: string
  currentUserId: string
}

export function MessageList({ initialMessages, currentUserId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [initialMessages])

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = []
    let currentDate = ''

    messages.forEach((message) => {
      const messageDate = format(new Date(message.createdAt), 'yyyy年M月d日', { locale: ja })

      if (messageDate !== currentDate) {
        currentDate = messageDate
        groups.push({ date: messageDate, messages: [] })
      }

      const lastGroup = groups[groups.length - 1]
      if (lastGroup) lastGroup.messages.push(message)
    })

    return groups
  }

  const messageGroups = groupMessagesByDate(initialMessages)

  if (initialMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-muted-foreground text-center">
          メッセージはまだありません。<br />
          最初のメッセージを送ってみましょう！
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      {messageGroups.map((group) => (
        <div key={group.date}>
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 text-xs bg-muted rounded-full text-muted-foreground">
              {group.date}
            </span>
          </div>

          <div className="space-y-3">
            {group.messages.map((message) => {
              const isOwn = message.sender.id === currentUserId

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  {!isOwn && (
                    message.sender.avatarUrl ? (
                      <Image
                        src={message.sender.avatarUrl}
                        alt={message.sender.nickname}
                        width={32}
                        height={32}
                        sizes="32px"
                        className="rounded-full h-8 w-8 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {message.sender.nickname.charAt(0)}
                        </span>
                      </div>
                    )
                  )}

                  <div
                    className={`max-w-[70%] ${
                      isOwn
                        ? 'bg-primary text-primary-foreground rounded-l-lg rounded-tr-lg'
                        : 'bg-muted rounded-r-lg rounded-tl-lg'
                    } px-4 py-2`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {format(new Date(message.createdAt), 'HH:mm', { locale: ja })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
