---
globs: "prisma/validation/**/*.ts, prisma/seed-pesticide*.ts, lib/actions/pesticide.ts, components/pesticide/**/*.tsx"
---

# 農薬・病害虫データのバリデーションルール

## 原則

- **農薬データの変更時は必ずMAFF等の公式ソースで裏取りする**
- **LLMの出力を鵜呑みにしない** — 特にFRAC/IRACコード・含有量・登録番号

## バリデーション手順

```bash
# 1. シードデータからCSVエクスポート
npx tsx prisma/validation/export-pesticide-data.ts

# 2. maff-reference.csv にMAFF公式データを記入
#    人間が https://pesticide.maff.go.jp/ で確認

# 3. 自動突合
npx tsx prisma/validation/validate-against-maff.ts
```

## 詳細

`prisma/validation/PROCESS.md` を参照。
