// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
  extractPesticidesFromMain,
  extractIngredientsFromMain,
  extractLinksFromMain,
  extractEffectsFromMain,
  extractDiseasePests,
  extractFormulationTypes,
  extractIncompatibilities,
  extractSpreaderTypes,
  extractSpreaderLinks,
} from '@/prisma/validation/parsers/data-parser'

// ── テスト用のシードコード断片 ──

const SAMPLE_PESTICIDE = `
    {
      name: "トリフミン乳剤",
      registrationNumber: "17375",
      pesticideType: "fungicide",
      formulationTypeId: ftMap["EC"],
      slug: "trifumin-ec",
      description: "テスト説明文",
    },
`

const SAMPLE_INGREDIENT = `
    {
      name: "トリフルミゾール",
      nameEn: "Triflumizole",
      fracCode: "3",
      ingredientGroup: "DMI（脱メチル化阻害剤）",
      slug: "triflumizole",
      description: "テスト",
      resistanceRisk: "medium",
    },
`

const SAMPLE_INGREDIENT_IRAC = `
    {
      name: "アセタミプリド",
      nameEn: "Acetamiprid",
      iracCode: "4A",
      ingredientGroup: "ネオニコチノイド系",
      slug: "acetamiprid",
      description: "テスト",
      resistanceRisk: "medium",
    },
`

const SAMPLE_LINK = `
    { pesticideId: pMap["trifumin-ec"], activeIngredientId: ingMap["triflumizole"], contentLabel: "15.0%" },
`

const SAMPLE_EFFECT_FUNGICIDE = `
    { pesticideId: pMap["trifumin-ec"], diseasePestId: dpMap["udonko-byo"], preventionLevel: "good", treatmentLevel: "good", efficacyLevel: "good", persistenceLevel: "good" },
`

const SAMPLE_EFFECT_INSECTICIDE = `
    { pesticideId: pMap["mospilan-sl"], diseasePestId: dpMap["aburamushi"], efficacyLevel: "good", persistenceLevel: "good" },
`

const SAMPLE_DISEASE = `
    {
      name: "うどんこ病",
      nameKana: "ウドンコビョウ",
      category: "disease",
      description:
        "テスト説明文。うどんこ病の説明です。",
      slug: "udonko-byo",
    },
`

const SAMPLE_PEST = `
    {
      name: "アブラムシ",
      nameKana: "アブラムシ",
      category: "pest",
      description:
        "テスト害虫説明文。アブラムシの説明です。",
      slug: "aburamushi",
      bodySizeMinMm: 1,
      bodySizeMaxMm: 4,
    },
`

const SAMPLE_FORMULATION = `
    { code: "EC", name: "乳剤", description: "テスト説明" },
    { code: "WP", name: "水和剤", description: "テスト説明2" },
`

const SAMPLE_INCOMPATIBILITY = `
  console.log("混用不可農薬データを生成中...");
  const incompatibilities = new Set<string>();

  const alkaline = [
    "lime-sulfur",
  ];

  const machineOils = ["machine-oil-ec"];

  const copperFungicides = [
    "z-bordeaux",
    "sankei-copper-wp",
  ];

  const addIncompatibility = (p1Slug: string, p2Slug: string) => {
    if (pMap[p1Slug] && pMap[p2Slug]) {
      incompatibilities.add(\`\${pMap[p1Slug]}|\${pMap[p2Slug]}\`);
    }
  };

  alkaline.forEach((alk) => {
    machineOils.forEach((oil) => addIncompatibility(alk, oil));
  });

  copperFungicides.forEach((cop) => addIncompatibility("lime-sulfur", cop));
`

const SAMPLE_SPREADER_TYPES = `
  const spreaderTypes = [
    { code: "ether", name: "エーテル型", slug: "ether", sortOrder: 1 },
    { code: "ester", name: "エステル型", slug: "ester", sortOrder: 2 },
  ];
`

const SAMPLE_SPREADER_LINKS = `
    { pesticideId: pMap["mairino"], spreaderTypeId: xxx, slug: "ether" },
    { pesticideId: pMap["approach-bi"], spreaderTypeId: xxx, slug: "ester" },
`

// ── テスト ──

