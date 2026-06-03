// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const ACTOR = 'actor-id'
const TARGET = 'target-id'

describe('checkInteractionEligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.block.findFirst.mockResolvedValue(null)
  })

  it('対象が存在しなければ not_found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { checkInteractionEligibility } = await import('@/lib/services/user-eligibility')
    expect(await checkInteractionEligibility(ACTOR, TARGET)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('対象が停止中なら not_found（存在を秘匿）', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: TARGET, isPublic: true, isSuspended: true, email: 't@example.com' })
    const { checkInteractionEligibility } = await import('@/lib/services/user-eligibility')
    expect(await checkInteractionEligibility(ACTOR, TARGET)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('対象がゲストなら not_found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: TARGET, isPublic: true, isSuspended: false, email: 'guest@example.com' })
    const { checkInteractionEligibility } = await import('@/lib/services/user-eligibility')
    expect(await checkInteractionEligibility(ACTOR, TARGET)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('双方向 block があれば blocked', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: TARGET, isPublic: true, isSuspended: false, email: 't@example.com' })
    mockPrisma.block.findFirst.mockResolvedValue({ blockerId: TARGET })
    const { checkInteractionEligibility } = await import('@/lib/services/user-eligibility')
    expect(await checkInteractionEligibility(ACTOR, TARGET)).toEqual({ ok: false, reason: 'blocked' })
  })

  it('停止/ゲストは block より優先して秘匿する', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: TARGET, isPublic: true, isSuspended: true, email: 't@example.com' })
    mockPrisma.block.findFirst.mockResolvedValue({ blockerId: TARGET })
    const { checkInteractionEligibility } = await import('@/lib/services/user-eligibility')
    expect(await checkInteractionEligibility(ACTOR, TARGET)).toEqual({ ok: false, reason: 'not_found' })
  })

  it('適格なら ok と target.isPublic を返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: TARGET, isPublic: false, isSuspended: false, email: 't@example.com' })
    const { checkInteractionEligibility } = await import('@/lib/services/user-eligibility')
    expect(await checkInteractionEligibility(ACTOR, TARGET)).toEqual({ ok: true, target: { id: TARGET, isPublic: false } })
  })

  it('block 判定は双方向（actor→target / target→actor）を OR で見る', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: TARGET, isPublic: true, isSuspended: false, email: 't@example.com' })
    const { checkInteractionEligibility } = await import('@/lib/services/user-eligibility')
    await checkInteractionEligibility(ACTOR, TARGET)
    expect(mockPrisma.block.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { blockerId: ACTOR, blockedId: TARGET },
            { blockerId: TARGET, blockedId: ACTOR },
          ],
        },
        select: { blockerId: true },
      }),
    )
  })
})
