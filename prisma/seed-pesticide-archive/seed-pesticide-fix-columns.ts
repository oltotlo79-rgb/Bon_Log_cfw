/* eslint-disable no-console */
/**
 * コラム記事の事実誤りを修正するスクリプト。
 *
 * 修正内容:
 * 1. mixing-order: タンクミックスの調製順序を正しい順序に修正
 * 2. bonsai-pest-calendar: 石灰硫黄合剤の希釈倍率、ハダニ世代交代日数、モスピラン希釈倍率を修正
 * 3. resistance-rotation: コロマイト乳剤の有効成分をミルベメクチンに修正
 * 4. spray-timing: フロアブルの用語修正（乳化→懸濁）
 * 5. frac-irac-practical-guide: オルトランのIRACコード修正、ジーファイン表記修正
 * 6. pesticide-safety: 中毒110番の電話番号修正
 * 7. label-reading-guide: 毒性区分・魚毒性分類を日本の制度に合わせて修正
 * 8. lime-sulfur-guide: 常緑樹の希釈倍率修正、50倍液の例を削除
 * 9. formulation-selection: フロアブル用語・乳剤耐雨性の修正
 * 10. beneficial-insect-protection: テントウムシ捕食数・ミルベノック注記修正
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-fix-columns.ts
 */

// Load env before Pool
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
  datasources: {
    db: { url: finalConnectionString },
  },
});

async function replaceInColumn(slug: string, oldText: string, newText: string): Promise<boolean> {
  const column = await prisma.pesticideColumn.findUnique({ where: { slug } });
  if (!column) {
    console.warn(`  ⚠ コラム ${slug} が見つかりません`);
    return false;
  }
  if (!column.content.includes(oldText)) {
    console.warn(`  ⚠ コラム ${slug} に対象テキストが見つかりません: "${oldText.substring(0, 50)}..."`);
    return false;
  }
  const newContent = column.content.replace(oldText, newText);
  await prisma.pesticideColumn.update({
    where: { slug },
    data: { content: newContent },
  });
  console.log(`  ✓ ${slug}: テキスト修正完了`);
  return true;
}

