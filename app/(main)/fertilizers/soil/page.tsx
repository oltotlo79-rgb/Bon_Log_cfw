import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'
import { ROUTE_FERTILIZERS_SOIL } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '用土と施肥の関係 - 施肥ガイド',
  description: '盆栽の用土の種類と保肥力（CEC）が施肥に与える影響を解説します。',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS_SOIL) },
}

/** CEC（保肥力）レベル */
type CecLevel = 'very_low' | 'low' | 'medium' | 'medium_high'

const CEC_LABELS: Record<CecLevel, string> = {
  very_low: '極低',
  low: '低',
  medium: '中',
  medium_high: '中〜高',
}

const CEC_COLORS: Record<CecLevel, string> = {
  very_low: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  low: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  medium_high: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}

interface SoilType {
  name: string
  nameEn: string
  phRange: string
  cec: CecLevel
  characteristics: string
  fertilizerStrategy: string
}

const SOIL_TYPES: SoilType[] = [
  {
    name: '赤玉土',
    nameEn: 'Akadama',
    phRange: '6.0〜6.5',
    cec: 'medium_high',
    characteristics:
      '関東ローム層から採取される粒状の火山灰土。適度な保水性と排水性を兼ね備え、盆栽用土の基本となる。粒が崩れやすいため定期的な植え替えが必要。',
    fertilizerStrategy:
      '保肥力が比較的高く、置き肥の成分をよく保持する。標準的な施肥量で問題ない。古くなると粒が崩れて排水性が低下し、肥料成分の偏りが起きやすくなるため、植え替えサイクルを守ることが重要。',
  },
  {
    name: '鹿沼土',
    nameEn: 'Kanuma',
    phRange: '4.5〜5.0',
    cec: 'medium',
    characteristics:
      '栃木県鹿沼市近郊で産出される軽石質の火山灰土。酸性が強く、保水性に優れる。皐月（サツキ）やツツジなど酸性土壌を好む樹種に最適。',
    fertilizerStrategy:
      '酸性が強いため、アルカリ性に傾く石灰系肥料は避ける。有機肥料との相性が良い。鉄やマンガンの可給性が高いが、リン酸が固定されやすいため、骨粉など有機態リン酸の併用が効果的。',
  },
  {
    name: '桐生砂',
    nameEn: 'Kiryu-zuna',
    phRange: '6.0〜7.0',
    cec: 'low',
    characteristics:
      '群馬県桐生市周辺で産出される硬質の砂礫。排水性に極めて優れ、粒が崩れにくい。松柏類の用土として定評がある。',
    fertilizerStrategy:
      '保肥力が低いため、施した肥料成分が灌水で流れやすい。置き肥を多めに配置するか、液肥の頻度を上げて補う。一方で肥料焼けのリスクは低く、初心者にも扱いやすい。',
  },
  {
    name: '富士砂',
    nameEn: 'Fuji-zuna',
    phRange: '6.5〜7.0',
    cec: 'very_low',
    characteristics:
      '富士山麓の火山性砕屑物（スコリア）。黒色で重く、排水性が極めて高い。鉄分を多く含み、根の発達を促す効果がある。',
    fertilizerStrategy:
      '保肥力がほとんどないため、肥料成分の流亡が激しい。有機固形肥料を多めに設置し、補助的に液肥を併用するのが効果的。単用よりも赤玉土との混合で保肥力を補う使い方が一般的。',
  },
  {
    name: '日向土',
    nameEn: 'Hyuga-tsuchi',
    phRange: '5.5〜6.5',
    cec: 'medium',
    characteristics:
      '宮崎県で産出される多孔質の軽石。優れた通気性と適度な保水性を持ち、根腐れ防止に効果的。粒が硬く崩れにくい。',
    fertilizerStrategy:
      '多孔質構造が肥料成分をある程度保持するため、標準的な施肥量で管理できる。通気性が良く根が健全に発達しやすいので、肥料の吸収効率も良好。排水が良いため梅雨時の肥料腐敗も起きにくい。',
  },
  {
    name: '軽石',
    nameEn: 'Karui-ishi (Pumice)',
    phRange: '6.5〜7.0',
    cec: 'very_low',
    characteristics:
      '火山性の多孔質軽石。極めて軽量で排水性に優れる。大型盆栽の鉢底石や、排水改善のための混合材として使用。',
    fertilizerStrategy:
      '保肥力がほとんどないため、軽石の割合が多い用土配合では肥料成分が流亡しやすい。他の保肥力のある用土（赤玉土等）と混合し、施肥頻度を増やして対応する。',
  },
]

