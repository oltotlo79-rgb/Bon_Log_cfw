// @vitest-environment jsdom

import { vi, describe, it, expect, beforeAll } from 'vitest'
import type { ErrorEvent } from '@sentry/nextjs'

// Sentry.init に渡される options を捕捉する
let capturedInit: { beforeSend?: (event: ErrorEvent, hint?: unknown) => ErrorEvent | null } = {}
vi.mock('@sentry/nextjs', () => ({
  init: (opts: typeof capturedInit) => {
    capturedInit = opts
  },
  captureRouterTransitionStart: vi.fn(),
}))

function makeEvent(frameFunctions: string[]): ErrorEvent {
  return {
    exception: {
      values: [
        {
          type: 'TypeError',
          value: "Cannot read properties of null (reading 'parentNode')",
          stacktrace: { frames: frameFunctions.map((function_) => ({ function: function_ })) },
        },
      ],
    },
  } as unknown as ErrorEvent
}

describe('instrumentation-client beforeSend', () => {
  beforeAll(async () => {
    // production パスを通すことで NODE_ENV 早期 return に隠れず streaming フィルタを検証する
    vi.stubEnv('NODE_ENV', 'production')
    await import('@/instrumentation-client')
  })

  it('React streaming ランタイム($RS)の parentNode エラーは除外する', () => {
    const result = capturedInit.beforeSend?.(makeEvent(['$RS']), {})
    expect(result).toBeNull()
  })

  it('$RC / $RM など他の $R<英大文字> ランタイムフレームも除外する', () => {
    expect(capturedInit.beforeSend?.(makeEvent(['someAppFn', '$RC']), {})).toBeNull()
    expect(capturedInit.beforeSend?.(makeEvent(['$RM']), {})).toBeNull()
  })

  it('アプリ由来の通常エラーは除外せず送信する', () => {
    const event = makeEvent(['handleClick', 'EventDetailPage'])
    const result = capturedInit.beforeSend?.(event, {})
    expect(result).toBe(event)
  })

  it('$R に似たアプリ識別子($Render 等)は誤って除外しない', () => {
    const event = makeEvent(['$Render', '$RSomething'])
    const result = capturedInit.beforeSend?.(event, {})
    expect(result).toBe(event)
  })
})
