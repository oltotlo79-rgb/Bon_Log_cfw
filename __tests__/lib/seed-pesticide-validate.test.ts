// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
  extractTextBetween,
  stripTags,
  toHalfWidth,
  FORMULATION_MAP,
} from '@/prisma/seed/pesticide/seed-pesticide-validate'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  extractTextBetween
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('extractTextBetween', () => {
  it('マーカー間のテキストを抽出する', () => {
    const html = '<div>成分情報</div><p>content</p><div>適用表情報</div>'
    expect(extractTextBetween(html, '成分情報', '適用表情報')).toBe(
      '</div><p>content</p><div>'
    )
  })

  it('開始マーカーがない場合は空文字を返す', () => {
    expect(extractTextBetween('<div>other</div>', '成分情報', '適用表')).toBe('')
  })

  it('終了マーカーがない場合は開始マーカー以降を全て返す', () => {
    const html = '<div>成分情報</div><p>rest</p>'
    expect(extractTextBetween(html, '成分情報', '存在しない')).toBe('</div><p>rest</p>')
  })

  it('マーカーが隣接している場合は空文字を返す', () => {
    expect(extractTextBetween('成分情報適用表情報', '成分情報', '適用表情報')).toBe('')
  })

  it('空文字列に対しては空文字を返す', () => {
    expect(extractTextBetween('', 'start', 'end')).toBe('')
  })

  it('同じマーカーが複数あっても最初のペアを使う', () => {
    const html = 'A開始B開始C終了D終了E'
    expect(extractTextBetween(html, '開始', '終了')).toBe('B開始C')
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  stripTags
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('stripTags', () => {
  it('HTMLタグを除去する', () => {
    expect(stripTags('<p>テスト</p>')).toBe('テスト')
  })

  it('ネストされたタグを除去する', () => {
    expect(stripTags('<div><span>内容</span></div>')).toBe('内容')
  })

  it('属性付きタグを除去する', () => {
    expect(stripTags('<a href="/test" class="link">リンク</a>')).toBe('リンク')
  })

  it('タグがない場合はそのまま返す', () => {
    expect(stripTags('プレーンテキスト')).toBe('プレーンテキスト')
  })

  it('前後の空白をトリムする', () => {
    expect(stripTags('  <p> テスト </p>  ')).toBe('テスト')
  })

  it('自己閉じタグを除去する', () => {
    expect(stripTags('テスト<br/>テスト2')).toBe('テストテスト2')
  })

  it('空タグのみの場合は空文字を返す', () => {
    expect(stripTags('<div></div>')).toBe('')
  })

  it('空文字を返す', () => {
    expect(stripTags('')).toBe('')
  })

  it('複数行のHTMLを処理する', () => {
    expect(stripTags('<p>行1</p>\n<p>行2</p>')).toBe('行1\n行2')
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  toHalfWidth
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('toHalfWidth', () => {
  it('全角大文字を半角に変換する', () => {
    expect(toHalfWidth('ＡＢＣ')).toBe('ABC')
  })

  it('全角小文字を半角に変換する', () => {
    expect(toHalfWidth('ａｂｃ')).toBe('abc')
  })

  it('全角数字を半角に変換する', () => {
    expect(toHalfWidth('０１２３４５６７８９')).toBe('0123456789')
  })

  it('全角スペースを半角スペースに変換する', () => {
    expect(toHalfWidth('テスト　テスト')).toBe('テスト テスト')
  })

  it('既に半角の場合はそのまま返す', () => {
    expect(toHalfWidth('ABC123')).toBe('ABC123')
  })

  it('日本語カタカナ・ひらがなは変換しない', () => {
    expect(toHalfWidth('ベニカＸファイン')).toBe('ベニカXファイン')
  })

  it('全角記号（．％等）は変換対象外', () => {
    expect(toHalfWidth('１．５％')).toBe('1．5％')
  })

  it('空文字を返す', () => {
    expect(toHalfWidth('')).toBe('')
  })

  it('全角・半角が混在する文字列を正しく変換する', () => {
    expect(toHalfWidth('ベニカＸファインスプレー　０．００８０％')).toBe(
      'ベニカXファインスプレー 0．0080％'
    )
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FORMULATION_MAP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('FORMULATION_MAP', () => {
  it('WPは水和剤・顆粒水和剤の2項目を持つ', () => {
    expect(FORMULATION_MAP['WP']).toEqual(['水和剤', '顆粒水和剤'])
  })

  it('ECは乳剤の1項目を持つ', () => {
    expect(FORMULATION_MAP['EC']).toEqual(['乳剤'])
  })

  it('FLはフロアブル・水和剤・液剤の3項目を持つ', () => {
    expect(FORMULATION_MAP['FL']).toEqual(['フロアブル', '水和剤', '液剤'])
  })

  it('GRは粒剤の1項目を持つ', () => {
    expect(FORMULATION_MAP['GR']).toEqual(['粒剤'])
  })

  it('DPは粉剤の1項目を持つ', () => {
    expect(FORMULATION_MAP['DP']).toEqual(['粉剤'])
  })

  it('SPは水溶剤・顆粒水溶剤の2項目を持つ', () => {
    expect(FORMULATION_MAP['SP']).toEqual(['水溶剤', '顆粒水溶剤'])
  })

  it('ALは液剤・エアゾルの2項目を持つ', () => {
    expect(FORMULATION_MAP['AL']).toEqual(['液剤', 'エアゾル'])
  })

  it('SEはマイクロカプセル剤を持つ', () => {
    expect(FORMULATION_MAP['SE']).toEqual(['マイクロカプセル剤'])
  })

  it('PAはペーストを持つ', () => {
    expect(FORMULATION_MAP['PA']).toEqual(['ペースト'])
  })

  it('存在しないコードはundefinedを返す', () => {
    expect(FORMULATION_MAP['INVALID']).toBeUndefined()
  })

  it('剤型名の部分一致で判定できる', () => {
    const acceptable = FORMULATION_MAP['WP'] || []
    expect(acceptable.some((a) => '顆粒水和剤'.includes(a))).toBe(true)
  })

  it('不一致のケースを検出できる', () => {
    const acceptable = FORMULATION_MAP['EC'] || []
    expect(acceptable.some((a) => '粒剤'.includes(a))).toBe(false)
  })
})

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  含有量比較ロジック
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('含有量比較ロジック', () => {
  // この関数はseed-pesticide-validate.ts内部のprivate関数のため、
  // ロジックを検証する目的でインラインで定義する
  function contentLabelDiffers(dbLabel: string, maffConcentration: string, tolerance = 0.1): boolean {
    const dbPct = parseFloat(dbLabel.replace('%', '').trim())
    const maffPct = parseFloat(maffConcentration.replace('%', '').replace(/\s/g, '').trim())
    if (isNaN(dbPct) || isNaN(maffPct)) return false
    return Math.abs(dbPct - maffPct) > tolerance
  }

  it('同一の値は差異なし', () => {
    expect(contentLabelDiffers('20.0%', '20.0%')).toBe(false)
  })

  it('許容範囲内の差は差異なし', () => {
    expect(contentLabelDiffers('20.0%', '20.05%')).toBe(false)
  })

  it('許容範囲を超える差は差異あり', () => {
    expect(contentLabelDiffers('20.0%', '44.2%')).toBe(true)
  })

  it('ちょうど0.1%差は差異なし（境界値）', () => {
    expect(contentLabelDiffers('15.0%', '15.1%')).toBe(false)
  })

  it('0.11%差は差異あり（境界値超過）', () => {
    expect(contentLabelDiffers('15.0%', '15.11%')).toBe(true)
  })

  it('パースできないDB値はfalseを返す', () => {
    expect(contentLabelDiffers('N/A', '20.0%')).toBe(false)
  })

  it('パースできないMAFF値はfalseを返す', () => {
    expect(contentLabelDiffers('20.0%', 'テスト')).toBe(false)
  })

  it('両方パースできない場合はfalseを返す', () => {
    expect(contentLabelDiffers('', '')).toBe(false)
  })

  it('0.0%同士は差異なし', () => {
    expect(contentLabelDiffers('0.0%', '0.0%')).toBe(false)
  })

  it('非常に小さい含有量の比較が正確', () => {
    // ベニカXファインスプレー等の微量成分
    expect(contentLabelDiffers('0.0080%', '0.0080%')).toBe(false)
    expect(contentLabelDiffers('0.0080%', '0.010%')).toBe(false) // 差 0.002 < 0.1
  })
})
