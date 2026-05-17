# 農薬シードデータ 実行順序・依存関係ガイド

## 実行順序

### Phase 1: 基盤データ（必ず最初に実行）

| # | ファイル | 冪等性 | 内容 |
|---|----------|--------|------|
| 1 | seed-pesticide-data.ts | **非冪等（全削除→再作成）** | 農薬製品, 成分, 病害虫, 効果, コラム, 展着剤 |
| 2 | seed-pesticide-additions.ts | 冪等 | 追加4製品, 11病害虫, 8成分, 5コラム |

### Phase 2: データ拡充（Phase 1 完了後）

| # | ファイル | 冪等性 | 内容 |
|---|----------|--------|------|
| 3 | seed-pesticide-additions2.ts | 冪等 | 追加14製品 + スプレー16製品（旧spray.tsを統合） |

### Phase 3: 修正 — **全て基盤データに吸収済み**

7つの修正ファイル + effect-supplement + enhance-descriptions の内容は Phase 1/2 の基盤データに直接反映済み。
seed-pesticide-spray.ts は seed-pesticide-additions2.ts に統合済み。
アーカイブは `prisma/seed-pesticide-archive/` に保存（履歴参照用、実行不要）。

### Phase 4: 検証（任意）

| # | ファイル | 内容 |
|---|----------|------|
| 5 | seed-pesticide-validate.ts | 4レベル整合性チェック |

## 一括実行

```bash
# 全Phase実行
npx tsx prisma/seed-pesticide-all.ts

# バリデーションなし
npx tsx prisma/seed-pesticide-all.ts --skip-validate
```

## data.ts フルリセット後の復旧手順

`seed-pesticide-data.ts` は全テーブルを削除→再作成するため、Phase 2 の変更が消失します。復旧手順:

```bash
# Phase 2: データ拡充
npx tsx prisma/seed-pesticide-additions2.ts

# 検証
npx tsx prisma/seed-pesticide-validate.ts
```

## CSV検証パイプライン

```bash
# ソースコード → CSV出力（DB接続不要）
npx tsx prisma/validation/export-pesticide-data.ts

# MAFF公式データとの突合（26チェック）
npx tsx prisma/validation/validate-against-maff.ts

# 上記2つを一括実行
npm run validate:pesticide
```

## 検証ツールが読み取るファイル

| ファイル | export | validate | パース方式 |
|---|---|---|---|
| seed-pesticide-data.ts | o | o | pMap/ingMap/dpMap, ダブルクォート |
| seed-pesticide-additions.ts | o | o | pMap + 配列形式, シングルクォート |
| seed-pesticide-additions2.ts | o | o | 統合版: ダブルクォート部(ensurePesticide) + シングルクォート部(ensureSprayProduct) |
