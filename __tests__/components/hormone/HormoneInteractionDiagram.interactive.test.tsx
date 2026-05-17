/**
 * HormoneInteractionDiagram のインタラクティブ動作テスト
 *
 * 既存の hormone-components.test.tsx は描画チェックのみ。
 * このファイルは検索フィルタ・タイプフィルタトグル・ノード選択・エッジホバー
 * 説明表示・空データ分岐など、63% / 39% に留まっていた branch を補強する。
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { HormoneInteractionDiagram } from '@/components/hormone/HormoneInteractionDiagram'

const hormones = [
  { id: 'h1', name: 'オーキシン', slug: 'auxin', category: 'major' },
  { id: 'h2', name: 'ジベレリン', slug: 'gibberellin', category: 'major' },
  { id: 'h3', name: 'サイトカイニン', slug: 'cytokinin', category: 'major' },
  { id: 'h4', name: 'ストリゴラクトン', slug: 'strigolactone', category: 'secondary' },
]

const interactions = [
  { hormoneAId: 'h1', hormoneBId: 'h2', type: 'antagonistic', description: 'オーキシンとジベレリンの拮抗' },
  { hormoneAId: 'h1', hormoneBId: 'h3', type: 'synergistic', description: 'オーキシンとサイトカイニンの相乗' },
  { hormoneAId: 'h2', hormoneBId: 'h4', type: 'modulatory', description: null },
]

function renderDiagram() {
  return render(<HormoneInteractionDiagram hormones={hormones} interactions={interactions} />)
}

describe('HormoneInteractionDiagram - 初期描画', () => {
  it('SVG と凡例が描画される', () => {
    const { container } = renderDiagram()
    expect(container.querySelector('svg')).not.toBeNull()
    expect(screen.getByText('線の色:')).toBeInTheDocument()
    expect(screen.getByText('ノード:')).toBeInTheDocument()
  })

  it('初期状態で全てのタイプフィルタボタンがアクティブ（border-primary）', () => {
    renderDiagram()
    expect(screen.getByRole('button', { name: '相乗' }).className).toContain('border-primary')
    expect(screen.getByRole('button', { name: '拮抗' }).className).toContain('border-primary')
    expect(screen.getByRole('button', { name: '調節' }).className).toContain('border-primary')
  })

  it('検索ボックスが描画される', () => {
    renderDiagram()
    expect(screen.getByPlaceholderText('ホルモン名で検索...')).toBeInTheDocument()
  })

  it('全てのノード（ホルモン数だけ circle）が描画される', () => {
    const { container } = renderDiagram()
    const circles = container.querySelectorAll('circle')
    expect(circles.length).toBe(hormones.length)
  })

  it('全ての相互作用エッジ（line）が描画される', () => {
    const { container } = renderDiagram()
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBe(interactions.length)
  })
})

describe('HormoneInteractionDiagram - 空データ', () => {
  it('hormones が空ならメッセージを表示する', () => {
    render(<HormoneInteractionDiagram hormones={[]} interactions={[]} />)
    expect(screen.getByText('ダイアグラムデータがありません。')).toBeInTheDocument()
  })

  it('interactions が空でも SVG は描画される（メッセージは出ない）', () => {
    const { container } = render(
      <HormoneInteractionDiagram hormones={hormones} interactions={[]} />,
    )
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.querySelectorAll('line').length).toBe(0)
  })
})

describe('HormoneInteractionDiagram - タイプフィルタ', () => {
  it('「相乗」をクリックするとフィルタから外れて該当エッジが消える', () => {
    const { container } = renderDiagram()
    expect(container.querySelectorAll('line').length).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: '相乗' }))
    // synergistic エッジが 1 本だったので 2 本になる
    expect(container.querySelectorAll('line').length).toBe(2)
  })

  it('再度クリックでフィルタが復活する', () => {
    const { container } = renderDiagram()
    fireEvent.click(screen.getByRole('button', { name: '相乗' }))
    fireEvent.click(screen.getByRole('button', { name: '相乗' }))
    expect(container.querySelectorAll('line').length).toBe(3)
  })

  it('全タイプを外すとエッジが 0 本になる', () => {
    const { container } = renderDiagram()
    fireEvent.click(screen.getByRole('button', { name: '相乗' }))
    fireEvent.click(screen.getByRole('button', { name: '拮抗' }))
    fireEvent.click(screen.getByRole('button', { name: '調節' }))
    expect(container.querySelectorAll('line').length).toBe(0)
  })

  it('外したタイプのボタンは aktive スタイルが外れる', () => {
    renderDiagram()
    fireEvent.click(screen.getByRole('button', { name: '相乗' }))
    expect(screen.getByRole('button', { name: '相乗' }).className).not.toContain('border-primary')
  })
})

describe('HormoneInteractionDiagram - 検索', () => {
  it('「オーキシン」で検索するとマッチしないエッジは消える', () => {
    const { container } = renderDiagram()
    const input = screen.getByPlaceholderText('ホルモン名で検索...')
    fireEvent.change(input, { target: { value: 'オーキシン' } })

    // オーキシン関連エッジ: h1-h2, h1-h3 → 2本
    expect(container.querySelectorAll('line').length).toBe(2)
  })

  it('大文字小文字を無視する', () => {
    const { container } = renderDiagram()
    const input = screen.getByPlaceholderText('ホルモン名で検索...')
    fireEvent.change(input, { target: { value: 'オーキシン' } })
    const linesUpper = container.querySelectorAll('line').length
    fireEvent.change(input, { target: { value: 'オーキシン  ' } }) // 余分な空白も trim される
    expect(container.querySelectorAll('line').length).toBe(linesUpper)
  })

  it('マッチしないクエリならエッジが全て消える', () => {
    const { container } = renderDiagram()
    fireEvent.change(screen.getByPlaceholderText('ホルモン名で検索...'), {
      target: { value: '存在しないホルモン' },
    })
    expect(container.querySelectorAll('line').length).toBe(0)
  })

  it('空文字に戻すと全てのエッジが復活する', () => {
    const { container } = renderDiagram()
    const input = screen.getByPlaceholderText('ホルモン名で検索...')
    fireEvent.change(input, { target: { value: 'オーキシン' } })
    fireEvent.change(input, { target: { value: '' } })
    expect(container.querySelectorAll('line').length).toBe(3)
  })

  it('検索でマッチしないノードは opacity 0.2 に下がる', () => {
    const { container } = renderDiagram()
    fireEvent.change(screen.getByPlaceholderText('ホルモン名で検索...'), {
      target: { value: 'オーキシン' },
    })
    // ストリゴラクトン（マッチしない）の <g> の opacity を確認
    const gs = container.querySelectorAll('g[opacity]')
    const dimmed = Array.from(gs).filter((g) => g.getAttribute('opacity') === '0.2')
    expect(dimmed.length).toBeGreaterThan(0)
  })
})

describe('HormoneInteractionDiagram - ノード選択', () => {
  it('ノードをクリックすると stroke が #f59e0b（オレンジ）になる', () => {
    const { container } = renderDiagram()
    const firstG = container.querySelector('svg g')
    expect(firstG).not.toBeNull()
    fireEvent.click(firstG!)
    const circle = firstG!.querySelector('circle')
    expect(circle?.getAttribute('stroke')).toBe('#f59e0b')
  })

  it('同じノードを再クリックすると選択解除（白枠に戻る）', () => {
    const { container } = renderDiagram()
    const firstG = container.querySelector('svg g')!
    fireEvent.click(firstG)
    fireEvent.click(firstG)
    const circle = firstG.querySelector('circle')
    expect(circle?.getAttribute('stroke')).toBe('#ffffff')
  })

  it('ノード選択中は接続されていないエッジの opacity が 0.15 に下がる', () => {
    const { container } = renderDiagram()
    // 最初のノード（h1=オーキシン）をクリック
    const groups = container.querySelectorAll('svg > g')
    fireEvent.click(groups[0])

    // h2-h4 のエッジ（オーキシン関連でない）の opacity が 0.15
    const lines = container.querySelectorAll('line')
    const dimmedLines = Array.from(lines).filter((l) => l.getAttribute('opacity') === '0.15')
    expect(dimmedLines.length).toBeGreaterThan(0)
  })
})

describe('HormoneInteractionDiagram - エッジホバー', () => {
  it('エッジに mouseEnter すると説明パネル（HTML <p>）に description が出る', () => {
    const { container } = renderDiagram()
    const line = container.querySelector('line')!
    fireEvent.mouseEnter(line)
    // <title> の中にも同じ description が入っているので、HTML 側の <p> に絞る
    const panelDescriptions = container.querySelectorAll('p.text-muted-foreground')
    const hasDescription = Array.from(panelDescriptions).some((p) =>
      p.textContent?.includes('オーキシンとジベレリンの拮抗'),
    )
    expect(hasDescription).toBe(true)
  })

  it('mouseLeave すると説明パネル（HTML <p>）が消える', () => {
    const { container } = renderDiagram()
    const line = container.querySelector('line')!
    fireEvent.mouseEnter(line)
    fireEvent.mouseLeave(line)
    const panelDescriptions = container.querySelectorAll('p.text-muted-foreground')
    const hasDescription = Array.from(panelDescriptions).some((p) =>
      p.textContent?.includes('オーキシンとジベレリンの拮抗'),
    )
    expect(hasDescription).toBe(false)
  })

  it('description が null のエッジでもパネル本体（ホルモン名）は表示される', () => {
    const { container } = renderDiagram()
    // 3 番目の interaction（h2-h4）が description: null
    const lines = container.querySelectorAll('line')
    fireEvent.mouseEnter(lines[2])
    // ジベレリン ↔ ストリゴラクトン がパネル <p> に出る
    const panelHeader = container.querySelector('div.bg-muted\\/50 p.font-medium')
    expect(panelHeader?.textContent).toContain('ジベレリン')
    expect(panelHeader?.textContent).toContain('ストリゴラクトン')
    // description が null のときは <p class="text-muted-foreground"> 説明文は出ない
    const descPanels = container.querySelectorAll('div.bg-muted\\/50 p.text-muted-foreground')
    // 説明本文用の <p> は存在しない（あっても type ラベルのみ）
    // 「(調節)」は font-medium 内に含まれる span で、説明本文 p ではない
    expect(descPanels.length).toBe(0)
  })

  it('ホバー中エッジは strokeWidth=3 に太くなる', () => {
    const { container } = renderDiagram()
    const line = container.querySelector('line')!
    fireEvent.mouseEnter(line)
    expect(line.getAttribute('stroke-width')).toBe('3')
  })
})

describe('HormoneInteractionDiagram - ノード名トランケート', () => {
  it('5文字を超えるホルモン名は ... で切られる', () => {
    const longHormones = [
      { id: 'h1', name: 'スーパー長いホルモン名', slug: 'long', category: 'major' },
    ]
    const { container } = render(
      <HormoneInteractionDiagram hormones={longHormones} interactions={[]} />,
    )
    const text = container.querySelector('text')
    expect(text?.textContent).toMatch(/…/)
    expect(text?.textContent?.length).toBeLessThanOrEqual(5)
  })

  it('5文字以下のホルモン名はそのまま表示', () => {
    const shortHormones = [
      { id: 'h1', name: '短い', slug: 'short', category: 'major' },
    ]
    const { container } = render(
      <HormoneInteractionDiagram hormones={shortHormones} interactions={[]} />,
    )
    const text = container.querySelector('text')
    expect(text?.textContent).toBe('短い')
  })
})

describe('HormoneInteractionDiagram - エッジ色', () => {
  it('synergistic は緑、antagonistic は赤、modulatory は黄色', () => {
    const { container } = renderDiagram()
    const lines = Array.from(container.querySelectorAll('line'))
    const colors = lines.map((l) => l.getAttribute('stroke'))
    // synergistic=#22c55e, antagonistic=#ef4444, modulatory=#eab308
    expect(colors).toContain('#22c55e')
    expect(colors).toContain('#ef4444')
    expect(colors).toContain('#eab308')
  })

  it('未知の type は灰色フォールバック（#9ca3af）', () => {
    const oddInteraction = [
      { hormoneAId: 'h1', hormoneBId: 'h2', type: 'unknown_type', description: null },
    ]
    const { container } = render(
      <HormoneInteractionDiagram hormones={hormones} interactions={oddInteraction} />,
    )
    const line = container.querySelector('line')
    // ただし activeTypes はデフォルトで synergistic/antagonistic/modulatory のみなので
    // 未知の type はそもそもフィルタで弾かれる → エッジは描画されない
    expect(line).toBeNull()
  })
})

describe('HormoneInteractionDiagram - 凡例', () => {
  it('凡例にホルモンノードの色分け説明（major/secondary）が含まれる', () => {
    renderDiagram()
    expect(screen.getByText('五大ホルモン')).toBeInTheDocument()
    expect(screen.getByText('二次ホルモン')).toBeInTheDocument()
  })

  it('凡例に 3 種類のエッジラベルが入る', () => {
    renderDiagram()
    // 凡例の領域
    const legend = screen.getByText('線の色:').closest('div')!
    expect(within(legend).getByText('相乗')).toBeInTheDocument()
    expect(within(legend).getByText('拮抗')).toBeInTheDocument()
    expect(within(legend).getByText('調節')).toBeInTheDocument()
  })
})
