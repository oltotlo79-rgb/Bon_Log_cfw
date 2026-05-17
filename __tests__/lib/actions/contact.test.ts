import { vi } from 'vitest'
import { submitContactInquiry, getContactInquiries, getContactStats, getContactInquiry, updateInquiryStatus, deleteInquiry } from '@/lib/actions/contact'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { sendEmail } from '@/lib/email'

// ============================================================
// モック設定
// ============================================================

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    contactInquiry: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    adminUser: {
      findUnique: vi.fn(),
    },
    adminLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 2, resetTime: Date.now() + 900000 }),
  RATE_LIMITS: { contact: { windowMs: 900000, maxRequests: 3 } },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

// ============================================================
// テストデータ
// ============================================================

const mockInquiry = {
  id: 'inquiry-1',
  name: 'テストユーザー',
  email: 'test@example.com',
  category: 'general',
  subject: 'お問い合わせ',
  message: 'テストメッセージです。10文字以上の内容が必要です。',
  status: 'pending',
  adminNote: null,
  respondedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

const mockSession = {
  user: {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
  },
}

const mockAdminUser = {
  id: 'admin-user-1',
  userId: 'admin-1',
  role: 'admin' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ============================================================
// テスト
// ============================================================

describe('contact actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // submitContactInquiry
  // ============================================================

  describe('submitContactInquiry', () => {
    const validData = {
      name: 'テストユーザー',
      email: 'test@example.com',
      category: 'general',
      subject: 'お問い合わせ',
      message: 'テストメッセージです。10文字以上の内容が必要です。',
    }

    beforeEach(() => {
      (prisma.contactInquiry.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockInquiry)
      ;(sendEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })
    })

    it('returns error for empty name', async () => {
      const result = await submitContactInquiry({ ...validData, name: '' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('お名前を入力してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('returns error for empty name (whitespace)', async () => {
      const result = await submitContactInquiry({ ...validData, name: '   ' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('お名前を入力してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('returns error for empty email', async () => {
      const result = await submitContactInquiry({ ...validData, email: '' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('メールアドレスを入力してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('returns error for invalid email format', async () => {
      const result = await submitContactInquiry({ ...validData, email: 'invalid-email' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('有効なメールアドレスを入力してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('returns error for invalid email format (missing @)', async () => {
      const result = await submitContactInquiry({ ...validData, email: 'test.example.com' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('有効なメールアドレスを入力してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('returns error for invalid email format (missing domain)', async () => {
      const result = await submitContactInquiry({ ...validData, email: 'test@' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('有効なメールアドレスを入力してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('returns error for invalid category', async () => {
      const result = await submitContactInquiry({ ...validData, category: 'invalid' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('カテゴリを選択してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('returns error for empty subject', async () => {
      const result = await submitContactInquiry({ ...validData, subject: '' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('件名を入力してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('returns error for message less than 10 chars', async () => {
      const result = await submitContactInquiry({ ...validData, message: '短い' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('お問い合わせ内容は10文字以上で入力してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('returns error for empty message', async () => {
      const result = await submitContactInquiry({ ...validData, message: '' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('お問い合わせ内容は10文字以上で入力してください')
      expect(prisma.contactInquiry.create).not.toHaveBeenCalled()
    })

    it('creates inquiry and sends email on valid input', async () => {
      const result = await submitContactInquiry(validData)

      expect(result.success).toBe(true)
      expect(prisma.contactInquiry.create).toHaveBeenCalledWith({
        data: {
          name: validData.name,
          email: validData.email,
          category: validData.category,
          subject: validData.subject,
          message: validData.message,
        },
      })

      // 送信者への確認メール
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: validData.email,
          subject: '【BON-LOG】お問い合わせを受け付けました',
        })
      )

      // 管理者への通知メールは ADMIN_EMAIL が設定されていない場合は送信されない
      expect(sendEmail).toHaveBeenCalledTimes(1)
    })

    it('sends admin notification if ADMIN_EMAIL is set', async () => {
      const originalAdminEmail = process.env.ADMIN_EMAIL
      process.env.ADMIN_EMAIL = 'admin@example.com'

      const result = await submitContactInquiry(validData)

      expect(result.success).toBe(true)
      expect(sendEmail).toHaveBeenCalledTimes(2)

      // 送信者への確認メール
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: validData.email,
          subject: '【BON-LOG】お問い合わせを受け付けました',
        })
      )

      // 管理者への通知メール
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: expect.stringContaining('新規お問い合わせ'),
        })
      )

      // 環境変数を元に戻す
      if (originalAdminEmail !== undefined) {
        process.env.ADMIN_EMAIL = originalAdminEmail
      } else {
        delete process.env.ADMIN_EMAIL
      }
    })

    it('trims whitespace from inputs', async () => {
      const dataWithSpaces = {
        name: '  テストユーザー  ',
        email: 'test@example.com',
        category: 'general',
        subject: '  お問い合わせ  ',
        message: '  テストメッセージです。10文字以上の内容が必要です。  ',
      }

      const result = await submitContactInquiry(dataWithSpaces)

      expect(result.success).toBe(true)
      expect(prisma.contactInquiry.create).toHaveBeenCalledWith({
        data: {
          name: 'テストユーザー',
          email: 'test@example.com',
          category: 'general',
          subject: 'お問い合わせ',
          message: 'テストメッセージです。10文字以上の内容が必要です。',
        },
      })
    })


    it('accepts all valid categories', async () => {
      const categories = ['general', 'account', 'bug', 'feature', 'premium', 'other']

      for (const category of categories) {
        vi.clearAllMocks()
        ;(prisma.contactInquiry.create as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockInquiry, category })

        const result = await submitContactInquiry({ ...validData, category })
        expect(result.success).toBe(true)
        expect(prisma.contactInquiry.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ category }),
          })
        )
      }
    })

    it('returns error on prisma failure', async () => {
      (prisma.contactInquiry.create as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Database error'))

      const result = await submitContactInquiry(validData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('送信に失敗しました。しばらく経ってからお試しください。')
    })

    it('returns error on email sending failure', async () => {
      (sendEmail as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Email error'))

      const result = await submitContactInquiry(validData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('送信に失敗しました。しばらく経ってからお試しください。')
    })
  })

  // ============================================================
  // getContactInquiries
  // ============================================================

  describe('getContactInquiries', () => {
    beforeEach(() => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
      ;(prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdminUser)
      ;(prisma.contactInquiry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([mockInquiry])
      ;(prisma.contactInquiry.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)
    })

    it('returns error if not authenticated', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getContactInquiries()

      expect(result.success).toBe(false)
      expect(result.error).toBe('認証が必要です')
      expect(prisma.contactInquiry.findMany).not.toHaveBeenCalled()
    })

    it('returns error if not admin', async () => {
      (prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getContactInquiries()

      expect(result.success).toBe(false)
      expect(result.error).toBe('管理者権限が必要です')
      expect(prisma.contactInquiry.findMany).not.toHaveBeenCalled()
    })

    it('returns cursor-paginated results', async () => {
      const result = await getContactInquiries({ limit: 20 })

      expect(result).toEqual({
        success: true,
        data: {
          inquiries: [mockInquiry],
          total: 1,
          // 件数が limit 未満 → 次ページなし
          nextCursor: undefined,
        },
      })

      expect(prisma.contactInquiry.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
      })

      expect(prisma.contactInquiry.count).toHaveBeenCalledWith({ where: {} })
    })

    it('uses default pagination values', async () => {
      const result = await getContactInquiries()

      expect(result).toEqual({
        success: true,
        data: {
          inquiries: [mockInquiry],
          total: 1,
          nextCursor: undefined,
        },
      })

      expect(prisma.contactInquiry.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
      })
    })

    it('applies cursor and skip:1 when cursor is provided', async () => {
      await getContactInquiries({ cursor: 'inquiry-99', limit: 20 })

      expect(prisma.contactInquiry.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        cursor: { id: 'inquiry-99' },
        skip: 1,
      })
    })

    it('returns nextCursor when result count equals limit', async () => {
      const many = Array.from({ length: 20 }, (_, i) => ({ ...mockInquiry, id: `inquiry-${i + 1}` }))
      ;(prisma.contactInquiry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(many)
      ;(prisma.contactInquiry.count as ReturnType<typeof vi.fn>).mockResolvedValue(100)

      const result = await getContactInquiries({ limit: 20 })

      expect((result as { success: true; data: { nextCursor: string | undefined } }).data.nextCursor).toBe('inquiry-20')
    })

    it('filters by status', async () => {
      await getContactInquiries({ status: 'pending' })

      expect(prisma.contactInquiry.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
      })

      expect(prisma.contactInquiry.count).toHaveBeenCalledWith({ where: { status: 'pending' } })
    })

    it('ignores invalid status', async () => {
      await getContactInquiries({ status: 'invalid' })

      expect(prisma.contactInquiry.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
      })
    })

    it('filters by search term', async () => {
      await getContactInquiries({ search: 'test' })

      expect(prisma.contactInquiry.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'test', mode: 'insensitive' } },
            { subject: { contains: 'test', mode: 'insensitive' } },
            { name: { contains: 'test', mode: 'insensitive' } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
      })
    })

    it('combines status and search filters', async () => {
      await getContactInquiries({ status: 'pending', search: 'test' })

      expect(prisma.contactInquiry.findMany).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          OR: [
            { email: { contains: 'test', mode: 'insensitive' } },
            { subject: { contains: 'test', mode: 'insensitive' } },
            { name: { contains: 'test', mode: 'insensitive' } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
      })
    })

    it('exposes total count regardless of cursor position', async () => {
      (prisma.contactInquiry.count as ReturnType<typeof vi.fn>).mockResolvedValue(45)

      const result = await getContactInquiries({ limit: 20 })

      expect((result as { success: true; data: { total: number } }).data.total).toBe(45)
    })

    it('accepts all valid statuses', async () => {
      const statuses = ['pending', 'in_progress', 'resolved', 'closed']

      for (const status of statuses) {
        vi.clearAllMocks()
        ;(prisma.contactInquiry.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ ...mockInquiry, status }])
        ;(prisma.contactInquiry.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

        await getContactInquiries({ status })

        expect(prisma.contactInquiry.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { status },
          })
        )
      }
    })
  })

  // ============================================================
  // getContactStats
  // ============================================================

  describe('getContactStats', () => {
    beforeEach(() => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
      ;(prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdminUser)
    })

    it('returns error if not authenticated', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getContactStats()

      expect(result.success).toBe(false)
      expect(result.error).toBe('認証が必要です')
      expect(prisma.contactInquiry.count).not.toHaveBeenCalled()
    })

    it('returns error if not admin', async () => {
      (prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getContactStats()

      expect(result.success).toBe(false)
      expect(result.error).toBe('管理者権限が必要です')
      expect(prisma.contactInquiry.count).not.toHaveBeenCalled()
    })

    it('returns counts by status', async () => {
      (prisma.contactInquiry.count as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(3) // in_progress
        .mockResolvedValueOnce(10) // resolved
        .mockResolvedValueOnce(2) // closed

      const result = await getContactStats()

      expect(result).toEqual({
        success: true,
        data: {
          pending: 5,
          inProgress: 3,
          resolved: 10,
          closed: 2,
          total: 20,
        },
      })

      expect(prisma.contactInquiry.count).toHaveBeenCalledWith({ where: { status: 'pending' } })
      expect(prisma.contactInquiry.count).toHaveBeenCalledWith({ where: { status: 'in_progress' } })
      expect(prisma.contactInquiry.count).toHaveBeenCalledWith({ where: { status: 'resolved' } })
      expect(prisma.contactInquiry.count).toHaveBeenCalledWith({ where: { status: 'closed' } })
    })

    it('handles zero counts', async () => {
      (prisma.contactInquiry.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

      const result = await getContactStats()

      expect(result).toEqual({
        success: true,
        data: {
          pending: 0,
          inProgress: 0,
          resolved: 0,
          closed: 0,
          total: 0,
        },
      })
    })
  })

  // ============================================================
  // getContactInquiry
  // ============================================================

  describe('getContactInquiry', () => {
    beforeEach(() => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
      ;(prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdminUser)
      ;(prisma.contactInquiry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockInquiry)
    })

    it('returns error if not authenticated', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getContactInquiry('inquiry-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('認証が必要です')
      expect(prisma.contactInquiry.findUnique).not.toHaveBeenCalled()
    })

    it('returns error if not admin', async () => {
      (prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getContactInquiry('inquiry-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('管理者権限が必要です')
      expect(prisma.contactInquiry.findUnique).not.toHaveBeenCalled()
    })

    it('returns inquiry', async () => {
      const result = await getContactInquiry('inquiry-1')

      expect(result).toEqual({ success: true, data: { inquiry: mockInquiry } })
      expect(prisma.contactInquiry.findUnique).toHaveBeenCalledWith({
        where: { id: 'inquiry-1' },
      })
    })

    it('returns error if not found', async () => {
      (prisma.contactInquiry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await getContactInquiry('inquiry-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('お問い合わせが見つかりません')
    })
  })

  // ============================================================
  // updateInquiryStatus
  // ============================================================

  describe('updateInquiryStatus', () => {
    beforeEach(() => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
      ;(prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdminUser)
      ;(prisma.contactInquiry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockInquiry)
      ;(prisma.contactInquiry.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockInquiry)
      ;(prisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})
    })

    it('returns error if not authenticated', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await updateInquiryStatus('inquiry-1', 'in_progress')

      expect(result.success).toBe(false)
      expect(result.error).toBe('認証が必要です')
      expect(prisma.contactInquiry.update).not.toHaveBeenCalled()
    })

    it('returns error if not admin', async () => {
      (prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await updateInquiryStatus('inquiry-1', 'in_progress')

      expect(result.success).toBe(false)
      expect(result.error).toBe('管理者権限が必要です')
      expect(prisma.contactInquiry.update).not.toHaveBeenCalled()
    })

    it('returns error for invalid status', async () => {
      const result = await updateInquiryStatus('inquiry-1', 'invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('無効なステータスです')
      expect(prisma.contactInquiry.update).not.toHaveBeenCalled()
    })

    it('returns error if not found', async () => {
      (prisma.contactInquiry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await updateInquiryStatus('inquiry-1', 'in_progress')

      expect(result.success).toBe(false)
      expect(result.error).toBe('お問い合わせが見つかりません')
      expect(prisma.contactInquiry.update).not.toHaveBeenCalled()
    })

    it('updates status and creates admin log', async () => {
      const result = await updateInquiryStatus('inquiry-1', 'in_progress')

      expect(result.success).toBe(true)

      expect(prisma.contactInquiry.update).toHaveBeenCalledWith({
        where: { id: 'inquiry-1' },
        data: { status: 'in_progress' },
      })

      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: 'update_contact_status',
          targetType: 'contact_inquiry',
          targetId: 'inquiry-1',
          details: { status: 'in_progress', adminNote: null },
        },
      })

      expect(revalidatePath).toHaveBeenCalledWith('/admin/contact')
      expect(revalidatePath).toHaveBeenCalledWith('/admin/contact/inquiry-1')
    })

    it('updates status with admin note', async () => {
      const result = await updateInquiryStatus('inquiry-1', 'in_progress', '対応中です')

      expect(result.success).toBe(true)

      expect(prisma.contactInquiry.update).toHaveBeenCalledWith({
        where: { id: 'inquiry-1' },
        data: {
          status: 'in_progress',
          adminNote: '対応中です',
        },
      })

      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: 'update_contact_status',
          targetType: 'contact_inquiry',
          targetId: 'inquiry-1',
          details: { status: 'in_progress', adminNote: '対応中です' },
        },
      })
    })

    it('sets respondedAt for resolved status', async () => {
      const result = await updateInquiryStatus('inquiry-1', 'resolved')

      expect(result.success).toBe(true)

      expect(prisma.contactInquiry.update).toHaveBeenCalledWith({
        where: { id: 'inquiry-1' },
        data: {
          status: 'resolved',
          respondedAt: expect.any(Date),
        },
      })
    })

    it('sets respondedAt for closed status', async () => {
      const result = await updateInquiryStatus('inquiry-1', 'closed')

      expect(result.success).toBe(true)

      expect(prisma.contactInquiry.update).toHaveBeenCalledWith({
        where: { id: 'inquiry-1' },
        data: {
          status: 'closed',
          respondedAt: expect.any(Date),
        },
      })
    })

    it('does not set respondedAt for pending status', async () => {
      const result = await updateInquiryStatus('inquiry-1', 'pending')

      expect(result.success).toBe(true)

      expect(prisma.contactInquiry.update).toHaveBeenCalledWith({
        where: { id: 'inquiry-1' },
        data: { status: 'pending' },
      })
    })

    it('does not set respondedAt for in_progress status', async () => {
      const result = await updateInquiryStatus('inquiry-1', 'in_progress')

      expect(result.success).toBe(true)

      expect(prisma.contactInquiry.update).toHaveBeenCalledWith({
        where: { id: 'inquiry-1' },
        data: { status: 'in_progress' },
      })
    })

    it('accepts all valid statuses', async () => {
      const statuses = ['pending', 'in_progress', 'resolved', 'closed']

      for (const status of statuses) {
        vi.clearAllMocks()
        ;(prisma.contactInquiry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockInquiry)
        ;(prisma.contactInquiry.update as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockInquiry, status })

        const result = await updateInquiryStatus('inquiry-1', status)
        expect(result.success).toBe(true)
      }
    })
  })

  // ============================================================
  // deleteInquiry
  // ============================================================

  describe('deleteInquiry', () => {
    beforeEach(() => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession)
      ;(prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAdminUser)
      ;(prisma.contactInquiry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockInquiry)
      ;(prisma.contactInquiry.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockInquiry)
      ;(prisma.adminLog.create as ReturnType<typeof vi.fn>).mockResolvedValue({})
    })

    it('returns error if not authenticated', async () => {
      (auth as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await deleteInquiry('inquiry-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('認証が必要です')
      expect(prisma.contactInquiry.delete).not.toHaveBeenCalled()
    })

    it('returns error if not admin', async () => {
      (prisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await deleteInquiry('inquiry-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('管理者権限が必要です')
      expect(prisma.contactInquiry.delete).not.toHaveBeenCalled()
    })

    it('returns error if not found', async () => {
      (prisma.contactInquiry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

      const result = await deleteInquiry('inquiry-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('お問い合わせが見つかりません')
      expect(prisma.contactInquiry.delete).not.toHaveBeenCalled()
    })

    it('deletes and creates admin log', async () => {
      const result = await deleteInquiry('inquiry-1')

      expect(result.success).toBe(true)

      expect(prisma.contactInquiry.delete).toHaveBeenCalledWith({
        where: { id: 'inquiry-1' },
      })

      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: {
          adminId: 'admin-1',
          action: 'delete_contact_inquiry',
          targetType: 'contact_inquiry',
          targetId: 'inquiry-1',
          details: {
            subject: mockInquiry.subject,
            email: mockInquiry.email,
          },
        },
      })

      expect(revalidatePath).toHaveBeenCalledWith('/admin/contact')
    })

    it('logs inquiry details on deletion', async () => {
      const customInquiry = {
        ...mockInquiry,
        subject: 'カスタム件名',
        email: 'custom@example.com',
      }
      ;(prisma.contactInquiry.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(customInquiry)

      await deleteInquiry('inquiry-1')

      expect(prisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: {
            subject: 'カスタム件名',
            email: 'custom@example.com',
          },
        }),
      })
    })
  })
})

// ============================================================
// レート制限テスト
// ============================================================

describe('submitContactInquiry — レート制限', () => {
  it('レート制限超過時に ERR_CONTACT_RATE_LIMIT を返す', async () => {
    const { rateLimit } = await import('@/lib/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 900000,
    })

    const result = await submitContactInquiry({
      name: 'テストユーザー',
      email: 'test@example.com',
      category: 'general',
      subject: 'テスト件名',
      message: 'テストメッセージです。10文字以上の内容が必要です。',
    })

    expect(result).toEqual({
      success: false,
      error: 'お問い合わせの送信回数が上限に達しました。しばらく経ってからお試しください。',
    })
    // レート制限超過時はDBに書き込まないことを確認
    expect(vi.mocked(prisma.contactInquiry.create)).not.toHaveBeenCalled()
  })

  it('レート制限超過時はメール送信しない', async () => {
    const { rateLimit } = await import('@/lib/rate-limit')
    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 900000,
    })

    await submitContactInquiry({
      name: 'テストユーザー',
      email: 'test@example.com',
      category: 'general',
      subject: 'テスト件名',
      message: 'テストメッセージです。10文字以上の内容が必要です。',
    })

    expect(vi.mocked(sendEmail)).not.toHaveBeenCalled()
  })
})
