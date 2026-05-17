/* eslint-disable no-console */
/**
 * 害虫の体長データの事実誤りを修正するスクリプト。
 *
 * 修正内容:
 * - 重大な体長エラー6件（大幅にずれている値）
 * - 中程度の体長エラー7件
 * - 幼虫サイズの修正3件
 * - ムカデのサイズ範囲拡大
 * - アカホシテントウの益虫への分類変更
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-fix-bodysize.ts
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

interface BodySizeFix {
  slug: string;
  name: string;
  bodySizeMinMm: number;
  bodySizeMaxMm: number;
  reason: string;
  category?: "pest" | "beneficial_insect";
}

async function main() {
  console.log("=== 害虫体長データの修正を開始します ===\n");

  const fixes: BodySizeFix[] = [
    // ── 重大な誤り（大幅にずれている） ──
    {
      slug: "douganebuibui",
      name: "ドウガネブイブイ",
      bodySizeMinMm: 17,
      bodySizeMaxMm: 25,
      reason: "成虫体長17-25mm。DB旧値10-14mmは小さすぎ",
    },
    {
      slug: "miyama-kamikiri",
      name: "ミヤマカミキリ",
      bodySizeMinMm: 32,
      bodySizeMaxMm: 57,
      reason: "成虫体長32-57mm。日本最大級のカミキリムシ。DB旧値20-30mmは大幅に小さすぎ",
    },
    {
      slug: "kiboshi-saruhamushi",
      name: "キボシサルハムシ",
      bodySizeMinMm: 3,
      bodySizeMaxMm: 5,
      reason: "成虫体長3-4.5mm。DB旧値8-12mmは大幅に大きすぎ",
    },
    {
      slug: "oo-zoumusi",
      name: "オオゾウムシ",
      bodySizeMinMm: 12,
      bodySizeMaxMm: 29,
      reason: "成虫体長12-29mm。日本最大のゾウムシ。DB旧値10-15mmは最大値が小さすぎ",
    },
    {
      slug: "chabane-aokamemushi",
      name: "チャバネアオカメムシ",
      bodySizeMinMm: 10,
      bodySizeMaxMm: 12,
      reason: "成虫体長10-12mm。DB旧値14-18mmは大きすぎ",
    },
    // アカホシテントウ: 益虫への分類変更 + 体長は正しい
    {
      slug: "akahoshi-tentou",
      name: "アカホシテントウ",
      bodySizeMinMm: 6,
      bodySizeMaxMm: 8,
      reason: "カイガラムシを捕食する益虫。害虫から益虫に分類変更",
      category: "beneficial_insect",
    },

    // ── 中程度の誤り ──
    {
      slug: "hime-kamenoko-hamushi",
      name: "ヒメカメノコハムシ",
      bodySizeMinMm: 5,
      bodySizeMaxMm: 6,
      reason: "成虫体長5.0-5.5mm。DB旧値7-10mmは大きすぎ",
    },
    {
      slug: "himekogane",
      name: "ヒメコガネ",
      bodySizeMinMm: 12,
      bodySizeMaxMm: 16,
      reason: "成虫体長12-16mm。DB旧値8-11mmは小さすぎ",
    },
    {
      slug: "kisuji-nomihamushi",
      name: "キスジノミハムシ",
      bodySizeMinMm: 2,
      bodySizeMaxMm: 3,
      reason: "成虫体長2-3mm。DB旧値3-4mmはやや大きすぎ",
    },
    {
      slug: "matsuheri-kamemushi",
      name: "マツヘリカメムシ",
      bodySizeMinMm: 15,
      bodySizeMaxMm: 20,
      reason: "成虫体長15-20mm。DB旧値12-16mmは小さすぎ",
    },
    {
      slug: "ebiiro-kamemushi",
      name: "エビイロカメムシ",
      bodySizeMinMm: 14,
      bodySizeMaxMm: 18,
      reason: "成虫体長14-18mm。DB旧値12-15mmは小さすぎ",
    },
    {
      slug: "ruby-roumushi",
      name: "ルビーロウムシ",
      bodySizeMinMm: 3,
      bodySizeMaxMm: 5,
      reason: "雌成虫（ロウ質含む）3-5mm。DB旧値4-8mmは最大値が大きすぎ",
    },
    {
      slug: "kikusui-kamikirimushi",
      name: "キクスイカミキリ",
      bodySizeMinMm: 6,
      bodySizeMaxMm: 10,
      reason: "成虫体長6-10mm。DB旧値8-15mmは最大値が大きすぎ",
    },

    // ── 幼虫サイズの修正 ──
    {
      slug: "koumoriga",
      name: "コウモリガ",
      bodySizeMinMm: 60,
      bodySizeMaxMm: 80,
      reason: "盆栽被害は幼虫の幹穿孔。終齢幼虫60-80mm。DB旧値40-60mmは小さすぎ",
    },
    {
      slug: "oosukashiba",
      name: "オオスカシバ",
      bodySizeMinMm: 55,
      bodySizeMaxMm: 65,
      reason: "盆栽被害は幼虫の食害。終齢幼虫55-65mm。DB旧値40-55mmはやや小さい",
    },

    // ── ムカデのサイズ範囲拡大 ──
    {
      slug: "mukade",
      name: "ムカデ",
      bodySizeMinMm: 40,
      bodySizeMaxMm: 150,
      reason: "日本の一般的なトビズムカデ80-150mm、アカズムカデ40-120mm。DB旧値20-80mmは範囲が狭すぎ",
    },

    // ── マツノマダラカミキリの微修正 ──
    {
      slug: "matsunomadara-kamikiri",
      name: "マツノマダラカミキリ",
      bodySizeMinMm: 18,
      bodySizeMaxMm: 30,
      reason: "成虫体長18-30mm。DB旧値15-25mmは範囲がやや狭い",
    },
  ];

  for (const fix of fixes) {
    const dp = await prisma.diseasePest.findUnique({ where: { slug: fix.slug } });
    if (!dp) {
      console.warn(`  ⚠ ${fix.name}（${fix.slug}）が見つかりません`);
      continue;
    }

    const updateData: Record<string, unknown> = {
      bodySizeMinMm: fix.bodySizeMinMm,
      bodySizeMaxMm: fix.bodySizeMaxMm,
    };

    // カテゴリ変更がある場合
    if (fix.category) {
      updateData.category = fix.category;
    }

    await prisma.diseasePest.update({
      where: { slug: fix.slug },
      data: updateData,
    });

    const oldMin = dp.bodySizeMinMm;
    const oldMax = dp.bodySizeMaxMm;
    const categoryNote = fix.category ? ` [カテゴリ: ${dp.category} → ${fix.category}]` : "";
    console.log(
      `  ✓ ${fix.name}: ${oldMin}-${oldMax}mm → ${fix.bodySizeMinMm}-${fix.bodySizeMaxMm}mm${categoryNote}`
    );
    console.log(`    理由: ${fix.reason}`);
  }

  console.log(`\n修正件数: ${fixes.length}件`);
  console.log("\n=== 害虫体長データの修正が完了しました ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