interface SoilRecipe {
  treeType: string
  recipe: string
  reasoning: string
}

const SOIL_RECIPES: SoilRecipe[] = [
  {
    treeType: '松柏類（黒松・赤松・真柏等）',
    recipe: '赤玉土 6：桐生砂 3：富士砂 1',
    reasoning:
      '排水性を重視しつつ赤玉土で保肥力を確保。松柏類は過湿を嫌うため砂系を多めに配合。施肥は標準〜やや多めで管理できる。',
  },
  {
    treeType: '雑木類（楓・欅・銀杏等）',
    recipe: '赤玉土 7：桐生砂 2：腐葉土 1',
    reasoning:
      '保水性・保肥力を高めに設定。雑木類は水分と肥料を多く必要とするため赤玉土の比率を上げる。腐葉土で微量要素も補給。',
  },
  {
    treeType: '皐月・ツツジ類',
    recipe: '鹿沼土 8：日向土 2',
    reasoning:
      '酸性土壌を好む樹種に最適な配合。鹿沼土の酸性とリン酸固定を考慮し、有機態リン酸の施肥が重要。',
  },
  {
    treeType: '花物・実物（梅・桜・柿等）',
    recipe: '赤玉土 6：日向土 2：腐葉土 2',
    reasoning:
      '開花・結実にはリン酸の安定供給が必要。赤玉土と日向土で保肥力と通気性のバランスを取り、腐葉土で微生物活性を高める。',
  },
]

export default function SoilFertilizerPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">用土と施肥の関係</h1>
          <p className="text-sm text-muted-foreground mt-1">
            用土の種類によって保肥力（CEC）が異なり、施肥の量や頻度を調整する必要があります
          </p>
        </div>
        <Link
          href="/fertilizers"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 施肥ガイドトップ
        </Link>
      </div>

      <section className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="font-semibold text-lg">CEC（陽イオン交換容量）とは</h2>
        <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
          <p>
            CEC（Cation Exchange Capacity）とは、土壌がどれだけ肥料成分（陽イオン）を保持できるかを示す指標です。
            CEC が高い用土は肥料成分をしっかり蓄え、灌水で流れにくい特徴があります。
          </p>
          <p>
            盆栽では鉢が小さく用土量が限られるため、用土の CEC は施肥戦略を左右する重要な要素です。
            CEC が低い用土では施肥頻度を上げるか、CEC が高い用土を混合して保肥力を補います。
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">主な盆栽用土の特性</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SOIL_TYPES.map((soil) => (
            <article key={soil.name} className="rounded-lg border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{soil.name}</h3>
                  <span className="text-xs text-muted-foreground">{soil.nameEn}</span>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CEC_COLORS[soil.cec]}`}>
                  CEC: {CEC_LABELS[soil.cec]}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">pH</span>
                <span className="font-mono font-medium">{soil.phRange}</span>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                <p>{soil.characteristics}</p>
                <div className="border-t pt-2">
                  <span className="text-xs font-medium text-foreground">施肥のポイント</span>
                  <p className="mt-1">{soil.fertilizerStrategy}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">樹種別の推奨用土配合</h2>
        <p className="text-sm text-muted-foreground -mt-2">
          用土配合は施肥計画と一体で考えます。保肥力のバランスを意識した代表的な配合例です。
        </p>
        <div className="space-y-3">
          {SOIL_RECIPES.map((recipe) => (
            <div key={recipe.treeType} className="rounded-lg border p-4 space-y-2">
              <h3 className="font-semibold text-sm">{recipe.treeType}</h3>
              <p className="text-sm font-mono bg-muted/50 rounded px-3 py-1.5 inline-block">
                {recipe.recipe}
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{recipe.reasoning}</p>
            </div>
          ))}
        </div>
      </section>

      <FertilizerDisclaimer />
    </div>
  )
}
