'use client'

import { useState } from 'react'
import Link from 'next/link'

type NutrientKey = 'N' | 'P' | 'K' | 'Ca' | 'Mg' | 'Fe'

interface NutrientData {
  symbol: NutrientKey
  name: string
  slug: string
  ionForm: string
  mobile: boolean
  absorption: string
  usage: string
  mobility: string
  color: string
  soilX: number
}

const NUTRIENTS: NutrientData[] = [
  {
    symbol: 'N',
    name: '窒素',
    slug: 'nitrogen',
    ionForm: 'NO\u2083\u207B / NH\u2084\u207A',
    mobile: true,
    absorption: '能動輸送により根毛から吸収。硝酸態(NO\u2083\u207B)は水と共に受動的に、アンモニア態(NH\u2084\u207A)はトランスポーターで能動的に取り込まれます。',
    usage: 'アミノ酸・タンパク質・クロロフィル(葉緑素)の構成元素。葉の成長と光合成に不可欠です。',
    mobility: '移動性が高く、不足すると古い葉から新しい葉へ再転流されるため、下位葉から黄化が始まります。',
    color: '#22c55e',
    soilX: 45,
  },
  {
    symbol: 'P',
    name: 'リン酸',
    slug: 'phosphorus',
    ionForm: 'H\u2082PO\u2084\u207B',
    mobile: true,
    absorption: 'リン酸イオン(H\u2082PO\u2084\u207B)として根毛から能動輸送で吸収。土壌中での移動性が低いため、菌根菌との共生が吸収を助けます。',
    usage: 'ATP(エネルギー通貨)・DNA・RNAの構成要素。細胞分裂、花芽形成、根の発達に重要です。',
    mobility: '移動性があり、不足すると古い組織から新しい組織へ移動します。欠乏時は葉が紫色に変色します。',
    color: '#22c55e',
    soilX: 115,
  },
  {
    symbol: 'K',
    name: 'カリウム',
    slug: 'potassium',
    ionForm: 'K\u207A',
    mobile: true,
    absorption: 'カリウムイオン(K\u207A)として根から能動輸送で吸収。吸収量が多く、植物体内で最も濃度の高いカチオンです。',
    usage: '気孔の開閉制御・浸透圧調整・酵素活性化。耐病性・耐寒性を高め、果実の品質向上に寄与します。',
    mobility: '移動性が高く、不足すると古い葉の縁から壊死(ネクロシス)が進行します。',
    color: '#22c55e',
    soilX: 185,
  },
  {
    symbol: 'Ca',
    name: 'カルシウム',
    slug: 'calcium',
    ionForm: 'Ca\u00B2\u207A',
    mobile: false,
    absorption: 'カルシウムイオン(Ca\u00B2\u207A)として根の先端部から受動的に吸収。蒸散流に乗って道管(木部)のみを移動します。',
    usage: '細胞壁のペクチン酸カルシウムとして構造を強化。細胞膜の安定性維持やシグナル伝達にも関与します。',
    mobility: '非移動性 \u2014 道管のみを移動し、師管(篩部)では移動しません。そのため蒸散の少ない新芽や果実で欠乏しやすくなります。',
    color: '#f59e0b',
    soilX: 255,
  },
  {
    symbol: 'Mg',
    name: 'マグネシウム',
    slug: 'magnesium',
    ionForm: 'Mg\u00B2\u207A',
    mobile: true,
    absorption: 'マグネシウムイオン(Mg\u00B2\u207A)として根から吸収。カリウムやカルシウムが過剰だと拮抗作用で吸収が阻害されます。',
    usage: 'クロロフィル分子の中心原子。光合成の中核を担い、リン酸代謝の酵素活性化にも必要です。',
    mobility: '移動性があり、不足すると古い葉の葉脈間から黄化(クロロシス)が始まります。',
    color: '#22c55e',
    soilX: 325,
  },
  {
    symbol: 'Fe',
    name: '鉄',
    slug: 'iron',
    ionForm: 'Fe\u00B2\u207A / Fe\u00B3\u207A',
    mobile: false,
    absorption: 'Fe\u00B3\u207A を根の表面でFe\u00B2\u207A に還元してから吸収(Strategy I)。アルカリ土壌では吸収が阻害されやすくなります。',
    usage: 'クロロフィル合成酵素の補因子。電子伝達系(光合成・呼吸)のシトクロムやフェレドキシンの構成元素です。',
    mobility: '非移動性 \u2014 一度葉に固定されると再移動しにくいため、不足すると新葉から黄化が始まります。',
    color: '#f59e0b',
    soilX: 360,
  },
]

