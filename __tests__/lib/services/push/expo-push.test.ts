// @vitest-environment node
/**
 * lib/services/push/expo-push のユニットテスト
 *
 * - デバイスなし早期 return
 * - fetch 成功 + 全チケット ok → deleteMany 呼ばれない
 * - DeviceNotRegistered チケット → deleteMany が呼ばれる
 * - fetch タイムアウト/reject → throw しない
 * - non-OK HTTP レスポンス → throw しない
 * - EXPO_ACCESS_TOKEN 未設定 → Authorization ヘッダなし
 * - EXPO_ACCESS_TOKEN 設定時 → Authorization: Bearer <token>
 * - デバイス数 > EXPO_PUSH_BATCH_SIZE → fetch が複数回呼ばれる
 * - payload の title/body/data が Expo メッセージに反映される
 * - トークン等の機密がログに出ないこと
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// mobileDevice の findMany / deleteMany を個別に持つモックを用意する。
// vitest.setup.tsx のグローバル vi.mock('@/lib/db') は mobileDevice を含まないため
// ここでファイルスコープのモックを上書きする。
const mockMobileDeviceFindMany = vi.fn()
const mockMobileDeviceDeleteMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    mobileDevice: {
      findMany: (...args: unknown[]) => mockMobileDeviceFindMany(...args),
      deleteMany: (...args: unknown[]) => mockMobileDeviceDeleteMany(...args),
    },
  },
}))

// logger はグローバルモック済みだが、テストでスパイとして参照するためここで取得する。
// vi.mock('@/lib/logger') は vitest.setup.tsx 側で宣言済み。テスト内で
// `vi.mocked(logger.error)` として使える。
import logger from '@/lib/logger'

// EXPO_PUSH_BATCH_SIZE の実値を取得して境界値テストに使う。
import { EXPO_PUSH_BATCH_SIZE } from '@/lib/constants/limits'

// global.fetch をモック化する（外部ネットワーク禁止）。
const mockFetch = vi.fn()

describe('sendExpoPushToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // global.fetch を差し替える。
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    // stub は afterEach でリセットする。
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  // -------------------------------------------------------------------------
  // 1. デバイスなし → 早期 return（fetch 呼ばれない）
  // -------------------------------------------------------------------------
  it('デバイスが存在しない場合、fetch を呼ばずに return する', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([])

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await expect(sendExpoPushToUser('user-1', { title: 'T', body: 'B' })).resolves.toBeUndefined()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 2. fetch 成功 + 全チケット ok → deleteMany 呼ばれない
  // -------------------------------------------------------------------------
  it('全チケット status=ok の場合、deleteMany を呼ばない', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
      { id: 'device-2', token: 'ExponentPushToken[bbb]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: 'ok', id: 'ticket-1' },
          { status: 'ok', id: 'ticket-2' },
        ],
      }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: 'Hello', body: 'World' })

    expect(mockMobileDeviceDeleteMany).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 3. DeviceNotRegistered チケット → mobileDevice.deleteMany が該当トークンで呼ばれる
  // -------------------------------------------------------------------------
  it('DeviceNotRegistered チケットがある場合、対象デバイス ID を deleteMany する', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[good]' },
      { id: 'device-2', token: 'ExponentPushToken[bad]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: 'ok', id: 'ticket-1' },
          { status: 'error', message: 'Not registered', details: { error: 'DeviceNotRegistered' } },
        ],
      }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: 'T', body: 'B' })

    expect(mockMobileDeviceDeleteMany).toHaveBeenCalledOnce()
    expect(mockMobileDeviceDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['device-2'] } },
    })
  })

  it('InvalidCredentials チケットがある場合も deleteMany する', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-x', token: 'ExponentPushToken[invalid]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: 'error', message: 'Invalid', details: { error: 'InvalidCredentials' } },
        ],
      }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-2', { title: 'T', body: 'B' })

    expect(mockMobileDeviceDeleteMany).toHaveBeenCalledOnce()
    expect(mockMobileDeviceDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['device-x'] } },
    })
  })

  // -------------------------------------------------------------------------
  // 4. fetch タイムアウト/reject → 例外を throw せず return
  // -------------------------------------------------------------------------
  it('fetch が reject（タイムアウト等）しても例外を throw しない', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    // throw しないことを確認（resolves.toBeUndefined）
    await expect(sendExpoPushToUser('user-1', { title: 'T', body: 'B' })).resolves.toBeUndefined()
  })

  it('fetch がネットワークエラーで reject しても例外を throw しない', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await expect(sendExpoPushToUser('user-1', { title: 'T', body: 'B' })).resolves.toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 5. non-OK HTTP レスポンス → ログのみ・throw しない
  // -------------------------------------------------------------------------
  it('HTTP 500 レスポンスの場合、throw せず logger.error を呼ぶ', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({ ok: false, status: 500 })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await expect(sendExpoPushToUser('user-1', { title: 'T', body: 'B' })).resolves.toBeUndefined()

    expect(vi.mocked(logger.error)).toHaveBeenCalled()
    expect(mockMobileDeviceDeleteMany).not.toHaveBeenCalled()
  })

  it('HTTP 429 レスポンスの場合もエラーを握りつぶす', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({ ok: false, status: 429 })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await expect(sendExpoPushToUser('user-1', { title: 'T', body: 'B' })).resolves.toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 6a. EXPO_ACCESS_TOKEN 未設定 → Authorization ヘッダなしで fetch 呼ばれる
  // -------------------------------------------------------------------------
  it('EXPO_ACCESS_TOKEN 未設定のとき Authorization ヘッダを含まずに fetch する', async () => {
    vi.stubEnv('EXPO_ACCESS_TOKEN', '')

    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: 'T', body: 'B' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = options.headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 6b. EXPO_ACCESS_TOKEN 設定時 → Authorization: Bearer <token> ヘッダ付き
  // -------------------------------------------------------------------------
  it('EXPO_ACCESS_TOKEN 設定時は Authorization: Bearer <token> を付与する', async () => {
    vi.stubEnv('EXPO_ACCESS_TOKEN', 'my-secret-access-token')

    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: 'T', body: 'B' })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const headers = options.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-secret-access-token')
  })

  // -------------------------------------------------------------------------
  // 7. デバイス数 > EXPO_PUSH_BATCH_SIZE → バッチ分割（fetch が複数回呼ばれる）
  // -------------------------------------------------------------------------
  it(`デバイス数が EXPO_PUSH_BATCH_SIZE(${EXPO_PUSH_BATCH_SIZE}) を超える場合、fetch を複数回呼ぶ`, async () => {
    const deviceCount = EXPO_PUSH_BATCH_SIZE + 3
    const devices = Array.from({ length: deviceCount }, (_, i) => ({
      id: `device-${i}`,
      token: `ExponentPushToken[${i}]`,
    }))

    mockMobileDeviceFindMany.mockResolvedValue(devices)

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: Array.from({ length: EXPO_PUSH_BATCH_SIZE }, () => ({ status: 'ok', id: 'ticket' })),
      }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: 'T', body: 'B' })

    // 103件のデバイスがあれば fetch は2回呼ばれるはず（100件 + 3件）
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('バッチ送信で最後のチャンクも処理される', async () => {
    const deviceCount = EXPO_PUSH_BATCH_SIZE + 1
    const devices = Array.from({ length: deviceCount }, (_, i) => ({
      id: `device-${i}`,
      token: `ExponentPushToken[${i}]`,
    }))

    mockMobileDeviceFindMany.mockResolvedValue(devices)

    // 1回目: 100件のチケット ok
    // 2回目: 1件のチケット ok
    let callCount = 0
    mockFetch.mockImplementation(async () => {
      callCount++
      const size = callCount === 1 ? EXPO_PUSH_BATCH_SIZE : 1
      return {
        ok: true,
        json: async () => ({
          data: Array.from({ length: size }, () => ({ status: 'ok', id: 'ticket' })),
        }),
      }
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: 'T', body: 'B' })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    // deleteMany は呼ばれない（全 ok）
    expect(mockMobileDeviceDeleteMany).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 8. payload の title/body/data が Expo メッセージに反映される
  // -------------------------------------------------------------------------
  it('payload の title・body が fetch のリクエストボディに含まれる', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: '盆栽の通知', body: 'コメントが届きました' })

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string) as unknown[]
    expect(body).toHaveLength(1)
    const msg = body[0] as Record<string, unknown>
    expect(msg['title']).toBe('盆栽の通知')
    expect(msg['body']).toBe('コメントが届きました')
    expect(msg['to']).toBe('ExponentPushToken[aaa]')
  })

  it('payload に data が含まれる場合、メッセージに data フィールドが付く', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', {
      title: 'T',
      body: 'B',
      data: { postId: 'post-123', type: 'like' },
    })

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string) as unknown[]
    const msg = body[0] as Record<string, unknown>
    expect(msg['data']).toEqual({ postId: 'post-123', type: 'like' })
  })

  it('payload に data がない場合、メッセージに data フィールドが含まれない', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: 'T', body: 'B' })

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(options.body as string) as unknown[]
    const msg = body[0] as Record<string, unknown>
    expect(msg['data']).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 8b. 機密（トークン）がログに出ないこと
  // -------------------------------------------------------------------------
  it('エラーログにプッシュトークンが含まれない', async () => {
    const secretToken = 'ExponentPushToken[SecretToken12345]'
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: secretToken },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: 'error', message: 'err', details: { error: 'SomeOtherError' } },
        ],
      }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: 'T', body: 'B' })

    // logger.error が呼ばれたとき、引数にトークン文字列が含まれていないことを確認する。
    const loggerErrorMock = vi.mocked(logger.error)
    expect(loggerErrorMock).toHaveBeenCalled()

    const allCallArgs = loggerErrorMock.mock.calls.flatMap((args) =>
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))),
    )
    const joined = allCallArgs.join(' ')
    expect(joined).not.toContain(secretToken)
  })

  it('fetch reject 後のエラーログにトークンが含まれない', async () => {
    const secretToken = 'ExponentPushToken[AnotherSecret]'
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: secretToken },
    ])

    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await sendExpoPushToUser('user-1', { title: 'T', body: 'B' })

    const loggerErrorMock = vi.mocked(logger.error)
    const allCallArgs = loggerErrorMock.mock.calls.flatMap((args) =>
      args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))),
    )
    const joined = allCallArgs.join(' ')
    expect(joined).not.toContain(secretToken)
  })

  // -------------------------------------------------------------------------
  // 追加: レスポンス JSON が不正な形状の場合もエラーを握りつぶす
  // -------------------------------------------------------------------------
  it('レスポンス JSON が不正（data プロパティなし）の場合、throw しない', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: 'shape' }),
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await expect(sendExpoPushToUser('user-1', { title: 'T', body: 'B' })).resolves.toBeUndefined()
    expect(vi.mocked(logger.error)).toHaveBeenCalled()
  })

  it('response.json() が throw した場合もエラーを握りつぶす', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token')
      },
    })

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await expect(sendExpoPushToUser('user-1', { title: 'T', body: 'B' })).resolves.toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 追加: deleteMany 自体が throw した場合もエラーを握りつぶす
  // -------------------------------------------------------------------------
  it('deleteMany が throw した場合もエラーを握りつぶす', async () => {
    mockMobileDeviceFindMany.mockResolvedValue([
      { id: 'device-1', token: 'ExponentPushToken[aaa]' },
    ])

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { status: 'error', message: 'err', details: { error: 'DeviceNotRegistered' } },
        ],
      }),
    })

    mockMobileDeviceDeleteMany.mockRejectedValue(new Error('DB error'))

    const { sendExpoPushToUser } = await import('@/lib/services/push/expo-push')
    await expect(sendExpoPushToUser('user-1', { title: 'T', body: 'B' })).resolves.toBeUndefined()
  })
})
