import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Droplets, Clock, Crosshair, Shield, TreePine } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { ROUTE_PESTICIDES_SPRAY_GUIDE } from '@/lib/constants/routes'
import { SPRAY_DILUTION_RATIOS, SPRAY_WATER_VOLUMES_ML } from '@/lib/constants/limits'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '散布方法ガイド | 農薬・病害虫',
  description: '農薬を安全かつ効果的に使用するための実践ガイド。希釈方法・散布タイミング・安全対策を解説。',
  alternates: { canonical: pageCanonical(ROUTE_PESTICIDES_SPRAY_GUIDE) },
}

function calculatePesticideAmount(waterMl: number, ratio: number): string {
  const amount = waterMl / ratio
  return amount % 1 === 0 ? `${amount}mL` : `${amount.toFixed(2)}mL`
}

function waterVolumeLabel(ml: number): string {
  if (ml >= 1000) return `水${ml / 1000}L`
  return `水${ml}mL`
}

export default function SprayGuidePage() {
  return (
    <div className="space-y-6">
      {/* 戻るリンク */}
      <Link
        href="/pesticides"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        農薬・病害虫トップへ
      </Link>

      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold">散布方法ガイド</h1>
        <p className="text-sm text-muted-foreground mt-1">
          農薬を安全かつ効果的に使用するための実践ガイド
        </p>
      </div>

      {/* 1. 希釈の基本 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            希釈の基本
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium text-sm">倍率の意味</h3>
            <p className="text-sm text-muted-foreground">
              1000倍希釈とは、水1L（1000mL）に対して薬剤1mLを加えることを意味します。
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-sm">計算式</h3>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-mono">
                薬剤量（mL） = 水量（mL） &divide; 希釈倍率
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-sm">よく使う希釈倍率と水量の対応表</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">倍率</th>
                    {SPRAY_WATER_VOLUMES_ML.map((vol) => (
                      <th key={vol} className="text-right py-2 px-3 font-medium">
                        {waterVolumeLabel(vol)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SPRAY_DILUTION_RATIOS.map((ratio) => (
                    <tr key={ratio} className="border-b last:border-b-0">
                      <td className="py-2 px-3 font-medium">{ratio}倍</td>
                      {SPRAY_WATER_VOLUMES_ML.map((vol) => (
                        <td key={vol} className="text-right py-2 px-3 text-muted-foreground">
                          {calculatePesticideAmount(vol, ratio)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. 散布のタイミング */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            散布のタイミング
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">早朝か夕方が最適</span>
                &mdash; 気孔が開いており、薬剤の吸収効率が高い。蒸発も少ない。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">雨の前後は避ける</span>
                &mdash; 散布後最低4〜6時間は降雨なしが理想。雨で薬剤が流れ落ちると効果が激減する。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">高温時（30℃以上）は避ける</span>
                &mdash; 薬害（葉焼け等）のリスクが高まる。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">風速3m/s以上では避ける</span>
                &mdash; 薬剤の飛散（ドリフト）リスクがあり、周囲への影響が懸念される。
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 3. 散布方法のポイント */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-primary" />
            散布方法のポイント
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">葉の裏表にまんべんなく</span>
                &mdash; 害虫は葉裏に潜むことが多い。噴霧器を上下に動かしながら散布する。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">滴り落ちる直前が適量</span>
                &mdash; 葉面が濡れてしたたり始める（したたり始め）が目安。過剰散布は薬害や環境負荷の原因になる。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">噴霧器の選び方</span>
                &mdash; 盆栽にはハンドスプレー（少量）や蓄圧式噴霧器（1〜4L）が適している。均一な霧が出るものを選ぶ。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">展着剤の役割</span>
                &mdash; 薬液の表面張力を下げ、葉面への付着・浸透を助ける。特に撥水性の高い葉（松類など）には必須。
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 4. 安全対策 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            安全対策
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">保護具の着用</span>
                &mdash; マスク（できれば防毒マスク）、ゴム手袋、長袖・長ズボンを着用する。目の保護にはゴーグルも推奨。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">散布後の手洗い・うがい</span>
                &mdash; 散布後は速やかに手洗い・うがい・洗顔を行い、衣類も着替える。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">保管方法</span>
                &mdash; 直射日光・高温を避け、鍵のかかる場所に保管する。子供やペットの手の届かない場所に置く。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">残液の処理</span>
                &mdash; 使用後の残液は排水溝に流さない。土壌に散布するか、自治体の指示に従って処分する。容器は洗浄後に適切に廃棄する。
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 5. 盆栽特有の注意点 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TreePine className="h-5 w-5 text-primary" />
            盆栽特有の注意点
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">鉢が小さいため薬剤が土壌に過剰に入りやすい</span>
                &mdash; 散布量を控えめにし、鉢土への直接散布は避ける。根への薬害に注意する。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">苔への影響を考慮</span>
                &mdash; 殺菌剤の中には苔を枯らすものがある。苔付きの盆栽では、苔を一時的に外すか、苔に影響の少ない薬剤を選ぶ。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-bold shrink-0">&bull;</span>
              <span>
                <span className="font-medium text-foreground">室内展示前は十分な乾燥期間を置く</span>
                &mdash; 展示会や室内に飾る場合は、散布後十分に乾燥させ、薬剤の臭いや残留が消えてから持ち込む。
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 免責事項 */}
      <PesticideDisclaimer />
    </div>
  )
}
