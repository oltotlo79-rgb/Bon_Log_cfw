// @vitest-environment node
import { vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

describe('ensureWebhookEventOnce', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (!mockPrisma.webhookEvent) {
      // テストモックに WebhookEvent がない場合は注入
      // (createMockPrismaClient のテストヘルパー側に追加されていない可能性に備える)
      ;(mockPrisma as unknown as { webhookEvent: { create: ReturnType<typeof vi.fn> } }).webhookEvent = {
        create: vi.fn(),
      }
    }
  })

  it('初回イベントは alreadyProcessed=false を返す', async () => {
    ;(mockPrisma.webhookEvent.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: 'rec-1' })

    const { ensureWebhookEventOnce } = await import('@/lib/services/webhook-idempotency')
    const result = await ensureWebhookEventOnce('stripe', 'evt_123')

    expect(result.alreadyProcessed).toBe(false)
    expect(mockPrisma.webhookEvent.create).toHaveBeenCalledWith({
      data: { provider: 'stripe', eventId: 'evt_123' },
      select: { id: true },
    })
  })

  it('UNIQUE 制約違反 (P2002) は alreadyProcessed=true を返す', async () => {
    const uniqueErr = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '6.x' },
    )
    ;(mockPrisma.webhookEvent.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(uniqueErr)

    const { ensureWebhookEventOnce } = await import('@/lib/services/webhook-idempotency')
    const result = await ensureWebhookEventOnce('stripe', 'evt_123')

    expect(result.alreadyProcessed).toBe(true)
  })

  it('UNIQUE 違反以外のエラーは呼び出し元に伝播する', async () => {
    const dbErr = new Error('Connection refused')
    ;(mockPrisma.webhookEvent.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(dbErr)

    const { ensureWebhookEventOnce } = await import('@/lib/services/webhook-idempotency')
    await expect(ensureWebhookEventOnce('stripe', 'evt_123')).rejects.toThrow('Connection refused')
  })
})