async function main() {
  console.log("=== コラム記事の事実誤り修正を開始します ===\n");

  // ──────────────────────────────────────────────────────
  //  1. mixing-order: タンクミックスの調製順序修正
  //  正しい順序: 展着剤→液剤(水溶剤)→乳剤→フロアブル→水和剤
  //  語呂合わせ「テニス」: テ(展着剤)→ニ(乳剤)→ス(水和剤)
  //  ※ 実際には展着剤が先で水に溶けにくいもの(水和剤)が後
  // ──────────────────────────────────────────────────────
  console.log("--- 1. mixing-order: 調製順序の修正 ---");
  await replaceInColumn("mixing-order",
    "「水に溶けにくいものから先に加える」が鉄則です。\n\n① タンクに規定量の水の半量を入れる\n② 水和剤（WP）・顆粒水和剤（WG）を加えてよく撹拌する\n   ※ 粉末が水面に浮かないよう、水を回しながらゆっくり加える\n③ 残りの水を加えてさらに撹拌する\n④ フロアブル（FL・SC）を加えて撹拌する\n⑤ 乳剤（EC）を加えて撹拌する\n⑥ 水溶剤（SP）を加えて撹拌する\n⑦ 展着剤を最後に静かに加える",
    "「テニス」（展・乳・水）の語呂合わせで覚えるのが日本の農薬業界の定番です。展着剤を最初に入れ、水に溶けやすいものから順に加えていきます。\n\n① タンクに規定量の水の半量を入れる\n② 展着剤を最初に加えて軽く撹拌する\n   ※ 展着剤を先に入れることで、後から加える農薬の分散が良くなる\n③ 水溶剤（SP）を加えて撹拌する\n④ 乳剤（EC）を加えて撹拌する\n⑤ フロアブル（FL・SC）を加えて撹拌する\n⑥ 残りの水を加えてさらに撹拌する\n⑦ 水和剤（WP）・顆粒水和剤（WG）を最後に加えてよく撹拌する\n   ※ 粉末が水面に浮かないよう、水を回しながらゆっくり加える",
  );

  // ──────────────────────────────────────────────────────
  //  2. bonsai-pest-calendar: 複数の誤り修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 2. bonsai-pest-calendar: 石灰硫黄合剤希釈倍率の修正 ---");

  // 2a. 石灰硫黄合剤の希釈倍率修正
  await replaceInColumn("bonsai-pest-calendar",
    "・石灰硫黄合剤の散布（落葉樹：7〜10倍、常緑樹：20〜40倍）",
    "・石灰硫黄合剤の散布（落葉樹：7〜10倍、常緑樹：20〜40倍）",
  );

  // 2b. ハダニの世代交代日数修正
  console.log("--- 2b. bonsai-pest-calendar: ハダニ世代交代日数の修正 ---");
  await replaceInColumn("bonsai-pest-calendar",
    "最も増殖が速い時期（3〜5日で世代交代）",
    "最も増殖が速い時期（約10〜14日で世代交代、30℃なら約12日）",
  );

  // 2c. モスピラン液剤の希釈倍率修正
  console.log("--- 2c. bonsai-pest-calendar: モスピラン液剤希釈倍率の修正 ---");
  await replaceInColumn("bonsai-pest-calendar",
    "モスピラン液剤（2,000倍）",
    "モスピラン液剤（500倍）",
  );

  // 2d. スミチオン300倍塗布を適用外である注記追加
  console.log("--- 2d. bonsai-pest-calendar: スミチオン幹塗布の注記修正 ---");
  await replaceInColumn("bonsai-pest-calendar",
    "幹にスミチオン乳剤（300倍）を塗り付けて産卵・孵化を防ぐ予防法も有効",
    "幹にスミチオン乳剤（1,000倍）を散布して成虫の飛来を抑える予防法も有効（穿入孔発見時はスプレー式殺虫剤を噴霧）",
  );

  // ──────────────────────────────────────────────────────
  //  3. resistance-rotation: コロマイト乳剤の有効成分修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 3. resistance-rotation: コロマイト有効成分の修正 ---");
  // メインデータで既に修正済み（マイトコーネフロアブル IRAC20D ビフェナゼート）
  // 旧テキストが残っている場合のみ修正
  await replaceInColumn("resistance-rotation",
    "・3回目（2週間後）：コロマイト乳剤（IRACコード 6 ビフェナゼート）\n→ 同じ系統（コード6）が続いていますが、ビフェナゼートは交差耐性が少ない。理想は3系統をフルローテーション",
    "・3回目（2週間後）：マイトコーネフロアブル（IRACコード 20D ビフェナゼート）\n→ コード6とは異なる作用機序のため、ローテーション相手になる。理想は3系統をフルローテーション",
  );

  // ──────────────────────────────────────────────────────
  //  4. spray-timing: フロアブルの用語修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 4. spray-timing: フロアブル用語の修正 ---");
  await replaceInColumn("spray-timing",
    "・フロアブルも乳化が不安定になりやすい",
    "・フロアブルも懸濁（けんだく）が不安定になりやすい",
  );

  // ──────────────────────────────────────────────────────
  //  5. frac-irac-practical-guide: オルトランIRACコード修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 5. frac-irac-practical-guide: オルトランIRACコード修正 ---");
  await replaceInColumn("frac-irac-practical-guide",
    "【コード1A/1B（AChE阻害系：速効性・耐性リスク中）】\n1A：カルバメート系（オルトラン等）\n1B：有機リン系（スミチオン、マラソン等）",
    "【コード1A/1B（AChE阻害系：速効性・耐性リスク中）】\n1A：カルバメート系（ランネート等）\n1B：有機リン系（スミチオン、マラソン、オルトラン等）",
  );

  // 5b. ジーファインの記載修正
  console.log("--- 5b. frac-irac-practical-guide: ジーファイン記載修正 ---");
  await replaceInColumn("frac-irac-practical-guide",
    "M01：銅剤（ジーファイン水和剤等）",
    "M01：銅剤（Zボルドー、サンケイ銅水和剤等）",
  );

  // ──────────────────────────────────────────────────────
  //  6. pesticide-safety: 中毒110番の電話番号修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 6. pesticide-safety: 中毒110番 電話番号修正 ---");
  await replaceInColumn("pesticide-safety",
    "→ 中毒110番（公益財団法人日本中毒情報センター）：0990-950-2499（有料）/ 029-852-9999（茨城・24時間）",
    "→ 中毒110番（公益財団法人日本中毒情報センター）：072-727-2499（大阪）/ 029-852-9999（つくば）\n   ※ 受付時間・料金等の最新情報は日本中毒情報センター公式サイト（https://www.j-poison-ic.jp/）で確認してください",
  );

  // ──────────────────────────────────────────────────────
  //  7. label-reading-guide: 毒性区分・魚毒性分類の修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 7. label-reading-guide: 毒性区分の修正 ---");
  await replaceInColumn("label-reading-guide",
    "【毒性区分】\nラベルに「普通物」「危険物」等の記載があります。また農薬毒性区分（Ⅰ〜Ⅳ）が設定されています。\n・Ⅰ類（危険・有毒）：一般家庭での使用は難しく、専門知識が必要\n・Ⅱ類（危険・有毒）：取り扱いに特に注意が必要\n・Ⅲ〜Ⅳ類（普通物）：一般的な農薬の大半がこの区分",
    "【毒性区分】\nラベルに毒性区分が記載されています。日本の農薬は「毒物及び劇物取締法」に基づき以下のように分類されます。\n・特定毒物：極めて毒性が高い。一般使用は原則不可\n・毒物：毒性が高い。「医薬用外毒物」の赤地白文字表示が必須\n・劇物：毒性が中程度。「医薬用外劇物」の白地赤文字表示が必須\n・普通物：上記に該当しないもの。一般的な家庭園芸用農薬の大半がこの区分\n\n家庭園芸で使用する場合は「普通物」に分類される製品を選ぶのが安全です",
  );

  console.log("--- 7b. label-reading-guide: 魚毒性分類の修正 ---");
  await replaceInColumn("label-reading-guide",
    "【魚毒性・水生生物への影響】\n「魚毒性A・B・C・D」などの記載があります。Aが最も毒性が高い。\n・水路・池・川の近くでの使用、散布後の水路への流入に注意が必要\n・観賞魚（金魚・錦鯉）を育てている場合は魚毒性の確認が重要",
    "【水生生物への影響】\n従来の魚毒性分類（A類・B類・C類の3段階、A類が最も毒性が高い）は2012年に廃止され、現在はGHS（化学品の分類および表示に関する世界調和システム）に基づく環境影響評価に移行しています。農薬ラベルには水生生物への影響に関する注意事項が記載されています。\n・水路・池・川の近くでの使用、散布後の水路への流入に注意が必要\n・観賞魚（金魚・錦鯉）を育てている場合は水生生物への影響の確認が特に重要\n・ピレスロイド系殺虫剤は特に魚類への毒性が高いため、水系への流出に厳重注意",
  );

  // ──────────────────────────────────────────────────────
  //  8. lime-sulfur-guide: 常緑樹の希釈倍率修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 8. lime-sulfur-guide: 希釈倍率の修正 ---");
  await replaceInColumn("lime-sulfur-guide",
    "・常緑樹（松柏類など）：10〜20倍\n  ※ 常に葉があるため薬害リスクが高い。薄めに使用",
    "・常緑樹（松柏類など）：20〜40倍\n  ※ 常に葉があるため薬害リスクが高い。十分に薄めて使用",
  );

  // 8b. 50倍液の例を7倍液の例に修正（実用的な希釈例に）
  console.log("--- 8b. lime-sulfur-guide: 希釈例の修正 ---");
  await replaceInColumn("lime-sulfur-guide",
    "③ 希釈の手順\n   → 水を先に入れ、原液を少量ずつ加える（逆に入れると急激に発熱・飛沫が生じる）\n   → 50倍液の調製例：水2.4L + 原液50mL（2.5L散布液の場合）",
    "③ 希釈の手順\n   → 水を先に入れ、原液を少量ずつ加える（逆に入れると急激に発熱・飛沫が生じる）\n   → 10倍液の調製例：水2.7L + 原液300mL（3L散布液の場合）",
  );

  // ──────────────────────────────────────────────────────
  //  9. formulation-selection: フロアブル用語修正・乳剤耐雨性修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 9. formulation-selection: フロアブル用語修正 ---");
  await replaceInColumn("formulation-selection",
    "→ フロアブル（FL）も比較的安全だが、散布後すぐ乾燥するよう早朝に行う。",
    "→ フロアブル（FL）も比較的安全だが、散布後すぐ乾燥するよう早朝に行う。\n→ フロアブルは懸濁液（けんだくえき）であり乳剤とは異なる製剤タイプ。高温で分散性が低下する場合があるため、使用前によく振って均一にする。",
  );

  await replaceInColumn("formulation-selection",
    "→ 乳剤は雨で流亡しやすく、梅雨時期の使用は効率が悪い。",
    "→ 乳剤は有機溶媒を含むため高温時の薬害リスクが高く、梅雨時期は薬害と降雨の両リスクが重なるため使いにくい。\n→ なお、乳剤の油分は付着性を高める場合もあるため、耐雨性自体は製品によって異なる。",
  );

  // ──────────────────────────────────────────────────────
  //  10. beneficial-insect-protection: テントウムシ捕食数・ミルベノック注記
  // ──────────────────────────────────────────────────────
  console.log("\n--- 10. beneficial-insect-protection: テントウムシ捕食数修正 ---");
  await replaceInColumn("beneficial-insect-protection",
    "テントウムシ1頭は1日に100頭以上のアブラムシを捕食",
    "テントウムシの成虫1頭は1日に50〜100頭程度のアブラムシを捕食",
  );

  console.log("--- 10b. beneficial-insect-protection: ミルベノック注記追加 ---");
  await replaceInColumn("beneficial-insect-protection",
    "→ ハダニ防除において、カブリダニへの影響が比較的少ない系統として注目\n  → ただし高濃度散布や長時間の接触は天敵にも影響する",
    "→ ハダニ防除において、一部の研究でカブリダニへの影響が比較的少ないとされる\n  → ただし高濃度散布や長時間の接触は天敵にも影響する。カブリダニの種類によっては強い影響を受ける報告もあるため、使用条件に注意が必要",
  );

  // ──────────────────────────────────────────────────────
  //  11. spray-timing: 石灰硫黄合剤の温度条件修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 11. spray-timing: 石灰硫黄合剤温度条件の修正 ---");
  await replaceInColumn("spray-timing",
    "・石灰硫黄合剤は10℃以上で散布。低温でも殺卵効果はある",
    "・石灰硫黄合剤は風が穏やかで晴れた日に散布。気温は5℃以上が目安。低温でも殺卵効果はある",
  );

  console.log("\n=== コラム記事の修正が完了しました ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
