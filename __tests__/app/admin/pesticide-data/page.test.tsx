/**
 * /admin/pesticide-data/[id] 詳細ページ - Server Component テスト
 *
 * - getAdminPesticideDetail がエラー/null を返した場合 notFound() に寄せる
 * - generateMetadata: タイトルが農薬名 + " - 農薬データ管理 | BON-LOG 管理" になる
 * - 取得成功時: タイプバッジ・登録番号・各サブコンポーネント (Form/Relations/Timeline) に
 *   適切に props を渡す
 *
 * 既存のテスト基盤と同じく Server Component を直接 render し、
 * useFormState 等を要する Client Component は最小モックに置き換える。
 */

import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockNotFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

const mockGetAdminPesticideDetail = vi.fn()
vi.mock('@/lib/actions/admin/pesticide-data', () => ({
  getAdminPesticideDetail: (id: string) => mockGetAdminPesticideDetail(id),
}))

// 子コンポーネントは Form / Relations / Timeline の表示が確認できる最小モックに
vi.mock('@/app/admin/pesticide-data/[id]/PesticideEditForm', () => ({
  PesticideEditForm: ({ id, initial }: { id: string; initial: { name: string } }) => (
    <div data-testid="edit-form" data-id={id} data-name={initial.name}>edit-form</div>
  ),
}))
vi.mock('@/app/admin/pesticide-data/[id]/PesticideRelations', () => ({
  PesticideRelations: (props: { ingredients: unknown[]; effects: unknown[]; incompatibles: unknown[] }) => (
    <div
      data-testid="relations"
      data-ingredients={props.ingredients.length}
      data-effects={props.effects.length}
      data-incompatibles={props.incompatibles.length}
    >
      relations
    </div>
  ),
}))
vi.mock('@/app/admin/pesticide-data/[id]/PesticideHistoryTimeline', () => ({
  PesticideHistoryTimeline: ({ history }: { history: unknown[] }) => (
    <div data-testid="history" data-count={history.length}>history</div>
  ),
}))

import PesticideDetailPage, { generateMetadata } from '@/app/admin/pesticide-data/[id]/page'

const buildPesticide = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'テスト農薬',
  registrationNumber: '12345',
  pesticideType: 'fungicide' as const,
  description: '説明',
  formulationType: { name: '水和剤' },
  ingredients: [
    {
      activeIngredient: { name: 'ベノミル', fracCode: '1', iracCode: null },
      contentLabel: '50%',
    },
  ],
  effects: [
    {
      id: 'e1',
      diseasePest: { name: 'うどんこ病', category: 'disease' },
      preventionLevel: 3,
      treatmentLevel: 2,
      efficacyLevel: 'high',
      note: null,
    },
  ],
  incompatibleWith: [
    { incompatibleWith: { id: 'p2', name: '別農薬' } },
  ],
  spreaderTypes: [],
  ...overrides,
})

const buildHistory = () => [
  { id: 'h1', action: 'update', performedBy: 'admin1', createdAt: new Date(), changes: { name: 'old→new' } },
]

