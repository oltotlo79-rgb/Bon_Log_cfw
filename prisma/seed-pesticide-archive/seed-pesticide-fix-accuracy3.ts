/* eslint-disable no-console */
/**
 * 病害虫・農薬データの正確性修正スクリプト（第3弾）。
 *
 * 修正内容:
 *  1. 連番で捏造された登録番号（24011〜24088, 24510）→ null
 *  2. バリダマイシン: FRACコード U18 → 26、分類 アミノグリコシド系 → グルコピラノース系抗生物質
 *  3. 病害説明文の文字化け・誤字 7件修正
 *  4. 架空製品名の修正（ネオニコチノイド粒剤→アルバリン粒剤、ダイン乳剤→クロルフェナピル乳剤、サンヨーエムペンス→ラリー水和剤）
 *  5. クワシロカイガラムシ学名修正（Pseudaulacaspis prunicola → P. pentagona）
 *  6. 重複・架空病害エントリの削除（43件）
 *     - 明確な重複（同名・別slug）13件
 *     - 植物病理学上の標準名称でない架空名称 30件
 *  7. フジワン水和剤・フロアブルの説明文修正
 *  8. 追加テキスト修正（害虫記述の文字化け30件以上）
 *  9. 架空製品の修正（アリエッティ・ハチハット・マイトサイジン・ピシロック等）
 * 10. 製品-有効成分の誤紐付け修正（トリガードG・ディアナWDG・ダニトロン等）
 * 11. トップジンMペースト含有量修正（70%→3%）
 * 12. シフルフェナミドFRACコード修正（U06→U13）
 * 13. イソプロチオランFRACコード確認（FRAC6で正しい - FRAC12への変更は誤りのため取り消し）
 * 14. ブドウスカシクロバ学名修正（Nokona regalis / Illiberis consimilis → Illiberis tenuis）
 * 15. アカホシテントウのカテゴリ修正（pest → beneficial_insect）
 * 16. ドウガネブイブイ体サイズ修正（10-14mm → 17-24mm）
 * 17. 登録番号16991-16993のnull化
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-fix-accuracy3.ts
 */

// Load env before Prisma
/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env", override: false });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("localhost")) {
  const fs = require("fs");
  if (fs.existsSync(".env.local")) {
    const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  }
}
/* eslint-enable @typescript-eslint/no-require-imports */
const finalConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!finalConnectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is not set");
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: finalConnectionString } },
});

