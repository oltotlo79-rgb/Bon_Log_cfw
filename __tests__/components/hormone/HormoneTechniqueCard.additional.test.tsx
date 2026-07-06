import { describe, it, expect } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { HormoneTechniqueCard } from '@/components/hormone/HormoneTechniqueCard'

/**
 * hormone-components.test.tsx でカバーされていない分岐を補完する:
 * - getTechniquePrefix の 針金/根・植え替え/葉刈り パターン
 * - effectType / magnitude がラベルマップに存在しない場合の生値フォールバック
 */
describe('HormoneTechniqueCard - 追加カバレッジテスト', () => {
  it('技法名に「針金」を含む場合 technique-wiring 画像を表示する', () => {
    render(
      <HormoneTechniqueCard
        techniqueName="針金かけ"
        techniqueNameEn={null}
        description="幹や枝に針金をかけて形を整える"
        effects={[]}
      />
    )

    const images = screen.getAllByAltText('針金かけ')
    expect(images.some((img) => img.getAttribute('src')?.includes('technique-wiring'))).toBe(true)
  })

  it('技法名に「植え替え」を含む場合 technique-root-cutting 画像を表示する', () => {
    render(
      <HormoneTechniqueCard
        techniqueName="植え替え"
        techniqueNameEn={null}
        description="鉢から抜いて根を整理する"
        effects={[]}
      />
    )

    const images = screen.getAllByAltText('植え替え')
    expect(images.some((img) => img.getAttribute('src')?.includes('technique-root-cutting'))).toBe(true)
  })

  it('技法名に「根」を含む場合も technique-root-cutting 画像を表示する', () => {
    render(
      <HormoneTechniqueCard
        techniqueName="根の整理"
        techniqueNameEn={null}
        description="細根を整理する"
        effects={[]}
      />
    )

    const images = screen.getAllByAltText('根の整理')
    expect(images.some((img) => img.getAttribute('src')?.includes('technique-root-cutting'))).toBe(true)
  })

  it('技法名に「葉刈り」を含む場合 technique-defoliation 画像を表示する', () => {
    render(
      <HormoneTechniqueCard
        techniqueName="葉刈り"
        techniqueNameEn={null}
        description="葉を刈り込んで芽吹きを促す"
        effects={[]}
      />
    )

    const images = screen.getAllByAltText('葉刈り')
    expect(images.some((img) => img.getAttribute('src')?.includes('technique-defoliation'))).toBe(true)
  })

  it('effectType が未知の場合でもバッジを表示し、生値をそのまま表示する（無言で消えない）', () => {
    // 色マップ（TECHNIQUE_EFFECT_TYPE_COLORS）に無い effectType でも
    // effect.effectType の有無だけでバッジ表示を判断するため、情報が欠落せず
    // 生値がそのまま画面に表示される。色はニュートラルクラスにフォールバックする。
    const { container } = render(
      <HormoneTechniqueCard
        techniqueName="その他の技法"
        techniqueNameEn={null}
        description="desc"
        effects={[
          {
            hormoneName: 'オーキシン',
            hormoneSlug: 'auxin',
            effectType: 'unknown-effect-type',
            magnitude: 'strong',
            mechanism: null,
          },
        ]}
      />
    )

    expect(screen.getByText('オーキシン')).toBeInTheDocument()
    const badge = screen.getByText('unknown-effect-type')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-muted-foreground/20', 'text-muted-foreground')
    // 既知タイプ用の色クラスは付与されない
    expect(badge).not.toHaveClass('bg-green-100', 'bg-red-100', 'bg-blue-100')
    expect(container.querySelectorAll('.rounded-full')).toHaveLength(1)
  })

  it('effectType が既知の場合は従来通りラベル文字列と色クラスを表示する（回帰なし）', () => {
    render(
      <HormoneTechniqueCard
        techniqueName="摘芯"
        techniqueNameEn={null}
        description="desc"
        effects={[
          {
            hormoneName: 'オーキシン',
            hormoneSlug: 'auxin',
            effectType: 'increase',
            magnitude: 'strong',
            mechanism: null,
          },
        ]}
      />
    )

    const badge = screen.getByText('増加')
    expect(badge).toBeInTheDocument()
    expect(screen.queryByText('increase')).not.toBeInTheDocument()
    expect(badge).toHaveClass('bg-green-100', 'text-green-800')
    expect(badge).not.toHaveClass('bg-muted-foreground/20')
  })

  it('magnitude がラベルマップに無い場合は生の値をそのまま表示する', () => {
    render(
      <HormoneTechniqueCard
        techniqueName="その他の技法"
        techniqueNameEn={null}
        description="desc"
        effects={[
          {
            hormoneName: 'オーキシン',
            hormoneSlug: 'auxin',
            effectType: 'increase',
            magnitude: 'unknown-magnitude',
            mechanism: null,
          },
        ]}
      />
    )

    expect(screen.getByText('（影響度: unknown-magnitude）')).toBeInTheDocument()
  })
})
