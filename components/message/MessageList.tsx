/**
 * メッセージリストコンポーネント
 *
 * @module components/message/MessageList
 */

'use client'

/**
 * React Hooks
 * useEffect: メッセージ更新時の自動スクロール処理
 * useRef: スクロール位置の参照を保持
 */
import { useEffect, useRef } from 'react'

/**
 * Next.js 画像最適化コンポーネント
 * アバター画像の表示に使用
 */
import Image from 'next/image'

/**
 * date-fns: 日付フォーマットユーティリティ
 * format: 日付を指定形式の文字列に変換
 */
import { format } from 'date-fns'

/**
 * date-fns 日本語ロケール
 * 日付表示を日本語形式（「2024年1月15日」など）にする
 */
import { ja } from 'date-fns/locale'

/**
 * メッセージオブジェクトの型定義
 *
 * @property id - メッセージの一意識別子（UUID）
 * @property content - メッセージ本文（テキスト）
 * @property createdAt - メッセージ送信日時
 * @property sender - 送信者情報
 * @property sender.id - 送信者のユーザーID
 * @property sender.nickname - 送信者のニックネーム（表示名）
 * @property sender.avatarUrl - 送信者のアバター画像URL（nullの場合はデフォルト表示）
 */
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

/**
 * MessageListコンポーネントのprops型定義
 *
 * @property initialMessages - 表示するメッセージの配列（日時順にソート済み）
 * @property conversationId - 会話の一意識別子（将来的なリアルタイム更新用）
 * @property currentUserId - 現在ログイン中のユーザーID（自分/相手の判定に使用）
 */
interface MessageListProps {
  initialMessages: Message[]
  conversationId: string
  currentUserId: string
}

/**
 * メッセージリストコンポーネント
 *
 * チャット形式でメッセージを表示するコンポーネント。
 * 日付ごとにグループ化し、自分と相手のメッセージを視覚的に区別します。
 *
 * @param initialMessages - 表示するメッセージ配列
 * @param conversationId - 会話ID（現在は未使用だが将来のWebSocket対応用）
 * @param currentUserId - ログインユーザーID
 *
 * @returns メッセージリストのJSX、またはメッセージがない場合は案内メッセージ
 */
export function MessageList({ initialMessages, currentUserId }: MessageListProps) {
  /**
   * メッセージ一覧の最下部を参照するref
   * 新着メッセージ時にここにスクロールする
   */
  const messagesEndRef = useRef<HTMLDivElement>(null)

  /**
   * メッセージ配列が更新されたら自動的に最下部にスクロール
   *
   * 依存配列: [initialMessages]
   * - 新しいメッセージが追加されるたびに実行
   * - smooth動作で滑らかにスクロール
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [initialMessages])

  /**
   * メッセージを日付ごとにグループ化する関数
   *
   * 同じ日付のメッセージをまとめて表示するため、
   * 日付ラベル（「2024年1月15日」など）ごとにグループ化します。
   *
   * @param messages - グループ化するメッセージ配列
   * @returns 日付とメッセージ配列のペアの配列
   *
   * @example
   * 入力: [
   *   { createdAt: "2024-01-15 10:00", ... },
   *   { createdAt: "2024-01-15 11:00", ... },
   *   { createdAt: "2024-01-16 09:00", ... }
   * ]
   * 出力: [
   *   { date: "2024年1月15日", messages: [...] },
   *   { date: "2024年1月16日", messages: [...] }
   * ]
   */
  const groupMessagesByDate = (messages: Message[]) => {
    /** グループ化された結果を格納する配列 */
    const groups: { date: string; messages: Message[] }[] = []
    /** 現在処理中の日付（前のメッセージと比較用） */
    let currentDate = ''

    messages.forEach((message) => {
      // メッセージの日付を「yyyy年M月d日」形式にフォーマット
      const messageDate = format(new Date(message.createdAt), 'yyyy年M月d日', { locale: ja })

      // 日付が変わったら新しいグループを作成
      if (messageDate !== currentDate) {
        currentDate = messageDate
        groups.push({ date: messageDate, messages: [] })
      }

      // 現在のグループにメッセージを追加
      const lastGroup = groups[groups.length - 1]
      if (lastGroup) lastGroup.messages.push(message)
    })

    return groups
  }

  /** 日付でグループ化されたメッセージ */
  const messageGroups = groupMessagesByDate(initialMessages)

  /**
   * メッセージが0件の場合は案内メッセージを表示
   */
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
      {/* 日付グループごとにメッセージを表示 */}
      {messageGroups.map((group) => (
        <div key={group.date}>
          {/* 日付ラベル（中央揃え、ピル型バッジ） */}
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 text-xs bg-muted rounded-full text-muted-foreground">
              {group.date}
            </span>
          </div>

          {/* その日付のメッセージ一覧 */}
          <div className="space-y-3">
            {group.messages.map((message) => {
              /**
               * 自分のメッセージかどうかを判定
               * true: 右側に表示（吹き出しが右寄せ）
               * false: 左側に表示（アバター付き）
               */
              const isOwn = message.sender.id === currentUserId

              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  {/* アバター画像（相手のメッセージのみ表示） */}
                  {!isOwn && (
                    message.sender.avatarUrl ? (
                      // アバター画像がある場合
                      <Image
                        src={message.sender.avatarUrl}
                        alt={message.sender.nickname}
                        width={32}
                        height={32}
                        sizes="32px"
                        className="rounded-full h-8 w-8 flex-shrink-0"
                      />
                    ) : (
                      // アバター画像がない場合はニックネームの頭文字を表示
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {message.sender.nickname.charAt(0)}
                        </span>
                      </div>
                    )
                  )}

                  {/* メッセージバブル（吹き出し） */}
                  <div
                    className={`max-w-[70%] ${
                      isOwn
                        // 自分のメッセージ: プライマリカラー背景、左・右上に角丸
                        ? 'bg-primary text-primary-foreground rounded-l-lg rounded-tr-lg'
                        // 相手のメッセージ: グレー背景、右・左上に角丸
                        : 'bg-muted rounded-r-lg rounded-tl-lg'
                    } px-4 py-2`}
                  >
                    {/* メッセージ本文（改行・長文の折り返しに対応） */}
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    {/* 送信時刻（HH:mm形式） */}
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
      {/* スクロール位置の参照用（空のdiv） */}
      <div ref={messagesEndRef} />
    </div>
  )
}