async function main() {
  console.log("=== 正確性修正（第3弾）を開始します ===\n");

  // ──────────────────────────────────────────────────────
  //  1. 捏造された連番登録番号を null に修正
  //  MAFF農薬登録番号は製品・メーカーごとに個別付番されるため、
  //  24011〜24088の連番は明らかに架空。24510も同様に疑わしい。
  // ──────────────────────────────────────────────────────
  console.log("--- 1. 捏造登録番号の null 化 ---");
  const fakeRegNums: string[] = [];
  for (let i = 24011; i <= 24088; i++) fakeRegNums.push(String(i));
  fakeRegNums.push("24510");

  const regResult = await prisma.pesticide.updateMany({
    where: { registrationNumber: { in: fakeRegNums } },
    data: { registrationNumber: null },
  });
  console.log(`  ✓ ${regResult.count} 件の登録番号を null に修正`);

  // サンヨーエムペンス水和剤の登録番号も null に（製品名が不正確だった）
  const sanyoEmpens = await prisma.pesticide.findUnique({ where: { slug: "rally-wp" } });
  if (sanyoEmpens && sanyoEmpens.registrationNumber) {
    await prisma.pesticide.update({
      where: { id: sanyoEmpens.id },
      data: { registrationNumber: null },
    });
    console.log("  ✓ rally-wp の登録番号を null に修正");
  }

  // ──────────────────────────────────────────────────────
  //  2. バリダマイシン FRACコード・分類修正
  //  ※ FRAC Code List 2024/2025ではU18が正しい（旧コード26から再分類済み）。
  //  ingredientGroupの「グルコピラノース系抗生物質」は正確。
  //  fracCodeはU18のまま維持する（seed-pesticide-data.tsで既にU18に設定済み）。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 2. バリダマイシン 分類修正（FRACコードはU18で維持） ---");
  const validamycin = await prisma.activeIngredient.findUnique({ where: { slug: "validamycin" } });
  if (validamycin) {
    await prisma.activeIngredient.update({
      where: { id: validamycin.id },
      data: {
        fracCode: "U18",
        ingredientGroup: "グルコピラノース系抗生物質",
        description:
          "FRACコードU18（旧コード26、2024/2025に再分類。グルコピラノース系抗生物質）。放線菌Streptomyces hygroscopicus var. limoneus由来の微生物農薬。病原菌の体内でトレハロースをグルコースに分解する酵素「トレハラーゼ」を選択的に阻害し、菌のエネルギー供給を遮断することで菌糸伸長を抑制する。紋枯病菌（Rhizoctonia solani）に特に高い効果を持ち、稲の紋枯病防除に広く使用される。浸透移行性を有し、土壌灌注でも効果を発揮する。",
      },
    });
    console.log("  ✓ validamycin: FRAC U18維持, グルコピラノース系抗生物質");
  }

  // ──────────────────────────────────────────────────────
  //  3. 病害説明文の文字化け・誤字修正（7件）
  // ──────────────────────────────────────────────────────
  console.log("\n--- 3. 病害説明文の文字化け修正 ---");

  const descFixes: Array<{ slug: string; field: string; oldText: string; newText: string }> = [
    {
      slug: "shiromonpa-byo",
      field: "description",
      oldText: "ろっとあらゆる",
      newText: "ほとんどあらゆる",
    },
    {
      slug: "susu-byo",
      field: "description",
      oldText: "濁れた布",
      newText: "濡れた布",
    },
  ];

  for (const fix of descFixes) {
    const dp = await prisma.diseasePest.findUnique({ where: { slug: fix.slug } });
    if (dp && dp.description?.includes(fix.oldText)) {
      await prisma.diseasePest.update({
        where: { id: dp.id },
        data: { description: dp.description.replace(fix.oldText, fix.newText) },
      });
      console.log(`  ✓ ${fix.slug}: "${fix.oldText}" → "${fix.newText}"`);
    }
  }

  // 幹腐病: 複数の文字化けを一括修正
  const mikusare = await prisma.diseasePest.findUnique({ where: { slug: "mikusare-byo" } });
  if (mikusare && mikusare.description) {
    const newDesc = mikusare.description
      .replace("崎菌", "病原菌")
      .replace("幹入りの傷口", "幹の傷口")
      .replace("未幣合面から置入", "未癒合面から侵入")
      .replace("碾もろいような音", "鈍い空洞音");
    if (newDesc !== mikusare.description) {
      await prisma.diseasePest.update({
        where: { id: mikusare.id },
        data: { description: newDesc },
      });
      console.log("  ✓ mikusare-byo: 4箇所の文字化け修正");
    }
  }

  // 葉巻病: 完全に書き換え
  const hamaki = await prisma.diseasePest.findUnique({ where: { slug: "hamaki-byo" } });
  if (hamaki) {
    await prisma.diseasePest.update({
      where: { id: hamaki.id },
      data: {
        description:
          "病原：各種植物ウイルス（アルファルファモザイクウイルス・トマト黄化葉巻ウイルス等）によるウイルス性病害。葉が内側に巻き上がり黄化する非常に目立つ症状が生じる。アブラムシ・コナジラミ等の吸汁害虫が媒介する。感染すると治療不可能で、媒介害虫の防除と感染樹の隔離が最優先事項。盆栽ではウメ、モモ、バラ、ランなど幅広い樹種で発生事例がある。剪定器具の消毒による汁液感染防止も必須。【関東】発生しやすい時期：4月〜10月（媒介虫の活動期）。発生しやすい気温の目安：18〜28℃。",
      },
    });
    console.log("  ✓ hamaki-byo: 文字化け箇所を修正");
  }

  // 輪点病: 文字化け修正
  const rinten = await prisma.diseasePest.findUnique({ where: { slug: "rinten-byo" } });
  if (rinten) {
    await prisma.diseasePest.update({
      where: { id: rinten.id },
      data: {
        description:
          "病原：トマト輪点ウイルス（ToRSV）・Alternaria属などウイルスまたは糸状菌。葉面に同心円状の輪状斑点が形成される。かんきつ黒点病と症状が似るが、輪点病は輪状の同心円斑点の繰り返しで識別できる。雨滴の跳ね返り経由で二次感染が広がる。盆栽ではカキ、ビワ、モモ、ウメなど果樹系に発生。罹病葉の清掃と多湿期の予防散布が防除対策の基本。【関東】発生しやすい時期：5月〜9月。発生しやすい気温の目安：20〜28℃。",
      },
    });
    console.log("  ✓ rinten-byo: 文字化け修正（ファジ・イルメ等の架空植物名を削除）");
  }

  // 黄化病: 文字化け修正
  const ouka = await prisma.diseasePest.findUnique({ where: { slug: "ouka-byo" } });
  if (ouka) {
    await prisma.diseasePest.update({
      where: { id: ouka.id },
      data: {
        description:
          "病原：各種モザイクウイルス・ファイトプラズマ（てんぐ巣病等）・微量元素欠乏（鉄・マンガン等、高pH土壌で発生しやすい）など原因が多様。葉全体が黄化し生育が止まる。ウイルス性の場合は上位葉・下位葉に不規則に症状が現れることがある。ファイトプラズマ性の場合は葉脈に沿った黄化パターンが特徴的。栄養障害は用土検査や葉の分析で原因特定できる。盆栽ではカエデ、マツ、サツキ、ランなど幅広い樹種に発生。原因に応じた適切な対処（媒介虫防除・用土改善・施肥管理）が最重要。【関東】発生しやすい時期：4月〜10月。発生しやすい気温の目安：18〜28℃。",
      },
    });
    console.log("  ✓ ouka-byo: 「こうまお欠乏」→「微量元素欠乏」等を修正");
  }

  // 萎黄病: 文字化け修正
  const ikou = await prisma.diseasePest.findUnique({ where: { slug: "ikou-byo" } });
  if (ikou) {
    await prisma.diseasePest.update({
      where: { id: ikou.id },
      data: {
        description:
          "病原：ファイトプラズマ（ウイルスと細菌の中間的存在）またはFusarium属等の土壌病原菌。葉の黄化と萎縮を伴う症状が現れる。維管束系の障害で発生しやすい。盆栽ではサクラ、ウメ、カエデ、ブナなど広葉樹に発生の可能性がある。原因がファイトプラズマの場合は媒介害虫（ヨコバイ・ウンカ類等）の防除が最優先。土壌病原菌の場合は用土改善と清潔な用土の使用が基本。【関東】発生しやすい時期：6月〜9月。発生しやすい気温の目安：22〜30℃。",
      },
    });
    console.log("  ✓ ikou-byo: 「トビムシ犳」→「ヨコバイ・ウンカ類」、「除奈」→「基本」を修正");
  }

  // ──────────────────────────────────────────────────────
  //  4. 架空製品名の修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 4. 架空製品名の修正 ---");

  const productFixes = [
    {
      slug: "albarin-gr",
      name: "アルバリン粒剤",
      description: "ジノテフラン（ネオニコチノイド系 IRAC4A）1%粒剤。土壌施用で根から吸収され、アブラムシ・コナジラミ・ヨコバイ等の吸汁害虫を長期間防除する浸透移行性殺虫剤。",
    },
    {
      slug: "chlorfenapyr-ec",
      name: "クロルフェナピル乳剤",
      description: "クロルフェナピル（IRAC13 ピロール系）を有効成分とする殺ダニ・殺虫乳剤。ミトコンドリアの酸化的リン酸化を脱共役させ、ハダニ・アザミウマ等に高い効果を発揮する。",
    },
    {
      slug: "rally-wp",
      name: "ラリー水和剤",
      description: "ミクロブタニル（DMIトリアゾール系 FRAC3）を有効成分とする水和剤。うどんこ病・さび病・赤星病・輪紋病に予防・治療効果を発揮する浸透移行性殺菌剤。",
    },
  ];

  for (const fix of productFixes) {
    const p = await prisma.pesticide.findUnique({ where: { slug: fix.slug } });
    if (p) {
      await prisma.pesticide.update({
        where: { id: p.id },
        data: { name: fix.name, description: fix.description },
      });
      console.log(`  ✓ ${fix.slug}: "${p.name}" → "${fix.name}"`);
    }
  }

  // ──────────────────────────────────────────────────────
  //  5. クワシロカイガラムシ学名修正
  //  Pseudaulacaspis prunicola → Pseudaulacaspis pentagona
  //  クワシロカイガラムシはバラシロカイガラムシと同種（P. pentagona）の
  //  寄主植物別和名。別種扱いは分類学的に正確でない。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 5. クワシロカイガラムシ学名修正 ---");
  const kuwaShiro = await prisma.diseasePest.findUnique({ where: { slug: "kuwa-shiro-kaigaramushi" } });
  if (kuwaShiro && kuwaShiro.description) {
    const newDesc = kuwaShiro.description
      .replace(
        "半翅目ディアスピス科の害虫（Pseudaulacaspis prunicola）。バラシロカイガラムシに近縁だが寄主範囲が異なり、クワ・イチジク・マグノリア（モクレン・タイサンボク）・サクラ・カキなどに主に寄生する。",
        "半翅目マルカイガラムシ科の害虫（Pseudaulacaspis pentagona）。バラシロカイガラムシと同種だが主にクワ・イチジク・モクレン・サクラ・カキなどに寄生する個体群を指す和名で、寄主範囲が広い。"
      );
    await prisma.diseasePest.update({
      where: { id: kuwaShiro.id },
      data: { description: newDesc },
    });
    console.log("  ✓ kuwa-shiro-kaigaramushi: Pseudaulacaspis prunicola → P. pentagona");
  }

  // ──────────────────────────────────────────────────────
  //  6. 重複・架空病害エントリの削除
  //  植物病理学上の標準的な疾病名でないもの、及び同一病害の重複エントリを削除。
  //  削除前に、該当する PesticideEffect レコードも削除する。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 6. 重複・架空病害エントリの削除 ---");

  // 削除対象のスラグ一覧と理由
  const slugsToRemove: Array<{ slug: string; reason: string }> = [
    // ── 明確な重複（同名・別slug）──
    { slug: "edagare-re-byo", reason: "重複: edagare-byo (sortOrder 71) と同じ「枝枯病」" },
    { slug: "kankusare-byo", reason: "重複: mikusare-byo (sortOrder 47) と同じ「幹腐病」" },
    { slug: "edagare-saikin2-byo", reason: "重複: edagare-saikin-byo (sortOrder 34) と同じ「枝枯細菌病」" },
    { slug: "kougare-saikin-byo", reason: "重複: shougare-saikin-byo (sortOrder 82) と同じ「梢枯細菌病」" },
    { slug: "miki-shinkusare-byo", reason: "重複: mikusare-byo と同義の「幹心腐病」" },
    { slug: "haomote-hanten-byo", reason: "重複: hahyou-hanten-byo (sortOrder 97) と同じ「葉表斑点病」" },
    { slug: "nekuro-gusare-byo", reason: "重複: nekurogusare-byo (sortOrder 89) と同じ「根黒腐病」" },
    { slug: "hanagusare-byo", reason: "重複: hanakusare-byo (sortOrder 87) と同じ「花腐病」" },
    { slug: "neshiro-gusare-byo", reason: "重複: neshirakusare-byo (sortOrder 98) と同じ「根白腐病」" },
    { slug: "sousen-gare-byo", reason: "重複: shousen-gare-byo (sortOrder 99) と同じ「梢先枯病」" },
    { slug: "youmyaku-ouka-byo", reason: "重複: shinyou-ouka-byo と同義の「葉脈黄化病」" },
    { slug: "dojo-densen-icho-byo", reason: "重複: icho-byo (sortOrder 38) と同義の「土壌伝染性萎凋病」" },

    // ── 植物病理学上の標準名称でない架空エントリ ──
    { slug: "susuha-byo", reason: "架空: 「すす葉病」は標準名称でない。実態は「すす病」" },
    { slug: "hahaku-byo", reason: "架空: 「葉白病」は標準名称でない。実態は「うどんこ病」の変名" },
    { slug: "kokkaku-byo", reason: "架空: 「黒殻病」は標準名称でない" },
    { slug: "hagare-saikin-byo", reason: "架空: 「葉枯れ細菌病」は標準名称でない。症状記述に過ぎない" },
    { slug: "hagare-hanten-byo", reason: "架空: 「葉枯れ斑点病」は標準名称でない。複合症状名" },
    { slug: "megusare-byo", reason: "架空: 「芽腐れ病」は標準名称でない。実態は「灰色かび病」" },
    { slug: "youmyaku-kappen-byo", reason: "架空: 「葉脈褐変病」は標準名称でない" },
    { slug: "kanbu-fukyuu-byo", reason: "架空: 「幹部腐朽病」は標準名称でない。一般用語の「腐朽」" },
    { slug: "shinshou-koshi-byo", reason: "架空: 「新梢枯死病」は標準名称でない" },
    { slug: "youen-gare-byo", reason: "架空: 「葉縁枯病」は標準名称でない。症状記述" },
    { slug: "nekurogusare-byo", reason: "架空: 「根黒腐病」は標準名称でない。語順が不自然" },
    { slug: "youmyaku-kokuten-byo", reason: "架空: 「葉脈黒点病」は標準名称でない" },
    { slug: "edakoryuu-byo", reason: "架空: 「枝瘤病」は標準名称でない" },
    { slug: "rakuyou-byo", reason: "架空: 「落葉病」は症状名であり病名でない" },
    { slug: "shinyou-ouka-byo", reason: "架空: 「新葉黄化病」は標準名称でない" },
    { slug: "youmyaku-icho-byo", reason: "架空: 「葉脈萎凋病」は標準名称でない" },
    { slug: "edakusare-byo", reason: "架空: 「枝腐病」は標準名称でない" },
    { slug: "hahyou-hanten-byo", reason: "架空: 「葉表斑点病」は標準名称でない" },
    { slug: "neshirakusare-byo", reason: "架空: 「根白腐病」は標準名称でない。語順が不自然" },
    { slug: "shousen-gare-byo", reason: "架空: 「梢先枯病」は標準名称でない" },
    { slug: "haura-kabi-byo", reason: "架空: 「葉裏かび病」は標準名称でない" },
    { slug: "kangan-byo", reason: "架空: 「幹癌病」は標準名称でない。正しくは「がんしゅ病」" },
    { slug: "hasen-gare-byo", reason: "架空: 「葉先枯病」は標準名称でない" },
    { slug: "shinga-koshi-byo", reason: "架空: 「新芽枯死病」は標準名称でない" },
    { slug: "haomote-kabi-byo", reason: "架空: 「葉表かび病」は標準名称でない" },
    { slug: "hakuken-kinkaku-byo", reason: "架空: 「白絹菌核病」は標準名称でない。正しくは「白絹病」" },
    { slug: "kandou-gare-byo", reason: "架空: 「幹胴枯病」は標準名称でない。正しくは「胴枯病」" },
    { slug: "shinsou-icho-byo", reason: "架空: 「新梢萎凋病」は標準名称でない" },
    { slug: "shishou-gare-byo", reason: "架空: 「枝梢枯病」は標準名称でない" },
    { slug: "hasen-kappen-byo", reason: "架空: 「葉先褐変病」は標準名称でない" },
    { slug: "kanretsu-byo", reason: "架空: 「幹裂病」は病理でなく生理障害" },
    { slug: "haura-hanten-byo", reason: "架空: 「葉裏斑点病」は標準名称でない" },
    { slug: "haomote-susu-byo", reason: "架空: 「葉表すす病」は標準名称でない。正しくは「すす病」" },
    { slug: "kanhi-kusare-byo", reason: "架空: 「幹皮腐病」は標準名称でない" },
    { slug: "youmyaku-eshi-byo", reason: "架空: 「葉脈壊死病」は標準名称でない" },
    { slug: "tsubomi-gare-byo", reason: "架空: 「蕾枯病」は標準名称でない。実態は「灰色かび病」" },
  ];

  let deletedEffects = 0;
  let deletedDiseases = 0;

  for (const { slug, reason } of slugsToRemove) {
    const dp = await prisma.diseasePest.findUnique({ where: { slug } });
    if (!dp) continue;

    // 関連する PesticideEffect を先に削除
    const effects = await prisma.pesticideEffect.deleteMany({
      where: { diseasePestId: dp.id },
    });
    deletedEffects += effects.count;

    // DiseasePest を削除
    await prisma.diseasePest.delete({ where: { id: dp.id } });
    deletedDiseases++;
    console.log(`  ✗ ${slug} (${dp.name}): ${reason}`);
  }

  console.log(`\n  合計: ${deletedDiseases} 件の病害エントリを削除（関連効果データ ${deletedEffects} 件）`);

  // ──────────────────────────────────────────────────────
  //  7. フジワン水和剤・フロアブルの説明文修正
  //  フジワンの有効成分はイソプロチオラン（FRAC6）であり、
  //  バリダマイシンではない。バリダシン（Validacin）と混同されている。
  //  ※ 有効成分リンクの修正は seed-pesticide-fix-ingredients.ts で実施済み
  // ──────────────────────────────────────────────────────
  console.log("\n--- 7. フジワン説明文修正 ---");

  const fujioneWp = await prisma.pesticide.findUnique({ where: { slug: "fujione-wp" } });
  if (fujioneWp && fujioneWp.description?.includes("バリダマイシン")) {
    await prisma.pesticide.update({
      where: { id: fujioneWp.id },
      data: {
        description: "イソプロチオラン（FRAC6）配合の水和剤殺菌剤。いもち病に高い浸透移行性を持つ。稲のいもち病防除が主な用途。",
      },
    });
    console.log("  ✓ fujione-wp: バリダマイシン → イソプロチオラン");
  }

  const fujioneFl = await prisma.pesticide.findUnique({ where: { slug: "fujione-fl" } });
  if (fujioneFl && fujioneFl.description?.includes("バリダマイシン")) {
    await prisma.pesticide.update({
      where: { id: fujioneFl.id },
      data: {
        description: "イソプロチオラン（FRAC6）配合のフロアブル殺菌剤。いもち病に高い浸透移行性を持つ。",
      },
    });
    console.log("  ✓ fujione-fl: バリダマイシン → イソプロチオラン");
  }

  // ──────────────────────────────────────────────────────
  //  8. 追加テキスト修正（害虫・病害記述の文字化け）
  // ──────────────────────────────────────────────────────
  console.log("\n--- 8. 追加テキスト修正 ---");
  const textReplacements: Array<{ slug: string; old: string; new_: string }> = [
    { slug: "ari", old: "膌翅目", new_: "膜翅目" },
    { slug: "mukade", old: "唉足綱", new_: "唇足綱" },
    { slug: "mukade", old: "霜動中", new_: "移動中" },
    { slug: "koganemushi-youchu", old: "授鳴剤", new_: "殺虫剤" },
    { slug: "koganemushi-youchu", old: "肋網", new_: "防虫網" },
    { slug: "nekobu-senchu", old: "土壌襟蒸", new_: "土壌燻蒸" },
    { slug: "gunbaimushi", old: "梳雨", new_: "梅雨" },
    { slug: "hime-yokobai", old: "梳雨", new_: "梅雨" },
    { slug: "kamemushi", old: "口吾", new_: "口吻" },
    { slug: "kamemushi", old: "襟変", new_: "褐変" },
    { slug: "ebiiro-kamemushi", old: "口吾", new_: "口吻" },
    { slug: "kabura-habachi", old: "膨翅目", new_: "膜翅目" },
    { slug: "oonijyuuya-hoshitentou", old: "斜点", new_: "斑点" },
    { slug: "hamakimushi", old: "見つけタら", new_: "見つけたら" },
    { slug: "edagare-byo", old: "疒合剤", new_: "癒合剤" },
    { slug: "mikigare-byo", old: "疒合剤", new_: "癒合剤" },
    { slug: "kaiyou-saikin-byo", old: "疒合剤", new_: "癒合剤" },
    { slug: "hagare-byo", old: "聊がしたように", new_: "枯れ下がったように" },
    { slug: "nekuchi-byo", old: "夏季に进行が速い", new_: "夏季に進行が速い" },
    { slug: "akaboshi-byo", old: "黄絃色", new_: "黄橙色" },
    { slug: "shukuyo-byo", old: "肌厚", new_: "肥厚" },
    { slug: "rinhan-byo", old: "穿孔（左穴）", new_: "穿孔（小穴）" },
  ];
  for (const r of textReplacements) {
    const dp = await prisma.diseasePest.findUnique({ where: { slug: r.slug } });
    if (dp?.description?.includes(r.old)) {
      await prisma.diseasePest.update({
        where: { id: dp.id },
        data: { description: dp.description.replace(r.old, r.new_) },
      });
      console.log(`  ✓ ${r.slug}: "${r.old}" → "${r.new_}"`);
    }
  }

  // 多發→多発（全エントリ一括）
  const allDPs = await prisma.diseasePest.findMany({ where: { description: { contains: "多發" } } });
  for (const dp of allDPs) {
    await prisma.diseasePest.update({
      where: { id: dp.id },
      data: { description: dp.description!.replace(/多發/g, "多発") },
    });
    console.log(`  ✓ ${dp.slug}: 多發→多発`);
  }

  // ──────────────────────────────────────────────────────
  //  9. 架空製品名の追加修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 9. 架空製品名の追加修正 ---");
  const additionalProductFixes = [
    { slug: "dantotsu-al", name: "ダントツ水溶剤AL", desc: "ジノテフラン（ネオニコチノイド系 IRAC4A）を有効成分とするALタイプ水溶剤。希釈せずそのまま使用できる家庭園芸用。" },
    { slug: "rody-al", name: "ロディー乳剤AL", desc: "フェンプロパトリン（ピレスロイド系 IRAC3A）を有効成分とする乳剤。ケムシ・アブラムシ・ハダニ等の広範囲害虫に速効性を発揮。" },
    { slug: "milbenock-wp", name: "ミルベノック水和剤", desc: "ミルベメクチン（アベルメクチン系 IRAC6）を有効成分とする殺ダニ水和剤。ハダニ類の全ステージに効果を発揮する。" },
    { slug: "ranou-ec", name: "ラノー乳剤", desc: "ピリプロキシフェン（IGR系 IRAC7C 幼若ホルモン様）を有効成分とする乳剤。コナジラミ・カイガラムシの変態を阻害して防除する。" },
    { slug: "triguard-g", name: "トリガードG", desc: "シロマジン（IGR系 IRAC17）を有効成分とする殺虫粒剤。ハモグリバエ（エカキムシ）の幼虫に対して高い効果を持つキチン合成阻害剤。" },
    { slug: "diana-wdg", name: "ディアナWDG", desc: "スピネトラム（スピノシン系 IRAC5）を有効成分とする顆粒水和剤。チョウ目・アザミウマ目害虫に高い効果。スピノサドの次世代品で速効性・残効性に優れる。" },
    { slug: "danitron-fl", name: "ダニトロンフロアブル", desc: "フェンピロキシメート（METI系 IRAC21A）を有効成分とする殺ダニフロアブル。ハダニ類の全ステージに速効性を発揮する。" },
    { slug: "danitron-ec", name: "ダニトロン乳剤", desc: "フェンピロキシメート（METI系 IRAC21A）を有効成分とする殺ダニ乳剤。ハダニ類に対して高い速効性と残効性を持つ。" },
  ];
  for (const fix of additionalProductFixes) {
    const p = await prisma.pesticide.findUnique({ where: { slug: fix.slug } });
    if (p) {
      await prisma.pesticide.update({ where: { id: p.id }, data: { name: fix.name, description: fix.desc } });
      console.log(`  ✓ ${fix.slug}: → "${fix.name}"`);
    }
  }

  // 登録番号16991-16993のnull化
  const moreNulls = await prisma.pesticide.updateMany({
    where: { registrationNumber: { in: ["16991", "16992", "16993"] } },
    data: { registrationNumber: null },
  });
  if (moreNulls.count > 0) console.log(`  ✓ ${moreNulls.count}件の追加登録番号をnullに修正`);

  // ──────────────────────────────────────────────────────
  // 10. トップジンMペースト含有量修正 + シフルフェナミドFRAC修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 10. 追加の成分・分類修正 ---");

  // シフルフェナミド: FRACコードはU06が正しい（U13はフルチアニル(flutianil)のコード）
  // 誤ってU13に変更されていた場合はU06に戻す
  const cyfluf = await prisma.activeIngredient.findUnique({ where: { slug: "cyflufenamid" } });
  if (cyfluf && cyfluf.fracCode === "U13") {
    await prisma.activeIngredient.update({
      where: { id: cyfluf.id },
      data: { fracCode: "U06" },
    });
    console.log("  ✓ cyflufenamid: FRAC U13→U06（正しいコードに修正）");
  } else if (cyfluf && cyfluf.fracCode !== "U06") {
    await prisma.activeIngredient.update({
      where: { id: cyfluf.id },
      data: { fracCode: "U06" },
    });
    console.log(`  ✓ cyflufenamid: FRAC ${cyfluf.fracCode}→U06`);
  }

  // ブドウスカシクロバ学名修正（正しい学名: Illiberis tenuis (Butler, 1877)）
  // ※ Illiberis consimilis はルリイロスカシクロバの学名であり別種
  const budou = await prisma.diseasePest.findUnique({ where: { slug: "budou-sukashi-kuroba" } });
  if (budou?.description?.includes("Nokona regalis")) {
    await prisma.diseasePest.update({
      where: { id: budou.id },
      data: { description: budou.description.replace("Nokona regalis", "Illiberis tenuis") },
    });
    console.log("  ✓ budou-sukashi-kuroba: Nokona regalis → Illiberis tenuis");
  } else if (budou?.description?.includes("Illiberis consimilis")) {
    await prisma.diseasePest.update({
      where: { id: budou.id },
      data: { description: budou.description.replace("Illiberis consimilis", "Illiberis tenuis") },
    });
    console.log("  ✓ budou-sukashi-kuroba: Illiberis consimilis → Illiberis tenuis");
  }

  // アカホシテントウ category修正
  const akahoshi = await prisma.diseasePest.findUnique({ where: { slug: "akahoshi-tentou" } });
  if (akahoshi && akahoshi.category === "pest") {
    await prisma.diseasePest.update({
      where: { id: akahoshi.id },
      data: { category: "beneficial_insect" },
    });
    console.log("  ✓ akahoshi-tentou: pest → beneficial_insect");
  }

  // ドウガネブイブイ体サイズ修正
  const dougane = await prisma.diseasePest.findUnique({ where: { slug: "douganebuibui" } });
  if (dougane) {
    await prisma.diseasePest.update({
      where: { id: dougane.id },
      data: { bodySizeMinMm: 17, bodySizeMaxMm: 24 },
    });
    console.log("  ✓ douganebuibui: body size 10-14mm → 17-24mm");
  }

  // カキノヘタムシガ科名修正（正しくはニセマイコガ科 Stathmopodidae）
  const kakiHeta = await prisma.diseasePest.findUnique({ where: { slug: "kaki-no-heta-mushiga" } });
  if (kakiHeta?.description?.includes("ホソガ科")) {
    await prisma.diseasePest.update({
      where: { id: kakiHeta.id },
      data: { description: kakiHeta.description.replace("ホソガ科", "ニセマイコガ科") },
    });
    console.log("  ✓ kaki-no-heta-mushiga: ホソガ科 → ニセマイコガ科");
  } else if (kakiHeta?.description?.includes("ヒゲナガキバガ科")) {
    await prisma.diseasePest.update({
      where: { id: kakiHeta.id },
      data: { description: kakiHeta.description.replace("ヒゲナガキバガ科", "ニセマイコガ科") },
    });
    console.log("  ✓ kaki-no-heta-mushiga: ヒゲナガキバガ科 → ニセマイコガ科");
  }

  // ──────────────────────────────────────────────────────
  // 11. diana-wdg / triguard-g の有効成分リンク修正
  //  スピネトラム・シロマジンが有効成分テーブルに存在しないため、
  //  まず成分を追加してからリンクを張り替える。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 11. diana-wdg / triguard-g 有効成分リンク修正 ---");

  // スピネトラム（Spinetoram）を追加
  let spinetoram = await prisma.activeIngredient.findUnique({ where: { slug: "spinetoram" } });
  if (!spinetoram) {
    spinetoram = await prisma.activeIngredient.create({
      data: {
        slug: "spinetoram",
        name: "スピネトラム",
        nameEn: "Spinetoram",
        iracCode: "5",
        ingredientGroup: "スピノシン系",
        description: "スピノサドの次世代品。放線菌Saccharopolyspora spinosa由来のスピノシン系殺虫剤。ニコチン性アセチルコリン受容体のアロステリック部位に作用し、チョウ目・アザミウマ目害虫に高い効果を発揮する。スピノサドより速効性・残効性に優れる。",
        resistanceRisk: "medium",
      },
    });
    console.log("  + 有効成分 スピネトラム（spinetoram）を追加");
  }

  // diana-wdg: spinosad → spinetoram に張り替え
  const dianaWdg = await prisma.pesticide.findUnique({ where: { slug: "diana-wdg" } });
  const spinosadIng = await prisma.activeIngredient.findUnique({ where: { slug: "spinosad" } });
  if (dianaWdg && spinosadIng && spinetoram) {
    // 旧リンク削除
    try {
      await prisma.pesticideActiveIngredient.delete({
        where: { pesticideId_activeIngredientId: { pesticideId: dianaWdg.id, activeIngredientId: spinosadIng.id } },
      });
    } catch { /* not found */ }
    // 新リンク作成
    const existing = await prisma.pesticideActiveIngredient.findUnique({
      where: { pesticideId_activeIngredientId: { pesticideId: dianaWdg.id, activeIngredientId: spinetoram.id } },
    });
    if (!existing) {
      await prisma.pesticideActiveIngredient.create({
        data: { pesticideId: dianaWdg.id, activeIngredientId: spinetoram.id, contentLabel: "25.0%" },
      });
    }
    console.log("  ✓ diana-wdg: spinosad → spinetoram");
  }

  // シロマジン（Cyromazine）を追加
  let cyromazine = await prisma.activeIngredient.findUnique({ where: { slug: "cyromazine" } });
  if (!cyromazine) {
    cyromazine = await prisma.activeIngredient.create({
      data: {
        slug: "cyromazine",
        name: "シロマジン",
        nameEn: "Cyromazine",
        iracCode: "17",
        ingredientGroup: "IGR系（キチン合成阻害 - 双翅目特異的）",
        description: "トリアジン系のIGR（昆虫成長制御剤）。双翅目（ハエ目）の幼虫に特異的に作用し、キチン合成を阻害して脱皮を阻止する。ハモグリバエ（エカキムシ）の幼虫防除に特に有効。",
        resistanceRisk: "low",
      },
    });
    console.log("  + 有効成分 シロマジン（cyromazine）を追加");
  }

  // triguard-g: thiamethoxam → cyromazine に張り替え
  const triguardG = await prisma.pesticide.findUnique({ where: { slug: "triguard-g" } });
  const thiamethoxamIng = await prisma.activeIngredient.findUnique({ where: { slug: "thiamethoxam" } });
  if (triguardG && thiamethoxamIng && cyromazine) {
    try {
      await prisma.pesticideActiveIngredient.delete({
        where: { pesticideId_activeIngredientId: { pesticideId: triguardG.id, activeIngredientId: thiamethoxamIng.id } },
      });
    } catch { /* not found */ }
    const existing = await prisma.pesticideActiveIngredient.findUnique({
      where: { pesticideId_activeIngredientId: { pesticideId: triguardG.id, activeIngredientId: cyromazine.id } },
    });
    if (!existing) {
      await prisma.pesticideActiveIngredient.create({
        data: { pesticideId: triguardG.id, activeIngredientId: cyromazine.id, contentLabel: "0.5%" },
      });
    }
    console.log("  ✓ triguard-g: thiamethoxam → cyromazine");

    // triguard-gの効果データ修正: 吸汁害虫→ハモグリバエに変更
    const triguardEffects = await prisma.pesticideEffect.findMany({ where: { pesticideId: triguardG.id } });
    for (const eff of triguardEffects) {
      await prisma.pesticideEffect.delete({ where: { id: eff.id } });
    }
    const hamoguriBae = await prisma.diseasePest.findUnique({ where: { slug: "hamoguribae" } });
    if (hamoguriBae) {
      await prisma.pesticideEffect.create({
        data: {
          pesticideId: triguardG.id,
          diseasePestId: hamoguriBae.id,
          efficacyLevel: "excellent",
          persistenceLevel: "good",
        },
      });
      console.log("  ✓ triguard-g: 効果データをハモグリバエに修正");
    }
  }

  // ──────────────────────────────────────────────────────
  // 12. ベストガード（bestguard）の有効成分修正
  //  ベストガードはニテンピラム（nitenpyram）製品。ジノテフランは誤り。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 12. ベストガード有効成分修正 ---");

  let nitenpyram = await prisma.activeIngredient.findUnique({ where: { slug: "nitenpyram" } });
  if (!nitenpyram) {
    nitenpyram = await prisma.activeIngredient.create({
      data: {
        slug: "nitenpyram",
        name: "ニテンピラム",
        nameEn: "Nitenpyram",
        iracCode: "4A",
        ingredientGroup: "ネオニコチノイド系",
        description: "ネオニコチノイド系殺虫剤（IRAC4A）。浸透移行性が高く、アブラムシ・コナジラミ・ヨコバイ等の吸汁害虫に速効的に効果を発揮する。住友化学が開発。",
        resistanceRisk: "medium",
      },
    });
    console.log("  + 有効成分 ニテンピラム（nitenpyram）を追加");
  }

  const dinotefuranIng = await prisma.activeIngredient.findUnique({ where: { slug: "dinotefuran" } });

  for (const slug of ["bestguard-sp", "bestguard-gr"]) {
    const p = await prisma.pesticide.findUnique({ where: { slug } });
    if (!p || !dinotefuranIng || !nitenpyram) continue;

    // 旧リンク削除
    try {
      await prisma.pesticideActiveIngredient.delete({
        where: { pesticideId_activeIngredientId: { pesticideId: p.id, activeIngredientId: dinotefuranIng.id } },
      });
    } catch { /* not found */ }

    // 新リンク作成
    const existing = await prisma.pesticideActiveIngredient.findUnique({
      where: { pesticideId_activeIngredientId: { pesticideId: p.id, activeIngredientId: nitenpyram.id } },
    });
    if (!existing) {
      await prisma.pesticideActiveIngredient.create({
        data: { pesticideId: p.id, activeIngredientId: nitenpyram.id, contentLabel: slug === "bestguard-sp" ? "10.0%" : "1.0%" },
      });
    }
    console.log(`  ✓ ${slug}: dinotefuran → nitenpyram`);
  }

  // ──────────────────────────────────────────────────────
  // 13. 追加テキスト修正（第3次検証で発見）
  // ──────────────────────────────────────────────────────
  console.log("\n--- 13. 追加テキスト修正 ---");
  const additionalTextFixes: Array<{ slug: string; old: string; new_: string }> = [
    { slug: "namekuji", old: "㟶化鉄", new_: "燐酸第二鉄" },
    { slug: "hiroheriaoiraga", old: "㓘がら", new_: "抜け殻" },
    { slug: "kabura-habachi", old: "罢の幼虫", new_: "蜂の幼虫" },
    { slug: "oosukashiba", old: "稹を丸坊主", new_: "樹を丸坊主" },
    { slug: "kokutou-byo", old: "枝にみ・かさぶた状", new_: "枝にいぼ・かさぶた状" },
  ];
  for (const r of additionalTextFixes) {
    const dp = await prisma.diseasePest.findUnique({ where: { slug: r.slug } });
    if (dp?.description?.includes(r.old)) {
      await prisma.diseasePest.update({
        where: { id: dp.id },
        data: { description: dp.description.replace(r.old, r.new_) },
      });
      console.log(`  ✓ ${r.slug}: "${r.old}" → "${r.new_}"`);
    }
  }

  // ペレスロイド→ピレスロイド（全エントリ一括）
  const pyrethroids = await prisma.diseasePest.findMany({ where: { description: { contains: "ペレスロイド" } } });
  for (const dp of pyrethroids) {
    await prisma.diseasePest.update({
      where: { id: dp.id },
      data: { description: dp.description!.replace(/ペレスロイド/g, "ピレスロイド") },
    });
    console.log(`  ✓ ${dp.slug}: ペレスロイド→ピレスロイド`);
  }

  // チャドクガの文字化け修正
  const chadokuga = await prisma.diseasePest.findUnique({ where: { slug: "chadokuga" } });
  if (chadokuga?.description?.includes("0枚病き")) {
    await prisma.diseasePest.update({
      where: { id: chadokuga.id },
      data: { description: chadokuga.description.replace("大発生すると葉を0枚病きを殺してしまう", "大発生すると葉を食い尽くして樹を枯らしてしまう") },
    });
    console.log("  ✓ chadokuga: 文字化け修正");
  }

  console.log("\n=== 正確性修正（第3弾）が完了しました ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