export function NutrientAbsorptionDiagram() {
  const [selected, setSelected] = useState<NutrientKey | null>(null)

  const selectedNutrient = selected
    ? NUTRIENTS.find((n) => n.symbol === selected)
    : null

  function handleSelect(symbol: NutrientKey) {
    setSelected((prev) => (prev === symbol ? null : symbol))
  }

  return (
    <div className="space-y-4">
      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
          移動性（師管で再転流）
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-500" />
          非移動性（道管のみ）
        </div>
      </div>

      {/* 栄養素選択ボタン */}
      <div className="flex flex-wrap gap-2">
        {NUTRIENTS.map((n) => (
          <button
            key={n.symbol}
            type="button"
            onClick={() => handleSelect(n.symbol)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
              selected === n.symbol
                ? n.mobile
                  ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 dark:border-green-600'
                  : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-600'
                : 'border-border hover:bg-accent'
            }`}
          >
            {n.symbol}
            <span className="ml-1 text-xs font-normal opacity-70">
              {n.name}
            </span>
          </button>
        ))}
      </div>

      {/* SVG図解 */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <svg
          viewBox="0 0 400 600"
          className="w-full max-w-md mx-auto"
          role="img"
          aria-label="栄養素の吸収経路図"
        >
          {/* 背景グラデーション */}
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#f0fdf4" />
            </linearGradient>
            <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a3754f" />
              <stop offset="100%" stopColor="#7c5a3c" />
            </linearGradient>
            <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8B6914" />
              <stop offset="50%" stopColor="#A0762C" />
              <stop offset="100%" stopColor="#8B6914" />
            </linearGradient>
          </defs>

          {/* 空 */}
          <rect x="0" y="0" width="400" height="420" fill="url(#skyGrad)" />

          {/* 土壌層 */}
          <rect x="0" y="420" width="400" height="180" fill="url(#soilGrad)" />
          <text
            x="200"
            y="448"
            textAnchor="middle"
            fill="#f5f0e8"
            fontSize="11"
            fontWeight="bold"
          >
            土壌溶液（イオン態栄養素）
          </text>

          {/* 葉のエリア */}
          <ellipse cx="200" cy="100" rx="130" ry="80" fill="#4ade80" opacity="0.3" />
          <ellipse cx="200" cy="100" rx="100" ry="60" fill="#22c55e" opacity="0.35" />
          <text
            x="200"
            y="65"
            textAnchor="middle"
            fill="#166534"
            fontSize="11"
            fontWeight="bold"
          >
            葉（光合成・蒸散）
          </text>
          {/* 蒸散矢印 */}
          <path d="M160 30 L160 15" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrowBlue)" opacity="0.6" />
          <path d="M200 25 L200 10" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrowBlue)" opacity="0.6" />
          <path d="M240 30 L240 15" stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrowBlue)" opacity="0.6" />
          <text x="200" y="10" textAnchor="middle" fill="#0284c7" fontSize="8">蒸散</text>

          {/* 幹 */}
          <rect x="185" y="160" width="30" height="200" rx="4" fill="url(#trunkGrad)" />
          <text
            x="172"
            y="265"
            textAnchor="middle"
            fill="#713f12"
            fontSize="9"
            transform="rotate(-90, 172, 265)"
          >
            道管（木部）↑
          </text>

          {/* 道管の上向き矢印 */}
          <defs>
            <marker id="arrowUp" markerWidth="6" markerHeight="6" refX="3" refY="6" orient="auto">
              <path d="M0,6 L3,0 L6,6" fill="#0284c7" />
            </marker>
            <marker id="arrowBlue" markerWidth="5" markerHeight="5" refX="2.5" refY="5" orient="auto">
              <path d="M0,5 L2.5,0 L5,5" fill="#38bdf8" />
            </marker>
          </defs>
          <line x1="195" y1="350" x2="195" y2="180" stroke="#0284c7" strokeWidth="2" strokeDasharray="4,3" markerEnd="url(#arrowUp)" />
          <line x1="205" y1="350" x2="205" y2="180" stroke="#0284c7" strokeWidth="2" strokeDasharray="4,3" markerEnd="url(#arrowUp)" />

          {/* 根のエリア */}
          <text
            x="200"
            y="385"
            textAnchor="middle"
            fill="#166534"
            fontSize="10"
            fontWeight="bold"
          >
            根毛（吸収帯）
          </text>
          {/* 根の描画 */}
          <path d="M200 360 Q180 400 140 440" stroke="#78716c" strokeWidth="3" fill="none" />
          <path d="M200 360 Q200 410 200 450" stroke="#78716c" strokeWidth="3" fill="none" />
          <path d="M200 360 Q220 400 260 440" stroke="#78716c" strokeWidth="3" fill="none" />
          {/* 細根 */}
          <path d="M160 425 Q145 435 130 445" stroke="#78716c" strokeWidth="1.5" fill="none" />
          <path d="M170 435 Q160 445 145 460" stroke="#78716c" strokeWidth="1.5" fill="none" />
          <path d="M240 425 Q255 435 270 445" stroke="#78716c" strokeWidth="1.5" fill="none" />
          <path d="M230 435 Q240 445 255 460" stroke="#78716c" strokeWidth="1.5" fill="none" />
          {/* 根毛 */}
          <path d="M148 438 L135 435" stroke="#a8a29e" strokeWidth="1" fill="none" />
          <path d="M155 445 L142 448" stroke="#a8a29e" strokeWidth="1" fill="none" />
          <path d="M252 438 L265 435" stroke="#a8a29e" strokeWidth="1" fill="none" />
          <path d="M245 445 L258 448" stroke="#a8a29e" strokeWidth="1" fill="none" />

          {/* 土壌中のイオン */}
          {NUTRIENTS.map((n) => {
            const isSelected = selected === n.symbol
            const isOther = selected !== null && selected !== n.symbol
            return (
              <g
                key={n.symbol}
                onClick={() => handleSelect(n.symbol)}
                className="cursor-pointer"
                opacity={isOther ? 0.25 : 1}
              >
                <circle
                  cx={n.soilX}
                  cy="480"
                  r="16"
                  fill={isSelected ? n.color : '#f5f0e8'}
                  stroke={n.color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                <text
                  x={n.soilX}
                  y="485"
                  textAnchor="middle"
                  fill={isSelected ? '#fff' : '#44403c'}
                  fontSize="11"
                  fontWeight="bold"
                >
                  {n.symbol}
                </text>
                <text
                  x={n.soilX}
                  y="510"
                  textAnchor="middle"
                  fill="#d6d3d1"
                  fontSize="7"
                >
                  {n.ionForm}
                </text>
              </g>
            )
          })}

          {/* 選択された栄養素の吸収パス表示 */}
          {selectedNutrient && (
            <g>
              {/* 土壌→根 吸収線 */}
              <path
                d={`M${selectedNutrient.soilX} 464 Q${selectedNutrient.soilX} 430 200 400`}
                stroke={selectedNutrient.color}
                strokeWidth="2.5"
                fill="none"
                strokeDasharray="5,3"
                opacity="0.8"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="16"
                  to="0"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </path>
              {/* 根→葉 上昇線 */}
              <line
                x1="200"
                y1="380"
                x2="200"
                y2="140"
                stroke={selectedNutrient.color}
                strokeWidth="2.5"
                strokeDasharray="5,3"
                opacity="0.8"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="16"
                  to="0"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </line>
              {/* 葉での利用ポイント */}
              <circle cx="200" cy="110" r="8" fill={selectedNutrient.color} opacity="0.5">
                <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* タップ/クリックのヒント */}
          {!selected && (
            <text
              x="200"
              y="555"
              textAnchor="middle"
              fill="#d6d3d1"
              fontSize="10"
            >
              栄養素アイコンをタップして吸収経路を表示
            </text>
          )}
        </svg>
      </div>

      {/* 詳細パネル */}
      {selectedNutrient && (
        <div
          className={`rounded-lg border p-4 space-y-3 ${
            selectedNutrient.mobile
              ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10'
              : 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white ${
                selectedNutrient.mobile ? 'bg-green-500' : 'bg-amber-500'
              }`}
            >
              {selectedNutrient.symbol}
            </span>
            <div>
              <h3 className="font-semibold text-sm">
                {selectedNutrient.name}（{selectedNutrient.symbol}）
              </h3>
              <span className="text-[10px] text-muted-foreground">
                吸収形態: {selectedNutrient.ionForm}
              </span>
            </div>
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
                selectedNutrient.mobile
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}
            >
              {selectedNutrient.mobile ? '移動性' : '非移動性'}
            </span>
          </div>

          <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">吸収: </span>
              {selectedNutrient.absorption}
            </div>
            <div>
              <span className="font-medium text-foreground">役割: </span>
              {selectedNutrient.usage}
            </div>
            <div>
              <span className="font-medium text-foreground">転流: </span>
              {selectedNutrient.mobility}
            </div>
          </div>

          <Link
            href={`/fertilizers/nutrients/${selectedNutrient.slug}`}
            className="inline-flex items-center text-xs text-primary hover:underline"
          >
            {selectedNutrient.name}の詳細ページへ →
          </Link>
        </div>
      )}
    </div>
  )
}
