 
/**
 * 植物ホルモンガイド シードデータ
 *
 * 11種の植物ホルモンの基本情報・効果・月別活性レベル・相互作用・コラムを投入。
 *
 * 科学的正確性の担保:
 * - 化学式は IUPAC/PubChem に準拠
 * - 効果記述は植物生理学の教科書的知識（Taiz & Zeiger "Plant Physiology"等）に基づく
 * - 盆栽への応用は実践的かつ検証可能な内容に限定
 * - 月別活性は関東地方の落葉広葉樹を基準
 *
 * @module prisma/seed-hormone-data
 */

import { createSeedPrismaClient } from '../shared/create-client'

const prisma = createSeedPrismaClient()

/**
 * noUncheckedIndexedAccess 下での map lookup helper.
 * Map は DB 取得結果から構築済み。存在しない key は seed 構造のバグなので throw する。
 */
function R<V>(map: Record<string, V>, key: string): V {
  const v = map[key]
  if (v === undefined) throw new Error(`[seed-hormone] Missing key in lookup: ${key}`)
  return v
}

export async function seedHormoneData() {
  console.log('植物ホルモンデータ投入開始...')

  // ============================================================
  // ホルモン本体（11種）
  // ============================================================

  const hormonesData = [
    {
      name: 'オーキシン',
      nameEn: 'Auxin (IAA)',
      slug: 'auxin',
      category: 'major' as const,
      chemicalFormula: 'C₁₀H₉NO₂',
      description: 'インドール-3-酢酸 (IAA, PubChem CID: 802) を代表とする植物ホルモン群。茎頂・若葉・発達中の種子で合成される。細胞伸長を促進し、植物の成長方向を制御する最も基本的なホルモン。',
      bonsaiRole: '盆栽における最重要ホルモン。頂芽優勢（頂芽が側芽の成長を抑制する現象）の主因であり、摘芯・芽摘みの効果はオーキシン濃度の変化で説明できる。挿し木の発根もオーキシンが根の始原体形成を誘導することで起こる。',
      productionSite: '茎頂分裂組織、若い展開中の葉、発達中の種子。合成されたオーキシンは極性輸送（頂部から基部への一方向輸送）により移動する。',
      practicalTips: '【摘芯】頂芽を摘むとオーキシンの供給が止まり、下部の側芽が動き出す。\n【挿し木】発根促進剤（ルートン等）はオーキシン類似体（IBA）を含む。切り口に塗布することで発根率が向上。\n【屈光性】窓際に置いた盆栽が光に向かって曲がるのはオーキシンの偏在による。定期的な鉢回しで防止。',
      activationMethod: '【自然な増加条件】\n・新芽の成長期（春〜初夏）に頂芽で活発に合成される\n・光が十分な条件下で合成が促進される\n\n【管理による調整】\n・摘芯で頂芽のオーキシン源を除去 → 側芽を活性化\n・挿し木にIBA（インドール酪酸）含有の発根促進剤を塗布 → 発根促進\n・取り木の環状剥皮でオーキシンを蓄積 → 不定根の誘導',
      sortOrder: 1,
    },
    {
      name: 'ジベレリン',
      nameEn: 'Gibberellin (GA)',
      slug: 'gibberellin',
      category: 'major' as const,
      chemicalFormula: 'C₁₉H₂₂O₆',
      description: 'ジベレリン酸（GA₃, PubChem CID: 6466）を代表とする植物ホルモン群。100種以上が同定されているが、生理活性を持つのはGA₁, GA₃, GA₄等の一部。節間伸長・種子休眠打破・花芽形成に関与。',
      bonsaiRole: '盆栽では節間を伸長させるため「望ましくないホルモン」と位置付けられることが多い。徒長の主因の一つ。一方、種子の発芽促進には有用。',
      productionSite: '根端、若い葉、発達中の種子。導管を通じて上方に輸送される。',
      practicalTips: '【徒長防止】春の急激な新芽の伸びはジベレリン活性の高まりが一因。短日処理や適度な乾燥ストレスで合成を抑制可能。\n【種子の休眠打破】松類等の種子を低温湿潤処理（冷蔵庫で1-3ヶ月）するとジベレリン合成が促進され発芽する。\n【矮化】植物成長調整剤の一部（パクロブトラゾール等）はジベレリン合成阻害剤。',
      activationMethod: '【自然な増加条件】\n・春の温度上昇時に合成が急増する\n・長日条件（日照時間が長い）で合成が促進される\n・種子の低温処理（0〜7℃の湿潤条件、1-3ヶ月）でABA分解と同時にGA合成が開始\n\n【管理による調整】\n・短日処理（遮光）でジベレリン合成を抑制 → 徒長防止\n・適度な水ストレスでジベレリン活性を低下 → 節間の引き締め\n・冷蔵処理で種子のGA合成を促進 → 発芽率向上',
      sortOrder: 2,
    },
    {
      name: 'サイトカイニン',
      nameEn: 'Cytokinin',
      slug: 'cytokinin',
      category: 'major' as const,
      chemicalFormula: 'C₁₀H₁₃N₅O',
      description: 'ゼアチン、カイネチン等を含むプリン誘導体群。表示している化学式は代表的な内因性サイトカイニンであるトランス-ゼアチン (PubChem CID: 449093) の分子式。主に根端で合成され、導管を通じて地上部に輸送される。細胞分裂促進・側芽の発生誘導・葉の老化抑制。',
      bonsaiRole: 'オーキシンと拮抗的に作用し、シュートと根のバランスを制御。サイトカイニン/オーキシン比が高いと側芽・新梢の発生が促進され、低いと根の発生が促進される。',
      productionSite: '主に根端の分裂組織。導管（木部）を通じて地上部へ輸送。健全な根系がサイトカイニンの十分な供給を保証する。',
      practicalTips: '【根の健全性】根詰まりや根腐れでサイトカイニン合成が低下すると芽吹きが悪くなる。定期的な植え替えが重要。\n【葉の老化抑制】サイトカイニンは葉の老化を遅らせる。根が弱った樹で葉が早く黄化するのはサイトカイニン不足が一因。',
      activationMethod: '【自然な増加条件】\n・根が活発に伸長する時期（春・秋）に合成が活発化\n・窒素供給が十分な条件でサイトカイニン合成が促進される\n\n【管理による調整】\n・植え替え後の新根発生でサイトカイニン供給が回復 → 芽吹き改善\n・適度な窒素施肥で根のサイトカイニン合成を支援\n・根域を健全に保つ（過湿回避、通気性確保）',
      sortOrder: 3,
    },
    {
      name: 'アブシシン酸',
      nameEn: 'Abscisic acid (ABA)',
      slug: 'abscisic-acid',
      category: 'major' as const,
      chemicalFormula: 'C₁₅H₂₀O₄',
      description: '乾燥ストレスや低温に応答して合成されるセスキテルペノイド (ABA, PubChem CID: 5280896)。気孔閉鎖を誘導し蒸散を抑制。種子・芽の休眠維持に関与。',
      bonsaiRole: '秋の休眠誘導と耐寒性獲得に重要。短日条件と低温がABA合成を促進し、芽の休眠・耐凍性の獲得が進む。',
      productionSite: '葉（特に成熟葉）、根。乾燥ストレス時に根で大量合成され、導管で葉へ輸送。',
      practicalTips: '【水やり管理】過度の乾燥でABAが増加し気孔が閉じるため光合成が阻害される。適度な乾燥ストレスは節間の引き締めに有効。\n【冬越し準備】秋に徐々に水やりを減らし低温に慣らすことでABA合成が促進され耐寒性が高まる。',
      activationMethod: '【自然な増加条件】\n・秋の短日・低温条件でABA合成が促進される\n・乾燥ストレスで根がABAを急速合成する\n・種子の成熟後期に蓄積する\n\n【管理による調整】\n・秋に施肥を停止し水やりを減らす → ABA蓄積と休眠誘導を支援\n・急激な低温を避け段階的に慣らす → 耐凍性獲得に十分な時間を確保\n・種子の冷蔵処理でABA分解を促進 → 休眠打破',
      sortOrder: 4,
    },
    {
      name: 'エチレン',
      nameEn: 'Ethylene',
      slug: 'ethylene',
      category: 'major' as const,
      chemicalFormula: 'C₂H₄',
      description: '唯一の気体状植物ホルモン (Ethylene, PubChem CID: 6325)。果実の成熟・落葉・老化・ストレス応答に関与。メチオニンからACC合成酵素とACCオキシダーゼの2段階で合成。',
      bonsaiRole: '秋の紅葉・落葉に関与。機械的ストレス（風・接触）でもエチレンが生成され、茎が太く短くなる（接触形態形成）。',
      productionSite: '果実（成熟期）、老化した花弁・葉、傷害を受けた組織、根（冠水時）。気体のため拡散で周囲に広がる。',
      practicalTips: '【果実成熟】実もの盆栽の果実を色づかせるにはエチレンが必要。\n【接触形態形成】風に揺れる環境で育てるとエチレン生成により幹が太く短くなる。屋外管理の利点の一つ。',
      activationMethod: '【自然な増加条件】\n・果実の成熟期にクライマクテリック型果実で急増する\n・機械的刺激（風・接触）でACC合成酵素が活性化される\n・傷害・水ストレス・冠水でも合成が増加する\n\n【管理による調整】\n・屋外の風通しの良い場所で管理 → 接触形態形成で幹が太くなる\n・実もの盆栽は成熟果実の近くに置く → エチレン暴露で追熟促進\n・秋に適度な乾燥ストレス → 紅葉・落葉を促進',
      sortOrder: 5,
    },
    {
      name: 'ジャスモン酸',
      nameEn: 'Jasmonic acid (JA)',
      slug: 'jasmonic-acid',
      category: 'secondary' as const,
      chemicalFormula: 'C₁₂H₁₈O₃',
      description: '食害や傷害に応答して合成されるオキシリピン系シグナル分子 (JA, PubChem CID: 5281166)。防御関連タンパク質の発現を誘導し、害虫に対する抵抗性を高める。',
      bonsaiRole: '害虫の食害を受けた葉で合成され、植物全体の防御体制を強化する。揮発性物質の放出により天敵（寄生蜂等）を誘引する効果もある。',
      productionSite: '傷害を受けた葉・茎の細胞。葉緑体膜のリノレン酸から合成。',
      practicalTips: '【害虫防除との関連】軽度の害虫被害は植物の防御応答を誘導する面があるが、実用的には農薬による防除を優先する。',
      activationMethod: '【自然な増加条件】\n・害虫の食害・機械的傷害で急速に合成される\n・UV-B照射でも合成が促進される\n\n【管理による調整】\n・初期の害虫発見と対処で過度な食害を防ぎつつ、植物の自然防御を活かす\n・IPM（総合的害虫管理）の一環として天敵との共存を図る',
      sortOrder: 6,
    },
    {
      name: 'サリチル酸',
      nameEn: 'Salicylic acid (SA)',
      slug: 'salicylic-acid',
      category: 'secondary' as const,
      chemicalFormula: 'C₇H₆O₃',
      description: '病原体感染に応答して合成されるフェノール性化合物 (SA, PubChem CID: 338)。全身獲得抵抗性（SAR）を誘導し、未感染部位の病害抵抗性を高める。',
      bonsaiRole: '病害感染部位で合成されたSAが師管を通じて全身に広がり、防御遺伝子を活性化。一度病気にかかった樹が同じ病気にかかりにくくなる現象の分子基盤。',
      productionSite: '病原体の感染を受けた葉の細胞。主にisochorismate経路（ICS）で合成され、フェニルアラニンからPAL経路でも一部合成される。',
      practicalTips: '【SAR】局所的な病害感染が全身の抵抗性を高める。ただし重篤な感染を放置する理由にはならない。\n【注意】SA経路とJA経路は拮抗するため、病害抵抗性と害虫抵抗性は同時に最大化できない。',
      activationMethod: '【自然な増加条件】\n・バイオトロフ型病原菌（うどんこ病菌等）の感染でSA合成が活性化\n・過敏感反応（HR）と連動して局所で大量合成される\n\n【管理による調整】\n・適切な農薬散布で病害の初期段階を抑えつつ、SARの発動を支援\n・風通しと日当たりの確保で病害発生自体を予防',
      sortOrder: 7,
    },
    {
      name: 'ブラシノステロイド',
      nameEn: 'Brassinosteroid (BR)',
      slug: 'brassinosteroid',
      category: 'secondary' as const,
      chemicalFormula: 'C₂₈H₄₈O₆',
      description: 'ブラシノライド (PubChem CID: 443055) を代表とするステロイド系植物ホルモン。細胞伸長・細胞分裂の促進、維管束の分化に関与。',
      bonsaiRole: 'オーキシンやジベレリンと協調して茎の伸長や維管束の発達を促進。直接操作する機会は少ないが正常な生育に不可欠。',
      productionSite: '若い組織（茎頂、若葉、根端）で合成。細胞間の短距離移動が主。',
      practicalTips: '【基礎知識】正常な細胞伸長と分裂に不可欠。矮化剤の一部はブラシノステロイド合成も阻害する場合がある。',
      activationMethod: '【自然な増加条件】\n・活発な成長期に若い組織で合成される\n・光条件下で合成が促進される\n\n【管理による調整】\n・通常の管理で十分に合成される。特別な操作は不要',
      sortOrder: 8,
    },
    {
      name: 'ストリゴラクトン',
      nameEn: 'Strigolactone (SL)',
      slug: 'strigolactone',
      category: 'secondary' as const,
      chemicalFormula: 'C₁₉H₂₂O₆',
      description: '根から分泌されるカロテノイド由来のホルモン。側枝の分岐抑制、菌根菌との共生誘導、根圏微生物のシグナルとして機能。比較的最近（2008年）植物ホルモンとして認知された。化学式は代表分子ストリゴール (PubChem CID: 5281396) のもので、GA₃と同一の分子式だが構造は全く異なる。',
      bonsaiRole: 'オーキシンと協調して側枝の分岐を抑制する。リン欠乏条件下で合成が増加し、菌根菌との共生を促進する。盆栽の枝の分岐パターンに影響する。',
      productionSite: '主に根で合成され、木部を通じて地上部へ輸送。リン欠乏で合成が増加する。',
      practicalTips: '【側枝の制御】ストリゴラクトンはオーキシンとともに側芽の成長を抑制する。リン欠乏で合成が増加し、地上部の分枝が抑制される一方で根の伸長が促進される。\n【菌根菌共生】リン酸が不足する土壌で根から分泌され、菌根菌を誘引して共生関係を促進する。',
      activationMethod: '【自然な増加条件】\n・リン欠乏条件で根での合成が大幅に増加する\n・窒素欠乏でも合成が促進される傾向がある\n\n【管理による調整】\n・適切なリン酸施肥でストリゴラクトンの過剰合成を抑制し、分枝を促進\n・菌根菌入りの用土を使用する場合、ストリゴラクトンが共生を助ける',
      sortOrder: 9,
    },
    {
      name: 'フロリゲン',
      nameEn: 'Florigen (FT protein)',
      slug: 'florigen',
      category: 'secondary' as const,
      chemicalFormula: null,
      description: '花成誘導シグナル物質。正体はFT（FLOWERING LOCUS T）タンパク質で、葉で合成され師管を通じて茎頂に移動し、花芽形成を誘導する。長年「花咲ホルモン」として仮説的に語られていたが、2007年にFTタンパク質として実体が特定された。',
      bonsaiRole: '花もの盆栽（ウメ・サクラ・サツキ等）の花芽形成に直結する。適切な日長条件と温度条件がフロリゲン（FTタンパク質）の合成を誘導し、花芽が形成される。',
      productionSite: '葉（特に成熟葉）の維管束鞘細胞で合成。師管を通じて茎頂分裂組織へ輸送され、花芽形成遺伝子を活性化する。',
      practicalTips: '【花芽形成】花もの盆栽では、夏至以降の短日条件でフロリゲン合成が促進される（短日植物の場合）。遮光処理で人為的に短日条件を作ることで花芽形成を促進できる。\n【注意】樹種によって日長反応が異なる。サツキは短日で花芽形成、ウメは夏の十分な日照が重要。',
      activationMethod: '【自然な増加条件】\n・樹種に応じた臨界日長条件で葉のFT遺伝子が発現する\n・短日植物：日長が臨界日長より短くなると合成開始\n・長日植物：日長が臨界日長より長くなると合成開始\n\n【管理による調整】\n・花もの盆栽は夏に十分な日照を確保し、秋の自然な短日化でフロリゲン合成を促す\n・遮光処理による人為的な短日化で花芽誘導が可能（サツキ等）\n・夏剪定の時期に注意（花芽分化前に剪定すると花芽が付く新梢が失われる）',
      sortOrder: 10,
    },
    {
      name: 'ポリアミン',
      nameEn: 'Polyamine',
      slug: 'polyamine',
      category: 'secondary' as const,
      chemicalFormula: null,
      description: 'プトレシン、スペルミジン、スペルミンの3種を中心とする多価アミン群。厳密には「ホルモン」の定義から外れるが、植物の成長調節物質として重要。細胞分裂、ストレス耐性、老化抑制に関与する。',
      bonsaiRole: 'ストレス耐性の獲得と細胞分裂の促進に関与。低温・乾燥・塩ストレスに対する防御機構の一部として機能する。',
      productionSite: '活発に分裂している細胞（根端、茎頂、若い果実）で合成。アルギニンまたはオルニチンから合成される。',
      practicalTips: '【ストレス耐性】冬越し前にカリウムの十分な施肥を行うと耐寒性が高まる（主に浸透圧調整と酵素活性化による）。一部にポリアミン合成への関与を示唆する報告もある。\n【老化抑制】サイトカイニンとともに葉の老化を抑制する作用がある。',
      activationMethod: '【自然な増加条件】\n・活発な細胞分裂時に合成される\n・低温・乾燥ストレスで合成が増加する（防御応答）\n・カリウムの十分な供給下で合成が促進される\n\n【管理による調整】\n・秋のカリウム施肥が耐寒性獲得を支援する一因\n・適度なストレス経験がポリアミン合成を鍛え、ストレス耐性を高める',
      sortOrder: 11,
    },
  ]

  const hormones = await Promise.all(
    hormonesData.map(h =>
      prisma.hormoneType.upsert({
        where: { slug: h.slug },
        update: {},
        create: h,
      })
    )
  )

  console.log(`ホルモン ${hormones.length} 種投入完了`)

  const hMap: Record<string, string> = {}
  for (const h of hormones) {
    hMap[h.slug] = h.id
  }

  // ============================================================
  // ホルモンの効果
  // ============================================================

  await prisma.hormoneEffect.createMany({
    data: [
      // オーキシン（4効果）
      { hormoneId: R(hMap, 'auxin'), effectName: '頂芽優勢', description: '頂芽から基部へ極性輸送されるオーキシンが側芽の伸長を抑制する。頂芽を除去すると側芽が解放される。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'auxin'), effectName: '発根促進', description: '切り口付近の高濃度オーキシンが不定根の始原体形成を誘導する。挿し木の発根メカニズムの中心。', isPromoting: true, sortOrder: 2 },
      { hormoneId: R(hMap, 'auxin'), effectName: '屈光性', description: '光の反対側にオーキシンが偏在し、陰側の細胞が伸長することで茎が光に向かって曲がる。', isPromoting: true, sortOrder: 3 },
      { hormoneId: R(hMap, 'auxin'), effectName: '細胞伸長', description: '細胞壁を酸性化し、壁のゆるみと吸水による細胞伸長を促進する（酸成長説）。', isPromoting: true, sortOrder: 4 },
      // ジベレリン（3効果）
      { hormoneId: R(hMap, 'gibberellin'), effectName: '節間伸長', description: '茎の節間の細胞伸長と細胞分裂を促進し節間が長くなる。盆栽では徒長の原因。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'gibberellin'), effectName: '種子の休眠打破', description: 'アリューロン層でのα-アミラーゼ合成を誘導し、胚乳デンプン分解を促進して発芽を助ける。', isPromoting: true, sortOrder: 2 },
      { hormoneId: R(hMap, 'gibberellin'), effectName: '花芽形成調節', description: '一部の長日植物で花芽形成を促進。短日植物では逆に抑制的に作用する場合がある。', isPromoting: true, sortOrder: 3 },
      // サイトカイニン（3効果）
      { hormoneId: R(hMap, 'cytokinin'), effectName: '細胞分裂促進', description: '細胞周期のG2/M期への移行を促進し、細胞分裂を活性化する。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'cytokinin'), effectName: '側芽の発生促進', description: 'オーキシンによる側芽抑制を解除し、側芽の伸長を促進する。', isPromoting: true, sortOrder: 2 },
      { hormoneId: R(hMap, 'cytokinin'), effectName: '葉の老化抑制', description: 'クロロフィルの分解を遅延させ、葉の緑色と光合成能力を維持する。', isPromoting: false, sortOrder: 3 },
      // アブシシン酸（3効果）
      { hormoneId: R(hMap, 'abscisic-acid'), effectName: '気孔閉鎖', description: '孔辺細胞のイオンチャネルに作用し、膨圧を低下させて気孔を閉じる。乾燥ストレス時の蒸散抑制。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'abscisic-acid'), effectName: '休眠の誘導・維持', description: '種子の成熟後期にABAが蓄積し早発芽を防止。芽の休眠にも関与。', isPromoting: true, sortOrder: 2 },
      { hormoneId: R(hMap, 'abscisic-acid'), effectName: 'ストレス耐性誘導', description: '乾燥・塩・低温ストレスに対する防御遺伝子群の発現を誘導する。', isPromoting: true, sortOrder: 3 },
      // エチレン（3効果）
      { hormoneId: R(hMap, 'ethylene'), effectName: '果実成熟', description: 'クライマクテリック型果実でエチレンが成熟を促進。色素合成・軟化・芳香成分の生成を誘導。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'ethylene'), effectName: '落葉・離層形成', description: '葉柄基部の離層細胞でセルラーゼ等の分解酵素発現を誘導し、落葉を促進。', isPromoting: true, sortOrder: 2 },
      { hormoneId: R(hMap, 'ethylene'), effectName: '接触形態形成', description: '機械的刺激（風・接触）によりエチレンが生成され、茎が太く短くなる。', isPromoting: true, sortOrder: 3 },
      // ジャスモン酸（2効果）
      { hormoneId: R(hMap, 'jasmonic-acid'), effectName: '害虫防御応答', description: 'プロテアーゼ阻害剤・防御タンパク質の合成を誘導し害虫の消化酵素を阻害する。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'jasmonic-acid'), effectName: '揮発性物質放出', description: '食害植物が天敵を誘引する揮発性物質を放出する応答を誘導。', isPromoting: true, sortOrder: 2 },
      // サリチル酸（2効果）
      { hormoneId: R(hMap, 'salicylic-acid'), effectName: '全身獲得抵抗性（SAR）', description: '局所感染で合成されたSAが全身に広がり、PRタンパク質の発現を誘導する。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'salicylic-acid'), effectName: '過敏感反応制御', description: '病原体感染部位の細胞死を制御し病原体の拡散を局所に封じ込める。', isPromoting: true, sortOrder: 2 },
      // ブラシノステロイド（2効果）
      { hormoneId: R(hMap, 'brassinosteroid'), effectName: '細胞伸長促進', description: 'オーキシンと協調して細胞壁のゆるみと細胞伸長を促進する。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'brassinosteroid'), effectName: '維管束分化', description: '木部・師部の分化を促進し維管束の発達に寄与する。', isPromoting: true, sortOrder: 2 },
      // ストリゴラクトン（2効果）
      { hormoneId: R(hMap, 'strigolactone'), effectName: '側枝分岐抑制', description: 'オーキシンと協調して側芽の伸長を抑制し、頂芽優勢を強化する。', isPromoting: false, sortOrder: 1 },
      { hormoneId: R(hMap, 'strigolactone'), effectName: '菌根菌共生誘導', description: '根から土壌中に分泌され、アーバスキュラー菌根菌の菌糸分岐を誘導して共生を促進する。', isPromoting: true, sortOrder: 2 },
      // フロリゲン（2効果）
      { hormoneId: R(hMap, 'florigen'), effectName: '花芽形成誘導', description: '茎頂分裂組織で花芽形成遺伝子（AP1等）の発現を活性化し、栄養成長から生殖成長への転換を誘導する。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'florigen'), effectName: '日長応答の統合', description: '葉で感知された日長情報をFTタンパク質の合成量として統合し、茎頂に伝える長距離シグナル。', isPromoting: true, sortOrder: 2 },
      // ポリアミン（2効果）
      { hormoneId: R(hMap, 'polyamine'), effectName: 'ストレス耐性向上', description: '低温・乾燥・塩ストレス下で蓄積し、活性酸素の消去や膜の安定化に寄与する。', isPromoting: true, sortOrder: 1 },
      { hormoneId: R(hMap, 'polyamine'), effectName: '老化抑制', description: 'サイトカイニンとともに葉の老化を遅延させ、緑色と光合成能力を維持する。', isPromoting: false, sortOrder: 2 },
    ],
    skipDuplicates: true,
  })

  console.log('ホルモン効果データ投入完了')

  // ============================================================
  // 月別ホルモン活性レベル（関東地方の落葉広葉樹基準）
  // ============================================================

  const seasonalData: { slug: string; levels: { month: number; level: string; description: string }[] }[] = [
    {
      slug: 'auxin',
      levels: [
        { month: 1, level: 'minimal', description: '休眠中。オーキシン合成はほぼ停止。' },
        { month: 2, level: 'minimal', description: '休眠後期。芽内部で微量の合成が始まる。' },
        { month: 3, level: 'moderate', description: '芽吹き開始。新芽からオーキシン合成が再開。' },
        { month: 4, level: 'high', description: '新梢の急速な伸長期。頂芽からのオーキシン供給がピーク。摘芯の最適期。' },
        { month: 5, level: 'high', description: '二番芽の伸長。摘芯後の側芽からもオーキシン合成が始まる。' },
        { month: 6, level: 'moderate', description: '梅雨期。成長がやや鈍化しオーキシン合成も落ち着く。' },
        { month: 7, level: 'moderate', description: '夏の成長。適度にオーキシンが合成される。' },
        { month: 8, level: 'moderate', description: '残暑期。成長が継続するが徐々に鈍化。' },
        { month: 9, level: 'low', description: '秋の準備期。成長鈍化に伴いオーキシン合成が低下。' },
        { month: 10, level: 'low', description: '休眠準備。頂芽が休眠芽に転換しオーキシン輸送が減少。' },
        { month: 11, level: 'minimal', description: '落葉期。オーキシン合成がほぼ停止。' },
        { month: 12, level: 'minimal', description: '完全休眠期。' },
      ],
    },
    {
      slug: 'gibberellin',
      levels: [
        { month: 1, level: 'minimal', description: '休眠中。GA合成は停止。' },
        { month: 2, level: 'low', description: '低温要求量充足でGA合成が開始される。' },
        { month: 3, level: 'moderate', description: '芽吹き期。GA合成が増加し芽の膨張を促進。' },
        { month: 4, level: 'high', description: '新梢伸長のピーク。GAが節間伸長を強力に促進。徒長に注意。' },
        { month: 5, level: 'high', description: '成長旺盛期。GA活性が高い。芽摘みで徒長を制御。' },
        { month: 6, level: 'moderate', description: '梅雨期。日照不足でGA活性がやや低下。' },
        { month: 7, level: 'moderate', description: '夏の成長。適度にGAが合成される。' },
        { month: 8, level: 'low', description: '成長鈍化。GA合成が徐々に低下。' },
        { month: 9, level: 'low', description: '秋の準備期。GA合成が大幅に低下。' },
        { month: 10, level: 'minimal', description: '休眠準備。GAがほぼ検出されなくなる。' },
        { month: 11, level: 'minimal', description: '落葉期。GA合成停止。' },
        { month: 12, level: 'minimal', description: '完全休眠期。' },
      ],
    },
    {
      slug: 'cytokinin',
      levels: [
        { month: 1, level: 'minimal', description: '根の活動が最小でサイトカイニン供給が極少。' },
        { month: 2, level: 'minimal', description: '地温が低く根の活動はまだ低い。' },
        { month: 3, level: 'moderate', description: '地温上昇で根の活動再開。サイトカイニン供給が増加し芽吹きを支援。' },
        { month: 4, level: 'high', description: '根の成長が活発化。サイトカイニン供給がピークに向かい、分枝を促進。' },
        { month: 5, level: 'high', description: '根の成長ピーク。サイトカイニンが十分に供給され樹冠の充実を支える。' },
        { month: 6, level: 'moderate', description: '梅雨期。過湿で根の活動がやや制限される。' },
        { month: 7, level: 'moderate', description: '夏。高温で根の活動がやや鈍化。' },
        { month: 8, level: 'low', description: '残暑。根のストレスでサイトカイニン供給が低下。' },
        { month: 9, level: 'moderate', description: '秋の根の成長期。気温低下で根の活動が回復。' },
        { month: 10, level: 'moderate', description: '秋の根の充実期。落葉前の養分貯蔵を支援。' },
        { month: 11, level: 'low', description: '落葉期。根の活動が鈍化。' },
        { month: 12, level: 'minimal', description: '冬。根の活動が最小限に。' },
      ],
    },
    {
      slug: 'abscisic-acid',
      levels: [
        { month: 1, level: 'high', description: '完全休眠期。ABA濃度が高く芽の成長を抑制。耐凍性を維持。' },
        { month: 2, level: 'moderate', description: '休眠後期。低温処理によりABA分解が進行中。' },
        { month: 3, level: 'low', description: '芽吹き期。ABAが大幅に低下しGA/ABA比が上昇。休眠打破。' },
        { month: 4, level: 'minimal', description: '成長期。ABAは最小限。' },
        { month: 5, level: 'minimal', description: '成長旺盛期。ABAは低レベル。' },
        { month: 6, level: 'low', description: '梅雨期。一時的な乾燥ストレスで軽度増加の場合あり。' },
        { month: 7, level: 'low', description: '夏の高温期。乾燥ストレスでABAが増加し気孔を制御。' },
        { month: 8, level: 'moderate', description: '残暑期。高温乾燥でABA合成が活発化。' },
        { month: 9, level: 'moderate', description: '秋の初め。短日化でABA合成が徐々に増加。' },
        { month: 10, level: 'high', description: '休眠誘導期。ABAが蓄積し、芽の休眠と耐凍性獲得を促進。' },
        { month: 11, level: 'high', description: '落葉・休眠期。ABA濃度がピーク。' },
        { month: 12, level: 'high', description: '完全休眠期。ABAが芽の休眠を維持。' },
      ],
    },
    {
      slug: 'ethylene',
      levels: [
        { month: 1, level: 'minimal', description: '休眠中。エチレン合成はほぼなし。' },
        { month: 2, level: 'minimal', description: '休眠中。' },
        { month: 3, level: 'low', description: '芽吹き期。軽微なエチレン生成。' },
        { month: 4, level: 'low', description: '成長期。機械的刺激（風）でのエチレン生成が始まる。' },
        { month: 5, level: 'moderate', description: '屋外管理で風による接触形態形成が活発化。' },
        { month: 6, level: 'moderate', description: '梅雨期。冠水ストレスでエチレン生成が増加する場合あり。' },
        { month: 7, level: 'moderate', description: '夏。実もの盆栽では果実成熟に伴いエチレンが増加。' },
        { month: 8, level: 'moderate', description: '果実の成熟期。クライマクテリック果実でエチレン急増。' },
        { month: 9, level: 'high', description: '秋の始まり。落葉準備としてエチレン合成が活発化。' },
        { month: 10, level: 'high', description: '落葉期。エチレンが離層形成を促進し落葉が進行。' },
        { month: 11, level: 'moderate', description: '落葉後期。残りの葉の離層形成が完了。' },
        { month: 12, level: 'minimal', description: '完全休眠期。エチレン合成はほぼ停止。' },
      ],
    },
  ]

  for (const { slug, levels } of seasonalData) {
    const hormoneId = hMap[slug]
    if (!hormoneId) continue
    await prisma.hormoneSeasonalLevel.createMany({
      data: levels.map(l => ({
        hormoneId,
        month: l.month,
        level: l.level,
        description: l.description,
      })),
      skipDuplicates: true,
    })
  }

  console.log('月別ホルモン活性データ投入完了')

  // ============================================================
  // ホルモン間相互作用
  // ============================================================

  await prisma.hormoneInteraction.createMany({
    data: [
      {
        hormoneAId: R(hMap, 'auxin'), hormoneBId: R(hMap, 'cytokinin'), type: 'antagonistic',
        description: 'オーキシン/サイトカイニン比が器官分化を決定。オーキシン優位で根、サイトカイニン優位でシュートの分化が促進。',
        bonsaiRelevance: '盆栽樹形管理の根幹。摘芯でオーキシン源を除去しサイトカイニンを相対的に優位にして側芽を動かす。根の充実がサイトカイニン供給を増やし芽吹きを改善。',
        sortOrder: 1,
      },
      {
        hormoneAId: R(hMap, 'auxin'), hormoneBId: R(hMap, 'gibberellin'), type: 'synergistic',
        description: 'オーキシンがジベレリン合成遺伝子の発現を促進。茎の伸長で協調的に作用し相乗効果で細胞伸長が増幅。',
        bonsaiRelevance: '春の急速な徒長はオーキシンとジベレリンの同時増加が原因。早めの芽摘みでこの増幅ループを断つ。',
        sortOrder: 2,
      },
      {
        hormoneAId: R(hMap, 'auxin'), hormoneBId: R(hMap, 'ethylene'), type: 'modulatory',
        description: '高濃度オーキシンはエチレン合成を促進（ACC合成酵素の発現誘導）。エチレンはオーキシンの極性輸送を阻害する場合がある。',
        bonsaiRelevance: '取り木（環状剥皮）でオーキシンが剥皮部上部に蓄積しエチレン生成が増加。発根と離層形成の両方に関与。',
        sortOrder: 3,
      },
      {
        hormoneAId: R(hMap, 'auxin'), hormoneBId: R(hMap, 'strigolactone'), type: 'synergistic',
        description: 'ストリゴラクトンはオーキシンと協調して側枝の分岐を抑制する。オーキシンの極性輸送を調節する。',
        bonsaiRelevance: '頂芽優勢の分子メカニズムにストリゴラクトンも関与。リン欠乏でストリゴラクトンが増加すると分枝が抑制される。',
        sortOrder: 4,
      },
      {
        hormoneAId: R(hMap, 'gibberellin'), hormoneBId: R(hMap, 'abscisic-acid'), type: 'antagonistic',
        description: 'GAとABAは種子の休眠・発芽で拮抗。GAが休眠を打破しABAが休眠を維持。GA/ABA比が発芽の鍵。',
        bonsaiRelevance: '種子の冷蔵処理はABA分解とGA合成を同時に促進しGA/ABA比を上昇させ休眠打破と発芽を誘導。',
        sortOrder: 5,
      },
      {
        hormoneAId: R(hMap, 'cytokinin'), hormoneBId: R(hMap, 'abscisic-acid'), type: 'antagonistic',
        description: 'サイトカイニンは葉の老化を抑制しABAは促進。秋の落葉はABA増加とサイトカイニン供給減少の同時進行で進む。',
        bonsaiRelevance: '秋に根活動が低下するとサイトカイニン供給が減少しABAが増加して紅葉・落葉が進行。',
        sortOrder: 6,
      },
      {
        hormoneAId: R(hMap, 'salicylic-acid'), hormoneBId: R(hMap, 'jasmonic-acid'), type: 'antagonistic',
        description: 'SA経路（病害抵抗性）とJA経路（害虫抵抗性）は相互に抑制。両方の防御を同時に最大化できない。',
        bonsaiRelevance: '病害と害虫が同時発生した場合、植物は片方の防御に偏る。農薬による両面での防除が重要な理由の一つ。',
        sortOrder: 7,
      },
      {
        hormoneAId: R(hMap, 'ethylene'), hormoneBId: R(hMap, 'abscisic-acid'), type: 'synergistic',
        description: '落葉過程でエチレンとABAが協調。ABAが離層細胞の感受性を高めエチレンが分解酵素を誘導。',
        bonsaiRelevance: '秋の自然な落葉は両ホルモンの協調で進行。適切な時期の落葉は翌春の芽吹きの健全性に重要。',
        sortOrder: 8,
      },
    ],
    skipDuplicates: true,
  })

  console.log('ホルモン相互作用データ投入完了')

  // ============================================================
  // コラム（3本）
  // ============================================================

  await prisma.hormoneColumn.createMany({
    data: [
      {
        slug: 'auxin-cytokinin-ratio',
        title: 'オーキシン/サイトカイニン比と盆栽の樹形管理',
        content: '盆栽の樹形づくりの多くの技法は、オーキシンとサイトカイニンのバランスを操作することで説明できます。本コラムでは、この2つのホルモンの比率がどのように芽吹き・発根・樹形に影響するかを解説します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 基本原理\n━━━━━━━━━━━━━━━━━━━━━━━\n\nオーキシンは茎頂（頂芽）で合成され極性輸送により基部へ移動します。サイトカイニンは根端で合成され導管を通じて地上部に輸送されます。\n\nこの2つの比率が器官分化の方向を決定します。\n\n・オーキシン優位 → 根の形成が促進\n・サイトカイニン優位 → シュート（新梢・側芽）の形成が促進\n・バランス → カルス（未分化組織）が維持\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 盆栽技法との対応\n━━━━━━━━━━━━━━━━━━━━━━━\n\n【摘芯・芽摘み】\n頂芽を摘むとオーキシン供給源が除去され、側芽に対するオーキシンの抑制が解除。根からのサイトカイニンが側芽に到達しやすくなり側芽の伸長が促進される。\n→ 枝数が増え樹冠が密になる\n\n【挿し木】\n切り枝の基部にオーキシンが蓄積し発根を誘導。発根促進剤（IBA含有）がこのメカニズムを強化。\n→ オーキシン過剰は逆に発根抑制のため適量塗布が重要\n\n【根の充実と芽吹き】\n健全な根系はサイトカイニンの十分な合成を保証。根詰まり・根腐れでサイトカイニン供給が低下すると芽吹きが悪化。\n→ 定期的な植え替えの科学的意義\n\n【取り木（環状剥皮）】\n幹の一部の樹皮を環状に剥ぐと下降するオーキシンが剥皮部で蓄積し不定根の形成を誘導。',
        category: 'bonsai_practice',
        publishedAt: new Date(),
        sortOrder: 1,
      },
      {
        slug: 'dormancy-hormones',
        title: '休眠と覚醒のホルモン制御 ─ 冬越し・芽出しの科学',
        content: '盆栽の冬越しと春の芽出しは複数の植物ホルモンが精密に連携した結果です。本コラムでは休眠の誘導・維持・打破に関わるホルモンのメカニズムと盆栽管理への応用を解説します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 休眠の3段階\n━━━━━━━━━━━━━━━━━━━━━━━\n\n1. 準休眠（paradormancy）：他の器官からのシグナル（オーキシン等）による成長抑制\n2. 内生休眠（endodormancy）：芽自体が内因的に成長を停止。低温を一定期間経験しないと打破されない\n3. 環境休眠（ecodormancy）：内生休眠打破後、環境条件（低温・短日）が成長を抑制\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 休眠誘導のホルモン変化\n━━━━━━━━━━━━━━━━━━━━━━━\n\n秋に日長が短くなり気温が低下すると：\n・ABA増加：短日と低温がABA合成を促進。芽の成長停止と耐凍性遺伝子の発現を誘導\n・サイトカイニン減少：根の活動低下に伴い合成量が減少。葉の老化が進行\n・エチレン一時的増加：離層形成を促進し落葉を誘導\n・ジベレリン減少：節間伸長が停止し頂芽が休眠芽に転換\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 休眠打破と春の芽出し\n━━━━━━━━━━━━━━━━━━━━━━━\n\n内生休眠の打破には一定期間の低温（0〜7℃）が必要。この期間中：\n・ABAの分解が進行\n・GA合成が開始\n・GA/ABA比が上昇 → 休眠打破のシグナル\n\n春に気温が上昇すると：\n・ジベレリン増加 → 芽の膨張と展開\n・サイトカイニン増加 → 根の活動再開で合成再開\n・オーキシン合成開始 → 新芽から極性輸送が再開\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 盆栽管理への応用\n━━━━━━━━━━━━━━━━━━━━━━━\n\n【冬越し】\n・秋に施肥停止・水やり減で ABA合成を促進し休眠移行を支援\n・徐々に低温に慣らす（ABA蓄積と耐凍性獲得の時間確保）\n・暖房室内に長期間置くと低温要求量が不足し翌春の芽出しが不均一に\n\n【春の芽出し促進】\n・低温要求量充足後は日当たりの良い場所に移動\n・土壌温度上昇後に水やりを増やしサイトカイニン合成を促進\n・芽出し直後の施肥は控えめに（新根展開後から本格施肥）',
        category: 'seasonal',
        publishedAt: new Date(),
        sortOrder: 2,
      },
      {
        slug: 'stress-hormone-response',
        title: '植物のストレス応答とホルモン ─ 盆栽が「強くなる」メカニズム',
        content: '「少し厳しく育てた方が盆栽は強くなる」と言われます。これは植物ホルモンによるストレス応答の科学で説明できます。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ ストレスに応答する3つのホルモン\n━━━━━━━━━━━━━━━━━━━━━━━\n\n【ABA ─ 乾燥・塩・低温ストレス】\n乾燥ストレスで根がABAを急速合成し気孔を閉鎖。蒸散抑制で水分を保全。\n\n【エチレン ─ 機械的ストレス・浸水】\n風や接触でエチレンが生成され茎の伸長が抑制されて太く短くなる（接触形態形成）。\n\n【ジャスモン酸 ─ 食害・傷害】\n食害でJAが合成され防御タンパク質発現を誘導。植物全体の防御体制が強化。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 適度なストレスの効果（ホルミシス）\n━━━━━━━━━━━━━━━━━━━━━━━\n\n適度なストレスは植物を「強化」する（eustress）：\n・適度な乾燥 → ABAにより気孔制御が鍛えられ将来の乾燥に強くなる\n・適度な風 → エチレンにより茎が太くなり機械的強度が増す\n・軽度の食害 → JAにより防御体制が構築され次の食害に強くなる\n\nただし過度のストレスは衰弱と回復不能なダメージを与える。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 盆栽管理への応用\n━━━━━━━━━━━━━━━━━━━━━━━\n\n【水やりの「辛め」管理】\n土の表面が乾いてから水やりする方がABA応答を適度に活性化し乾燥に強い樹に育つ。ただし極端な水切れは根を傷める。\n\n【屋外管理の利点】\n風に当たる環境ではエチレン生成により幹が太く引き締まる。室内栽培で徒長しやすいのはエチレン刺激の不足も一因。\n\n【過保護の弊害】\n無風・常時適温・常時湿潤ではストレス応答系が鍛えられず環境変化に弱い樹になる。自然な季節変化を経験させることが重要。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 注意事項\n━━━━━━━━━━━━━━━━━━━━━━━\n\n意図的に過度のストレスを与えることは推奨しません。自然な季節変化と適切な管理の範囲内で植物のストレス応答システムが活性化されることを目指してください。',
        category: 'bonsai_practice',
        publishedAt: new Date(),
        sortOrder: 3,
      },
      {
        slug: 'ethylene-thigmomorphogenesis',
        title: 'エチレンと接触形態形成 ─ 針金掛けの科学',
        content: '盆栽の針金掛けは単なる物理的な矯正ではなく、植物ホルモンを介した生理応答を引き起こします。本コラムでは機械的ストレスとエチレンの関係を解説します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 接触形態形成（Thigmomorphogenesis）\n━━━━━━━━━━━━━━━━━━━━━━━\n\nJaffe（1973）が提唱した概念で、植物が機械的刺激に応答して形態を変化させる現象です。風・接触・屈曲などの物理的ストレスを受けると、茎の伸長が抑制され、径方向の肥大が促進されます。針金掛けによる枝の屈曲はまさにこの応答を誘導します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ エチレン生合成の活性化\n━━━━━━━━━━━━━━━━━━━━━━━\n\n機械的ストレスはACC合成酵素（ACS）の遺伝子発現を誘導します。メチオニン → SAM → ACC → エチレンという生合成経路において、ACSが律速段階です。屈曲部位ではACS活性が数時間以内に上昇し、エチレン生成量が2〜4倍に増加します。ACCオキシダーゼ（ACO）も同時に誘導され、エチレン生成が持続します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 形態変化のメカニズム\n━━━━━━━━━━━━━━━━━━━━━━━\n\nエチレンは縦方向の細胞伸長を抑制し、横方向の細胞膨張を促進します。これにより節間が短くなり、茎が太くなります。盆栽では「締まった枝」として好まれる形態です。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 針金掛けの実践的示唆\n━━━━━━━━━━━━━━━━━━━━━━━\n\n・成長期の針金掛けはエチレン応答が強く枝が太りやすい → 食い込み注意\n・休眠期は応答が穏やかで安全だが形態変化効果も緩やか\n・適度な屈曲は節間の引き締めに有効だが、過度な力は組織破壊を招く',
        category: 'bonsai_practice',
        publishedAt: new Date(),
        sortOrder: 4,
      },
      {
        slug: 'gibberellin-internode-control',
        title: 'ジベレリンと節間制御 ─ 締まった樹形の作り方',
        content: '盆栽の美しさは「節間の短さ」に大きく左右されます。節間伸長を制御するジベレリン（GA）のメカニズムと、GA活性を抑える盆栽技法を解説します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ ジベレリンと節間伸長\n━━━━━━━━━━━━━━━━━━━━━━━\n\nGAは茎の節間伸長を強力に促進するホルモンです。茎頂分裂組織や若い葉で合成され、細胞の縦方向の伸長を誘導します。GA濃度が高いほど節間は長くなり、盆栽では「間延び」として忌避される状態になります。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ GA/DELLAシグナル経路\n━━━━━━━━━━━━━━━━━━━━━━━\n\nDELLAタンパク質は成長抑制因子として機能します（Hedden & Thomas 2012）。GAが存在するとDELLAが分解され成長が促進されます。DELLAが安定に存在する条件では節間伸長が抑制され、矮性の形態になります。盆栽の「締まった樹形」はDELLA優位の状態に相当します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ GA活性を抑える盆栽技法\n━━━━━━━━━━━━━━━━━━━━━━━\n\n【十分な日照確保】\n日照不足はGA合成を促進し徒長の原因になります。十分な光量下ではGA活性が抑制され節間が短くなります。\n\n【リン酸優位の施肥】\n窒素過多はGA合成を促進します。春以降はリン酸・カリ優位の施肥でGA活性を穏やかに保ちます。\n\n【短日処理の応用】\n一部の樹種では短日条件がGA合成を抑制し、成長停止を早めます。秋の自然な短日化がこれに寄与します。\n\n【芽摘みのタイミング】\n新芽が伸び始める初期段階での芽摘みは、GA合成部位の除去として有効です。伸びきった後では次の芽も間延びしやすくなります。',
        category: 'bonsai_practice',
        publishedAt: new Date(),
        sortOrder: 5,
      },
      {
        slug: 'summer-hormone-management',
        title: '真夏のホルモン管理 ─ 高温ストレスと盆栽の夏越し',
        content: '35℃を超える猛暑日が続くと盆栽は深刻な高温ストレスに晒されます。植物ホルモンの視点から夏越し管理を解説します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 高温ストレスとABA\n━━━━━━━━━━━━━━━━━━━━━━━\n\n高温下では葉からの蒸散が急増し、根の吸水が追いつかなくなります。この水分不足を感知した根はABAを急速に合成し、導管を通じて葉に送ります。ABAは気孔閉鎖を誘導して水分損失を防ぎますが、同時にCO2の取り込みも制限されるため光合成効率が低下します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 熱ショックタンパク質（HSP）\n━━━━━━━━━━━━━━━━━━━━━━━\n\n高温はタンパク質の変性を引き起こします。植物はHSPを合成して既存タンパク質を保護します。HSPの合成にはエネルギーが大量に消費されるため、高温期は成長よりも防御にエネルギーが配分されます。この時期の施肥は代謝負荷を増やすため避けるべきです。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 高温時のエチレン\n━━━━━━━━━━━━━━━━━━━━━━━\n\n過度の高温はストレス性エチレンの生成を誘導し、落葉や花芽の脱落を引き起こすことがあります。特に鉢内温度が上昇しやすい黒い鉢や金属鉢では根圏温度に注意が必要です。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 夏越しの実践管理\n━━━━━━━━━━━━━━━━━━━━━━━\n\n・遮光（30〜50%）で葉温上昇とABA過剰蓄積を軽減\n・朝夕の水やりで根圏温度を下げ、ABA応答を穏やかに保つ\n・真夏の施肥は中断し、HSP合成への代謝集中を妨げない\n・棚下や二重鉢で鉢の過熱を防ぎ、根のストレスエチレン生成を抑制\n・猛暑時の植替え・剪定は厳禁 ─ ストレスホルモンが重複し回復不能になる危険がある',
        category: 'seasonal',
        publishedAt: new Date(),
        sortOrder: 6,
      },
      {
        slug: 'autumn-coloring-hormones',
        title: '紅葉・黄葉のホルモン科学 ─ 美しい秋色を引き出す管理',
        content: '盆栽の秋の見どころである紅葉・黄葉は、複数のホルモンが関与する精密な葉の老化プロセスです。Lim et al.（2007）の葉老化総説を基に解説します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 葉老化とホルモンの役割分担\n━━━━━━━━━━━━━━━━━━━━━━━\n\n【エチレン ─ 老化の引き金】\n秋の短日と低温がエチレン合成を誘導し、クロロフィル分解酵素の発現を開始させます。緑色の退色はクロロフィル分解により下層のカロテノイド（黄色）が露出する過程です。\n\n【ABA ─ アントシアニン合成の促進】\nABAはアントシアニン生合成経路の鍵酵素（PAL、CHS）の発現を促進します。糖の蓄積とABAの相乗効果で鮮やかな赤色が生まれます。\n\n【サイトカイニン ─ 老化の抑制】\nサイトカイニンはクロロフィルの分解を遅延させます。根が健全でサイトカイニン供給が豊富な葉は緑色を長く保持します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 美しい紅葉の条件\n━━━━━━━━━━━━━━━━━━━━━━━\n\n・昼夜の寒暖差（昼15〜20℃/夜5〜10℃）：昼間の光合成で糖を蓄積し、夜間の低温でアントシアニン合成を促進\n・十分な日照：光合成による糖蓄積がアントシアニンの基質となる\n・適度な乾燥：ABA蓄積を促しアントシアニン合成を強化\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 盆栽管理への応用\n━━━━━━━━━━━━━━━━━━━━━━━\n\n・9月以降は窒素肥料を停止 → 窒素過多はクロロフィルの分解を遅らせ紅葉を妨げる\n・秋は屋外で寒暖差に当てる → 室内管理では紅葉しにくい\n・水やりをやや控えめに → ABA蓄積を促しアントシアニン合成を支援\n・夏の葉焼けを防ぐ → 損傷した葉は美しく紅葉しない',
        category: 'seasonal',
        publishedAt: new Date(),
        sortOrder: 7,
      },
      {
        slug: 'root-hormone-signaling',
        title: '根と地上部のホルモン対話 ─ 植え替え・根切りの影響',
        content: '根は単なる水分・養分の吸収器官ではなく、ホルモンを介して地上部の成長を制御するシグナル発信源です。Aloni et al.（2006）の知見を基に解説します。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 根から地上部へのホルモンシグナル\n━━━━━━━━━━━━━━━━━━━━━━━\n\n【サイトカイニン ─ 成長促進シグナル】\n根端の分裂組織で合成されたサイトカイニンは導管を通じて地上部に輸送されます。芽の細胞分裂を促進し、葉の老化を遅延させます。根系の健全さが芽吹きの質を直接決定します。\n\n【ABA ─ ストレス警報シグナル】\n土壌乾燥や根の損傷時にABAが合成され、導管経由で葉に到達し気孔を閉鎖します。根の状態が悪い樹は常にABAが高く、成長が抑制された状態になります。\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 根切り（根の剪定）の影響\n━━━━━━━━━━━━━━━━━━━━━━━\n\n植替え時の根切りはサイトカイニン合成部位（根端）の大量除去を意味します。\n\n・直後〜2週間：サイトカイニン供給が急減し地上部の成長が一時停止\n・2〜4週間：切断面からオーキシン蓄積により新根が発生開始\n・4〜8週間：新根端が成熟しサイトカイニン合成が再開。芽の活動が回復\n・8週間以降：根系が再構築され正常なホルモンバランスに復帰\n\n\n━━━━━━━━━━━━━━━━━━━━━━━\n■ 盆栽管理への応用\n━━━━━━━━━━━━━━━━━━━━━━━\n\n・植替え後の芽吹き不良は正常なホルモン応答 → 焦って施肥しない\n・根の健全性が翌年の芽吹きを決める → 根詰まりは早めに解消\n・植替え適期（春の芽動き前）はサイトカイニン需要が最も高まる直前であり、新根再生の時間を確保できる\n・片側の根だけ切ると対応する地上部の枝の芽吹きが偏る → 根と枝のバランスを意識する\n・太根より細根を残す → 細根端がサイトカイニンの主要合成部位',
        category: 'bonsai_practice',
        publishedAt: new Date(),
        sortOrder: 8,
      },
    ],
    skipDuplicates: true,
  })

  console.log('ホルモンコラムデータ投入完了')

  // ============================================================
  // ホルモン × 盆栽技法マッピング（19レコード）
  //
  // 科学的根拠:
  // - Thimann & Skoog 1933: 頂芽優勢とオーキシン
  // - Muller & Leyser 2011: 側枝分岐制御
  // - Jaffe 1973: 接触形態形成（thigmomorphogenesis）
  // - Sachs 1991: 極性輸送と器官形成
  // - Zhu 2002: ABAと乾燥ストレス応答
  // - Jackson 2002: 冠水ストレスとエチレン
  // - Cholodny-Went theory: 屈光性とオーキシン再分配
  // - Corbesier et al. 2007: フロリゲンの同定
  // ============================================================

  await prisma.hormoneTechnique.createMany({
    data: [
      // 摘芯（芽摘み）
      {
        hormoneId: R(hMap, 'auxin'), techniqueName: '摘芯（芽摘み）', techniqueNameEn: 'Pinching', techniqueSlug: 'pinching',
        effectType: 'decrease', magnitude: 'strong',
        mechanism: '頂芽（オーキシンの主要合成部位）を除去することで、極性輸送による基部へのオーキシン供給が途絶える。これにより側芽に対する頂芽優勢が解除される。',
        practicalNote: '春〜初夏の新梢伸長期に行うと効果的。摘芯後は側芽が動き出すまで1〜2週間を要する。',
        bestMonths: [4, 5, 6],
        sortOrder: 1,
      },
      {
        hormoneId: R(hMap, 'cytokinin'), techniqueName: '摘芯（芽摘み）', techniqueNameEn: 'Pinching', techniqueSlug: 'pinching',
        effectType: 'increase', magnitude: 'moderate',
        mechanism: 'オーキシンによる側芽抑制が解除されると、根から導管を通じて供給されるサイトカイニンが側芽に到達しやすくなり、側芽の細胞分裂と伸長が促進される。',
        practicalNote: '根が健全であるほどサイトカイニン供給が豊富で、摘芯後の側芽の動きが良くなる。',
        bestMonths: [4, 5, 6],
        sortOrder: 2,
      },
      // 剪定
      {
        hormoneId: R(hMap, 'auxin'), techniqueName: '剪定', techniqueNameEn: 'Pruning', techniqueSlug: 'pruning',
        effectType: 'decrease', magnitude: 'strong',
        mechanism: '複数の枝先（オーキシン合成部位）を除去することで、樹全体のオーキシン供給が広範に減少する。残った芽に対する抑制が弱まる。',
        practicalNote: '冬の落葉期の剪定は翌春の芽吹きパターンに大きく影響する。',
        bestMonths: [1, 2, 6, 7],
        sortOrder: 3,
      },
      {
        hormoneId: R(hMap, 'cytokinin'), techniqueName: '剪定', techniqueNameEn: 'Pruning', techniqueSlug: 'pruning',
        effectType: 'increase', magnitude: 'moderate',
        mechanism: 'オーキシン/サイトカイニン比がサイトカイニン優位に傾き、残存する芽の発生・伸長が促進される。',
        practicalNote: '強剪定後は一気に多くの芽が動くため、不要芽の整理が必要。',
        bestMonths: [1, 2, 6, 7],
        sortOrder: 4,
      },
      {
        hormoneId: R(hMap, 'gibberellin'), techniqueName: '剪定', techniqueNameEn: 'Pruning', techniqueSlug: 'pruning',
        effectType: 'increase', magnitude: 'mild',
        mechanism: '剪定後の新梢再生時にジベレリン合成が活性化し、節間伸長が促進される。特に強剪定後の徒長枝で顕著。',
        practicalNote: '強剪定後の徒長に注意。必要に応じて二度切りや芽かきで制御。',
        bestMonths: [1, 2, 6, 7],
        sortOrder: 5,
      },
      // 針金掛け
      {
        hormoneId: R(hMap, 'ethylene'), techniqueName: '針金掛け', techniqueNameEn: 'Wiring', techniqueSlug: 'wiring',
        effectType: 'increase', magnitude: 'moderate',
        mechanism: '枝を曲げる機械的ストレスがACC合成酵素を活性化し、エチレン生成が増加する。接触形態形成（thigmomorphogenesis）により枝が太く短くなる。',
        practicalNote: '針金掛け後は枝が太りやすいため、食い込み防止のため定期的に確認する。',
        bestMonths: [10, 11, 12, 1, 2, 3],
        sortOrder: 6,
      },
      {
        hormoneId: R(hMap, 'auxin'), techniqueName: '針金掛け', techniqueNameEn: 'Wiring', techniqueSlug: 'wiring',
        effectType: 'redistribute', magnitude: 'mild',
        mechanism: '枝を曲げると重力と機械的変形によりオーキシンが曲げの外側（下側）に偏在し、局所的な細胞伸長パターンが変化する。',
        practicalNote: '曲げた枝の下側が膨らみやすいのはオーキシン再分配による。',
        bestMonths: [10, 11, 12, 1, 2, 3],
        sortOrder: 7,
      },
      // 植替え
      {
        hormoneId: R(hMap, 'cytokinin'), techniqueName: '植替え', techniqueNameEn: 'Repotting', techniqueSlug: 'repotting',
        effectType: 'decrease', magnitude: 'strong',
        mechanism: '根の剪定により活発なサイトカイニン合成部位（根端分裂組織）が大幅に除去される。新根が再生するまでサイトカイニン供給が一時的に低下する。',
        practicalNote: '植替え後は地上部の芽吹きが一時的に鈍化する。新根の再生を待つ。',
        bestMonths: [2, 3, 4],
        sortOrder: 8,
      },
      {
        hormoneId: R(hMap, 'auxin'), techniqueName: '植替え', techniqueNameEn: 'Repotting', techniqueSlug: 'repotting',
        effectType: 'increase', magnitude: 'mild',
        mechanism: '根端の除去によりオーキシンの分解・消費部位が減少し、地上部から根へ向かうオーキシンが切断面付近に蓄積。新根の発根を促進する。',
        practicalNote: '根の切り口からの発根はオーキシン蓄積による。細根が多い位置で切ると再生が早い。',
        bestMonths: [2, 3, 4],
        sortOrder: 9,
      },
      // 葉刈り
      {
        hormoneId: R(hMap, 'gibberellin'), techniqueName: '葉刈り', techniqueNameEn: 'Defoliation', techniqueSlug: 'defoliation',
        effectType: 'increase', magnitude: 'strong',
        mechanism: '全葉除去により光合成器官を失った樹が新葉再生を急ぐ。新葉展開時にジベレリン合成が活性化し、節間伸長と葉面積の急速な確保が起こる。',
        practicalNote: '葉刈りは樹勢が十分な落葉樹に限る。針葉樹には行わない。',
        bestMonths: [6, 7],
        sortOrder: 10,
      },
      {
        hormoneId: R(hMap, 'auxin'), techniqueName: '葉刈り', techniqueNameEn: 'Defoliation', techniqueSlug: 'defoliation',
        effectType: 'increase', magnitude: 'moderate',
        mechanism: '新芽（葉原基）の展開に伴い、新たなオーキシン合成部位が形成される。若い葉はオーキシンの主要合成部位である。',
        practicalNote: '葉刈り後は多数の新芽が同時に動き、均一な二番芽が得られる。',
        bestMonths: [6, 7],
        sortOrder: 11,
      },
      // 取り木
      {
        hormoneId: R(hMap, 'auxin'), techniqueName: '取り木', techniqueNameEn: 'Air Layering', techniqueSlug: 'air-layering',
        effectType: 'increase', magnitude: 'strong',
        mechanism: '環状剥皮により師管を通じた物質輸送が遮断され、頂部から極性輸送されるオーキシンが剥皮部上部に蓄積する。高濃度オーキシンが不定根始原体の形成を誘導する。',
        practicalNote: '剥皮後、水苔で包んだ部分から4〜8週間で発根が始まる。',
        bestMonths: [5, 6, 7],
        sortOrder: 12,
      },
      {
        hormoneId: R(hMap, 'ethylene'), techniqueName: '取り木', techniqueNameEn: 'Air Layering', techniqueSlug: 'air-layering',
        effectType: 'increase', magnitude: 'moderate',
        mechanism: '剥皮部上部に蓄積した高濃度オーキシンがACC合成酵素の発現を誘導し、エチレン生成が増加する。エチレンは不定根形成をさらに促進する。',
        practicalNote: 'エチレンの発根促進作用により、取り木の成功率が高まる。',
        bestMonths: [5, 6, 7],
        sortOrder: 13,
      },
      // 挿し木
      {
        hormoneId: R(hMap, 'auxin'), techniqueName: '挿し木', techniqueNameEn: 'Cuttings', techniqueSlug: 'cuttings',
        effectType: 'increase', magnitude: 'strong',
        mechanism: '切り枝の頂部から基部へ極性輸送されるオーキシンが切断面に蓄積し、不定根の始原体形成を誘導する。発根促進剤（IBA）は外部からオーキシン濃度を高める。',
        practicalNote: '発根促進剤（ルートン等）の適量使用で成功率向上。過剰塗布は逆に発根を阻害する。',
        bestMonths: [5, 6, 7, 9],
        sortOrder: 14,
      },
      // 水やり管理
      {
        hormoneId: R(hMap, 'abscisic-acid'), techniqueName: '水やり管理', techniqueNameEn: 'Watering Management', techniqueSlug: 'watering-management',
        effectType: 'increase', magnitude: 'strong',
        mechanism: '乾燥ストレスにより根でNCED（9-cis-エポキシカロテノイドジオキシゲナーゼ）が活性化され、ABAが急速に合成される。導管を通じて葉に輸送され気孔閉鎖を誘導する。',
        practicalNote: '適度な「辛め」の水やりはABA応答を鍛え乾燥耐性を高める。過度の乾燥は根を傷める。',
        bestMonths: [4, 5, 6, 7, 8, 9],
        sortOrder: 15,
      },
      {
        hormoneId: R(hMap, 'ethylene'), techniqueName: '水やり管理', techniqueNameEn: 'Watering Management', techniqueSlug: 'watering-management',
        effectType: 'increase', magnitude: 'mild',
        mechanism: '過湿・冠水状態では根が低酸素に曝され、ACC（エチレン前駆体）が根で合成されて導管で地上部に輸送される。地上部でACCオキシダーゼによりエチレンに変換される。',
        practicalNote: '受け皿の水を放置すると過湿→エチレン増加→落葉のリスク。',
        bestMonths: [6, 7, 8],
        sortOrder: 16,
      },
      // 日照管理
      {
        hormoneId: R(hMap, 'auxin'), techniqueName: '日照管理', techniqueNameEn: 'Light Management', techniqueSlug: 'light-management',
        effectType: 'redistribute', magnitude: 'strong',
        mechanism: '非対称な光照射により、フォトトロピン受容体が光を感知しPINタンパク質によるオーキシン極性輸送の方向が変化する。陰側にオーキシンが偏在し、陰側の細胞伸長が促進される（Cholodny-Went説）。',
        practicalNote: '定期的な鉢回し（1〜2週間に1回180度）で偏った成長を防止。',
        bestMonths: [3, 4, 5, 6, 7, 8, 9],
        sortOrder: 17,
      },
      {
        hormoneId: R(hMap, 'gibberellin'), techniqueName: '日照管理', techniqueNameEn: 'Light Management', techniqueSlug: 'light-management',
        effectType: 'decrease', magnitude: 'mild',
        mechanism: '十分な光照射下ではフィトクロム経路によりジベレリン合成遺伝子の発現が抑制される。日陰では逆にGA合成が促進され徒長する（避陰反応）。',
        practicalNote: '日照不足は徒長の原因。十分な日光確保がGA抑制と短節間の鍵。',
        bestMonths: [3, 4, 5, 6, 7, 8, 9],
        sortOrder: 18,
      },
      {
        hormoneId: R(hMap, 'florigen'), techniqueName: '日照管理', techniqueNameEn: 'Light Management', techniqueSlug: 'light-management',
        effectType: 'increase', magnitude: 'moderate',
        mechanism: '適切な日長条件（短日植物では短日、長日植物では長日）により葉のCONSTANS-FT経路が活性化され、FTタンパク質（フロリゲン）が合成される。',
        practicalNote: '花もの盆栽の花芽形成には夏以降の自然な短日化が重要。遮光処理で人為的に誘導も可能。',
        bestMonths: [7, 8, 9],
        sortOrder: 19,
      },
    ],
    skipDuplicates: true,
  })

  console.log('ホルモン技法マッピングデータ投入完了')

  console.log('植物ホルモンデータ投入完了')
}

// 直接実行用エントリポイント
if (
  process.argv[1] &&
  (process.argv[1].endsWith('seed-hormone-data.ts') ||
    process.argv[1].includes('seed-hormone-data'))
) {
  seedHormoneData()
    .then(() => {
      console.log('植物ホルモンシード完了')
      process.exit(0)
    })
    .catch((e) => {
      console.error('植物ホルモンシードエラー:', e)
      process.exit(1)
    })
}
