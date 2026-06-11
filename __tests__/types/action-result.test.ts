import {
  actionSuccess,
  actionError,
  withAuth,
  andThenActionResult,
  mapActionResult,
  type ActionResult,
} from '@/types/action-result'

describe('actionSuccess / actionError', () => {
  it('actionSuccess() returns { success: true } without data', () => {
    expect(actionSuccess()).toEqual({ success: true })
  })

  it('actionSuccess(data) includes the data field', () => {
    expect(actionSuccess({ id: 'x' })).toEqual({ success: true, data: { id: 'x' } })
  })

  it('actionError(message) returns { success: false, error }', () => {
    expect(actionError('NG')).toEqual({ success: false, error: 'NG' })
  })
})

describe('withAuth', () => {
  it('invokes the continuation when the gate resolves with auth data', async () => {
    const gate = Promise.resolve({ userId: 'u1' } as { userId: string } | { error: string })
    const result = await withAuth(gate, async (auth) => actionSuccess({ id: auth.userId }))
    expect(result).toEqual({ success: true, data: { id: 'u1' } })
  })

  it('short-circuits with actionError when the gate resolves with an error', async () => {
    const gate = Promise.resolve({ error: 'forbidden' } as { userId: string } | { error: string })
    const continuation = vi.fn()
    const result = await withAuth(gate, continuation)
    expect(continuation).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'forbidden' })
  })

  it('also accepts a non-Promise gate value', async () => {
    const gate = { userId: 'u1' } as { userId: string } | { error: string }
    const result = await withAuth(gate, async (auth) => actionSuccess(auth.userId))
    expect(result).toEqual({ success: true, data: 'u1' })
  })
})

describe('andThenActionResult', () => {
  it('propagates failure without invoking the continuation', async () => {
    const fail: ActionResult<number> = { success: false, error: 'bad' }
    const next = vi.fn(async () => actionSuccess(42))
    const out = await andThenActionResult(fail, next)
    expect(next).not.toHaveBeenCalled()
    expect(out).toEqual(fail)
  })

  it('runs the continuation with the previous success data', async () => {
    const ok: ActionResult<number> = { success: true, data: 3 }
    const out = await andThenActionResult(ok, async (n) =>
      actionSuccess((n ?? 0) * 2),
    )
    expect(out).toEqual({ success: true, data: 6 })
  })
})

describe('mapActionResult', () => {
  it('maps success data synchronously', () => {
    const ok: ActionResult<number> = { success: true, data: 4 }
    expect(mapActionResult(ok, (n) => (n ?? 0) + 1)).toEqual({ success: true, data: 5 })
  })

  it('leaves failures untouched', () => {
    const ng: ActionResult<number> = { success: false, error: 'x' }
    expect(mapActionResult<number, number>(ng, (n) => (n ?? 0) + 1)).toEqual(ng)
  })
})