describe('data-parser', () => {
  describe('extractPesticidesFromMain', () => {
    it('農薬製品データを抽出する', () => {
      const result = extractPesticidesFromMain(SAMPLE_PESTICIDE)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        name: 'トリフミン乳剤',
        slug: 'trifumin-ec',
        registrationNumber: '17375',
        pesticideType: 'fungicide',
        formulationType: 'EC',
        description: 'テスト説明文',
        source: 'data',
      })
    })

    it('registrationNumber: null の場合は空文字になる', () => {
      const src = `
    {
      name: "マシン油乳剤",
      registrationNumber: null,
      pesticideType: "insecticide",
      formulationTypeId: ftMap["EC"],
      slug: "machine-oil-ec",
      description: "テスト",
    },
`
      const result = extractPesticidesFromMain(src)
      expect(result).toHaveLength(1)
      expect(result[0].registrationNumber).toBe('')
    })

    it('複数の農薬を同時に抽出する', () => {
      const src = SAMPLE_PESTICIDE + `
    {
      name: "ベンレート水和剤",
      registrationNumber: "20889",
      pesticideType: "fungicide",
      formulationTypeId: ftMap["WP"],
      slug: "benlate-wp",
      description: "テスト2",
    },
`
      const result = extractPesticidesFromMain(src)
      expect(result).toHaveLength(2)
      expect(result.map(r => r.slug)).toEqual(['trifumin-ec', 'benlate-wp'])
    })

    it('空文字列では0件を返す', () => {
      expect(extractPesticidesFromMain('')).toHaveLength(0)
    })

    it('無関係なテキストからは抽出しない', () => {
      expect(extractPesticidesFromMain('console.log("test")')).toHaveLength(0)
    })
  })

  describe('extractIngredientsFromMain', () => {
    it('FRACコード付き有効成分を抽出する', () => {
      const result = extractIngredientsFromMain(SAMPLE_INGREDIENT)
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('triflumizole')
      expect(result[0].nameEn).toBe('Triflumizole')
      expect(result[0].fracCode).toBe('3')
      expect(result[0].iracCode).toBe('')
      expect(result[0].resistanceRisk).toBe('medium')
    })

    it('IRACコード付き有効成分を抽出する', () => {
      const result = extractIngredientsFromMain(SAMPLE_INGREDIENT_IRAC)
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('acetamiprid')
      expect(result[0].iracCode).toBe('4A')
      expect(result[0].fracCode).toBe('')
    })
  })

  describe('extractLinksFromMain', () => {
    it('農薬⇔有効成分リンクを抽出する', () => {
      const result = extractLinksFromMain(SAMPLE_LINK)
      expect(result).toHaveLength(1)
      expect(result[0].pesticideSlug).toBe('trifumin-ec')
      expect(result[0].ingredientSlug).toBe('triflumizole')
      expect(result[0].contentLabel).toBe('15.0%')
    })
  })

  describe('extractEffectsFromMain', () => {
    it('殺菌剤の効果データ（全4レベル）を抽出する', () => {
      const result = extractEffectsFromMain(SAMPLE_EFFECT_FUNGICIDE)
      expect(result).toHaveLength(1)
      expect(result[0].pesticideSlug).toBe('trifumin-ec')
      expect(result[0].diseasePestSlug).toBe('udonko-byo')
      expect(result[0].preventionLevel).toBe('good')
      expect(result[0].treatmentLevel).toBe('good')
      expect(result[0].efficacyLevel).toBe('good')
      expect(result[0].persistenceLevel).toBe('good')
    })

    it('殺虫剤の効果データ（efficacy/persistenceのみ）を抽出する', () => {
      const result = extractEffectsFromMain(SAMPLE_EFFECT_INSECTICIDE)
      expect(result).toHaveLength(1)
      expect(result[0].preventionLevel).toBe('')
      expect(result[0].treatmentLevel).toBe('')
      expect(result[0].efficacyLevel).toBe('good')
      expect(result[0].persistenceLevel).toBe('good')
    })

    it('コメントアウトされた行は除外する', () => {
      const src = `
    // { pesticideId: pMap["test"], diseasePestId: dpMap["test-byo"], preventionLevel: "good" },
`
      expect(extractEffectsFromMain(src)).toHaveLength(0)
    })
  })

  describe('extractDiseasePests', () => {
    it('病害データを抽出する（体長なし）', () => {
      const result = extractDiseasePests(SAMPLE_DISEASE, 'data')
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('udonko-byo')
      expect(result[0].name).toBe('うどんこ病')
      expect(result[0].nameKana).toBe('ウドンコビョウ')
      expect(result[0].category).toBe('disease')
      expect(result[0].bodySizeMinMm).toBe('')
      expect(result[0].bodySizeMaxMm).toBe('')
      expect(result[0].source).toBe('data')
    })

    it('害虫データを抽出する（体長あり）', () => {
      const result = extractDiseasePests(SAMPLE_PEST, 'data')
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('aburamushi')
      expect(result[0].category).toBe('pest')
      expect(result[0].bodySizeMinMm).toBe('1')
      expect(result[0].bodySizeMaxMm).toBe('4')
    })

    it('beneficial_insectカテゴリを正しく処理する', () => {
      const src = `
    {
      name: "テントウムシ",
      nameKana: "テントウムシ",
      category: "beneficial_insect",
      description:
        "天敵昆虫の説明。",
      slug: "tentoumushi",
      bodySizeMinMm: 5,
      bodySizeMaxMm: 8,
    },
`
      const result = extractDiseasePests(src, 'data')
      expect(result).toHaveLength(1)
      expect(result[0].category).toBe('beneficial_insect')
      expect(result[0].bodySizeMinMm).toBe('5')
    })

    it('slug重複は最初のものだけ残す', () => {
      const src = SAMPLE_DISEASE + SAMPLE_DISEASE
      const result = extractDiseasePests(src, 'data')
      expect(result).toHaveLength(1)
    })

    it('sourceラベルが正しく設定される', () => {
      const result = extractDiseasePests(SAMPLE_DISEASE, 'additions')
      expect(result[0].source).toBe('additions')
    })

    it('descriptionHeadが150文字以内に切り詰められる', () => {
      const result = extractDiseasePests(SAMPLE_DISEASE, 'data')
      expect(result[0].descriptionHead.length).toBeLessThanOrEqual(150)
    })
  })

  describe('extractFormulationTypes', () => {
    it('剤型データを抽出する', () => {
      const result = extractFormulationTypes(SAMPLE_FORMULATION)
      expect(result).toHaveLength(2)
      expect(result[0].code).toBe('EC')
      expect(result[1].code).toBe('WP')
    })
  })

  describe('extractIncompatibilities', () => {
    it('外側forEach+内側forEachパターンを双方向に抽出する', () => {
      const result = extractIncompatibilities(SAMPLE_INCOMPATIBILITY)
      expect(result.find(r => r.slug1 === 'lime-sulfur' && r.slug2 === 'machine-oil-ec')).toBeDefined()
      expect(result.find(r => r.slug1 === 'machine-oil-ec' && r.slug2 === 'lime-sulfur')).toBeDefined()
    })

    it('文字列リテラル引数パターンを抽出する', () => {
      const result = extractIncompatibilities(SAMPLE_INCOMPATIBILITY)
      expect(result.find(r => r.slug1 === 'lime-sulfur' && r.slug2 === 'z-bordeaux')).toBeDefined()
      expect(result.find(r => r.slug1 === 'lime-sulfur' && r.slug2 === 'sankei-copper-wp')).toBeDefined()
      // 逆方向も
      expect(result.find(r => r.slug1 === 'z-bordeaux' && r.slug2 === 'lime-sulfur')).toBeDefined()
    })

    it('期待されるペア数が正確（1アルカリ×1油 + 1固定×2銅 = 3ペア×2方向 = 6行）', () => {
      const result = extractIncompatibilities(SAMPLE_INCOMPATIBILITY)
      expect(result).toHaveLength(6)
    })

    it('空文字列では0件を返す', () => {
      expect(extractIncompatibilities('')).toHaveLength(0)
    })

    it('混用不可セクションのないソースでは0件を返す', () => {
      expect(extractIncompatibilities('const x = 1;')).toHaveLength(0)
    })

    it('同一slugペアの重複を除去する', () => {
      const result = extractIncompatibilities(SAMPLE_INCOMPATIBILITY)
      const slugPairs = result.map(r => `${r.slug1}|${r.slug2}`)
      expect(slugPairs.length).toBe(new Set(slugPairs).size)
    })

    it('同一slug同士のペアは生成しない', () => {
      const result = extractIncompatibilities(SAMPLE_INCOMPATIBILITY)
      for (const r of result) {
        expect(r.slug1).not.toBe(r.slug2)
      }
    })
  })

  describe('extractSpreaderTypes', () => {
    it('展着剤タイプを抽出する', () => {
      const result = extractSpreaderTypes(SAMPLE_SPREADER_TYPES)
      expect(result).toHaveLength(2)
      expect(result[0].code).toBe('ether')
      expect(result[1].slug).toBe('ester')
    })
  })

  describe('extractSpreaderLinks', () => {
    it('展着剤リンクを抽出する', () => {
      const result = extractSpreaderLinks(SAMPLE_SPREADER_LINKS)
      expect(result).toHaveLength(2)
      expect(result[0].pesticideSlug).toBe('mairino')
      expect(result[0].spreaderTypeSlug).toBe('ether')
    })
  })
})
