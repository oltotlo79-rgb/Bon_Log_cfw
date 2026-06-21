/**
 * Expo Push API を使ったモバイル Push 通知送信。
 *
 * 呼び出し元（notification-core）は fire-and-forget で扱い、
 * 送信失敗が通知作成の成否・レスポンスを壊さない設計とする。
 * 無効トークン（DeviceNotRegistered / InvalidCredentials）は自動削除する。
 *
 * @module lib/services/push/expo-push
 */

import 'server-only'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import {
  EXPO_PUSH_API_URL,
  EXPO_PUSH_BATCH_SIZE,
  EXPO_PUSH_TIMEOUT_MS,
} from '@/lib/constants/limits'

/** Expo Push API に送る1件分のメッセージ形状 */
interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, string>
  sound?: 'default'
}

/** Expo Push API のチケット（送信直後レスポンス）形状 */
interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: {
    error?: string
  }
}

/** Expo Push API のレスポンス全体 */
interface ExpoPushResponse {
  data: ExpoPushTicket[]
}

/**
 * Expo Push API から返った error 種別を文字列として安全に取り出す。
 * details.error が string でない場合は unknown を返す。
 */
function extractExpoErrorKind(ticket: ExpoPushTicket): string {
  const kind = ticket.details?.error
  return typeof kind === 'string' ? kind : 'unknown'
}

/**
 * Expo Push API レスポンス JSON をパースして `ExpoPushResponse` として検証する。
 * 期待形状でなければ null を返す。
 */
function parseExpoPushResponse(raw: unknown): ExpoPushResponse | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj['data'])) return null
  return { data: obj['data'] as ExpoPushTicket[] }
}

/**
 * 指定ユーザーのモバイルデバイス全件に Expo Push 通知を送る。
 *
 * 送信失敗・ネットワークエラーは例外を投げずログのみ。
 * DeviceNotRegistered / InvalidCredentials トークンは mobile_devices から削除（ベストエフォート）。
 */
export async function sendExpoPushToUser(
  userId: string,
  payload: {
    title: string
    body: string
    data?: Record<string, string>
  },
): Promise<void> {
  const devices = await prisma.mobileDevice.findMany({
    where: { userId },
    select: { id: true, token: true },
  })

  if (devices.length === 0) return

  const accessToken = process.env['EXPO_ACCESS_TOKEN']

  // Expo は最大 EXPO_PUSH_BATCH_SIZE 件/リクエスト。チャンクに分けて送る。
  const chunks: (typeof devices)[] = []
  for (let i = 0; i < devices.length; i += EXPO_PUSH_BATCH_SIZE) {
    chunks.push(devices.slice(i, i + EXPO_PUSH_BATCH_SIZE))
  }

  for (const chunk of chunks) {
    const messages: ExpoPushMessage[] = chunk.map((d) => ({
      to: d.token,
      title: payload.title,
      body: payload.body,
      ...(payload.data ? { data: payload.data } : {}),
      sound: 'default',
    }))

    let response: Response
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      }
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      response = await fetch(EXPO_PUSH_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(EXPO_PUSH_TIMEOUT_MS),
      })
    } catch (err) {
      logger.error('Expo Push: fetch failed', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    if (!response.ok) {
      logger.error('Expo Push: non-OK response', {
        userId,
        status: response.status,
      })
      continue
    }

    let parsed: ExpoPushResponse | null
    try {
      const json: unknown = await response.json()
      parsed = parseExpoPushResponse(json)
    } catch (err) {
      logger.error('Expo Push: response parse failed', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    if (!parsed) {
      logger.error('Expo Push: unexpected response shape', { userId })
      continue
    }

    const expiredIds: string[] = []
    parsed.data.forEach((ticket, idx) => {
      if (ticket.status === 'error') {
        const errorKind = extractExpoErrorKind(ticket)
        if (errorKind === 'DeviceNotRegistered' || errorKind === 'InvalidCredentials') {
          const device = chunk[idx]
          if (device) expiredIds.push(device.id)
        } else {
          // 機密（トークン・Expo レスポンス全文）はログに出さない
          logger.error('Expo Push: ticket error', {
            userId,
            errorKind,
          })
        }
      }
    })

    if (expiredIds.length > 0) {
      try {
        await prisma.mobileDevice.deleteMany({
          where: { id: { in: expiredIds } },
        })
        logger.info(`Expo Push: deleted ${expiredIds.length} expired device(s) for user ${userId}`)
      } catch (err) {
        logger.error('Expo Push: failed to delete expired devices', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }
}