describe('PesticideDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('action がエラーを返した場合 notFound() を呼ぶ', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce({ error: '権限がありません' })
    await expect(
      PesticideDetailPage({ params: Promise.resolve({ id: 'no-perm' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalledTimes(1)
  })

  it('action が null/undefined を返した場合も notFound() に寄せる', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce(null)
    await expect(
      PesticideDetailPage({ params: Promise.resolve({ id: 'gone' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('成功時: タイトル・登録番号・タイプバッジを表示する', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce({
      pesticide: buildPesticide({ pesticideType: 'fungicide' }),
      history: buildHistory(),
    })

    const ui = await PesticideDetailPage({ params: Promise.resolve({ id: 'p1' }) })
    render(ui as React.ReactElement)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('テスト農薬')
    expect(screen.getByText(/登録番号: 12345/)).toBeInTheDocument()
    expect(screen.getByText('殺菌剤')).toBeInTheDocument() // fungicide ラベル
  })

  it('登録番号が null の場合は登録番号行が出ない', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce({
      pesticide: buildPesticide({ registrationNumber: null }),
      history: [],
    })

    const ui = await PesticideDetailPage({ params: Promise.resolve({ id: 'p1' }) })
    render(ui as React.ReactElement)
    expect(screen.queryByText(/登録番号:/)).not.toBeInTheDocument()
  })

  it('タイプバッジは pesticideType ごとに変わる: insecticide → 殺虫剤', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce({
      pesticide: buildPesticide({ pesticideType: 'insecticide' }),
      history: [],
    })
    const ui = await PesticideDetailPage({ params: Promise.resolve({ id: 'p1' }) })
    render(ui as React.ReactElement)
    expect(screen.getByText('殺虫剤')).toBeInTheDocument()
  })

  it('タイプバッジは pesticideType ごとに変わる: acaricide / compound / other', async () => {
    for (const [type, label] of [
      ['acaricide', '殺ダニ剤'],
      ['compound', '複合剤'],
      ['other', 'その他'],
    ] as const) {
      mockGetAdminPesticideDetail.mockResolvedValueOnce({
        pesticide: buildPesticide({ pesticideType: type }),
        history: [],
      })
      const ui = await PesticideDetailPage({ params: Promise.resolve({ id: 'p1' }) })
      const { unmount } = render(ui as React.ReactElement)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    }
  })

  it('PesticideEditForm に id と initial を渡す', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce({
      pesticide: buildPesticide(),
      history: [],
    })
    const ui = await PesticideDetailPage({ params: Promise.resolve({ id: 'p1' }) })
    render(ui as React.ReactElement)
    const form = screen.getByTestId('edit-form')
    expect(form).toHaveAttribute('data-id', 'p1')
    expect(form).toHaveAttribute('data-name', 'テスト農薬')
  })

  it('PesticideRelations に ingredients/effects/incompatibles の数を渡す', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce({
      pesticide: buildPesticide(),
      history: [],
    })
    const ui = await PesticideDetailPage({ params: Promise.resolve({ id: 'p1' }) })
    render(ui as React.ReactElement)
    const rel = screen.getByTestId('relations')
    expect(rel).toHaveAttribute('data-ingredients', '1')
    expect(rel).toHaveAttribute('data-effects', '1')
    expect(rel).toHaveAttribute('data-incompatibles', '1')
  })

  it('PesticideHistoryTimeline に history の件数を渡す', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce({
      pesticide: buildPesticide(),
      history: buildHistory(),
    })
    const ui = await PesticideDetailPage({ params: Promise.resolve({ id: 'p1' }) })
    render(ui as React.ReactElement)
    expect(screen.getByTestId('history')).toHaveAttribute('data-count', '1')
  })

  it('formulationType が null の場合でも初期値に反映され例外を出さない', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce({
      pesticide: buildPesticide({ formulationType: null }),
      history: [],
    })
    const ui = await PesticideDetailPage({ params: Promise.resolve({ id: 'p1' }) })
    expect(() => render(ui as React.ReactElement)).not.toThrow()
  })

  it('「農薬一覧に戻る」リンクが /admin/pesticide-data に向く', async () => {
    mockGetAdminPesticideDetail.mockResolvedValueOnce({
      pesticide: buildPesticide(),
      history: [],
    })
    const ui = await PesticideDetailPage({ params: Promise.resolve({ id: 'p1' }) })
    render(ui as React.ReactElement)
    const link = screen.getByRole('link', { name: /農薬一覧に戻る/ })
    expect(link).toHaveAttribute('href', '/admin/pesticide-data')
  })

  describe('generateMetadata', () => {
    it('成功時はタイトルに農薬名を含める', async () => {
      mockGetAdminPesticideDetail.mockResolvedValueOnce({
        pesticide: buildPesticide({ name: 'マイ農薬' }),
        history: [],
      })
      const meta = await generateMetadata({ params: Promise.resolve({ id: 'p1' }) })
      expect(meta.title).toBe('マイ農薬 - 農薬データ管理 | BON-LOG 管理')
      expect(meta.robots).toEqual({ index: false, follow: false })
    })

    it('action がエラーを返した場合は title が "詳細" にフォールバックする', async () => {
      mockGetAdminPesticideDetail.mockResolvedValueOnce({ error: 'forbidden' })
      const meta = await generateMetadata({ params: Promise.resolve({ id: 'p1' }) })
      expect(meta.title).toBe('詳細 - 農薬データ管理 | BON-LOG 管理')
    })

    it('action が null を返した場合も title は "詳細"', async () => {
      mockGetAdminPesticideDetail.mockResolvedValueOnce(null)
      const meta = await generateMetadata({ params: Promise.resolve({ id: 'p1' }) })
      expect(meta.title).toBe('詳細 - 農薬データ管理 | BON-LOG 管理')
    })
  })
})
