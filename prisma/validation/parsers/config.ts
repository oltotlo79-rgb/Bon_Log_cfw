/**
 * シードファイルパス設定
 * ファイル名変更時はここだけ修正すればOK
 */
import * as path from "path";

const VALIDATION_DIR = path.resolve(__dirname, "..");
const PRISMA_DIR = path.resolve(VALIDATION_DIR, "..");

export const SEED_PATHS = {
  data: path.resolve(PRISMA_DIR, "seed/pesticide/seed-pesticide-data.ts"),
  additions: path.resolve(PRISMA_DIR, "seed/pesticide/seed-pesticide-additions.ts"),
  /** 追加農薬製品・スプレー型農薬（統合版、ダブルクォート形式の追加データ部分） */
  additions2: path.resolve(PRISMA_DIR, "seed/pesticide/seed-pesticide-additions2.ts"),
  /** 同ファイルのスプレー部分（シングルクォート形式、パーサーが区別して読む） */
  spray: path.resolve(PRISMA_DIR, "seed/pesticide/seed-pesticide-additions2.ts"),
} as const;

export const VALIDATION_PATHS = {
  maffReference: path.resolve(VALIDATION_DIR, "maff-reference.csv"),
  report: path.resolve(VALIDATION_DIR, "validation-report.txt"),
  outDir: VALIDATION_DIR,
} as const;
