# 農薬・病害虫シードデータ 正確性バリデーションプロセス

## 背景と課題

LLMによる検証だけでは農薬データの正確性を担保できない。理由：

1. LLMの知識は学習時点で固定されており、FRAC/IRACコードや登録番号は年次で変わる
2. LLM自身が生成したデータをLLMが検証しても、同じバイアスで見逃す（自己検証の限界）
3. Web検索結果のLLMによる解釈で誤りが入る可能性がある

## 解決策：権威データソースとの機械的突合

### 信頼できるデータソース（正確性の順）

| 優先度 | データソース | URL | 確認できるデータ |
|--------|-------------|-----|----------------|
| 1 | MAFF農薬登録情報提供システム | https://pesticide.maff.go.jp/ | 登録番号・有効成分・含有量・製品名 |
| 2 | FRAC Code List (最新年版PDF) | https://www.frac.info/ | 殺菌剤の作用機序分類コード |
| 3 | IRAC Mode of Action Classification | https://irac-online.org/ | 殺虫剤・殺ダニ剤の作用機序分類コード |
| 4 | メーカー公式製品ページ | 各社サイト | 製品仕様・使用法 |
| 5 | jpmoth.org / 日本産蛾類標準図鑑 | http://www.jpmoth.org/ | 蛾類の学名・科名 |

## バリデーションプロセス

### Step 1: シードデータからCSVエクスポート

```bash
npx tsx prisma/validation/export-pesticide-data.ts
```

対象ソースファイル:
- `seed-pesticide-data.ts` (メインデータ)
- `seed-pesticide-additions.ts` (追加データ第1弾)
- `seed-pesticide-additions2.ts` (追加農薬製品・スプレー型農薬 統合版)

出力ファイル:
- `pesticides.csv` — 農薬製品一覧（全ソース統合）
- `ingredients.csv` — 有効成分一覧（全ソース統合）
- `pest-links.csv` — 農薬⇔有効成分の紐付け
- `disease-pests.csv` — 病害虫一覧
- `effects.csv` — 農薬⇔病害虫の効果データ
- `formulation-types.csv` — 剤型一覧
- `columns.csv` — コラム一覧
- `spreader-types.csv` — 展着剤タイプ一覧
- `spreader-links.csv` — 展着剤⇔農薬紐付け
- `incompatibilities.csv` — 混用不可データ

### Step 2: MAFF公式データを自動取得（推奨）

```bash
npm run validate:scrape-maff        # maff-reference.csv を自動生成・更新
npm run validate:scrape-maff:dry    # CSVを更新せず差分レポートのみ
```

スクレイパーが行うこと:
1. シードデータから登録番号付き農薬を抽出
2. MAFF公式サイト（https://pesticide.maff.go.jp/）から各製品の詳細ページを取得
3. 製品名・有効成分・含有量を自動抽出
4. maff-reference.csv を公式データで自動更新
5. シードデータとの差分をレポート出力

- レート制限: 1.2秒/リクエスト（MAFF負荷軽減）
- ローカルキャッシュ: `.maff-cache/` に30日間保持（`--force` で再取得）
- 登録番号なしの製品は対象外

### Step 2b: 手動確認（登録番号なし製品のみ）

登録番号がない製品（`maff-reference-pending.csv` に記録、2026-05-14 時点で 52 件）は MAFF 公式
データで個別検証ができない状態のため、以下のルールで扱う:

1. UI 上で「MAFF 未検証」「公的根拠なし」のバッジを必ず付与する (`isVerified` 相当の表示制御)。
2. 「おすすめ農薬」「使用可能農薬」など断定的なレコメンド表示には**使用しない**。
3. 手動で MAFF サイト (https://pesticide.maff.go.jp/) を検索し、登録番号をシードデータに追加する。
4. 追加後は Step 2 を再実行すれば自動検証対象になる。
5. 製品名が一般名・通称名 (例: `石灰硫黄合剤`, `マシン油乳剤`) で複数の登録製品候補がある場合は、
   slug をメーカー名込みで正規化 (例: `oat-lime-sulfur`, `kumiai-lime-sulfur`) してから検証する。

### Step 3: 自動突合バリデーション実行

```bash
npx tsx prisma/validation/validate-against-maff.ts
```

出力:
- コンソールに差異レポート
- `validation-report.txt` に詳細レポート

### Step 4: エラー修正

レポートの ❌ マークの項目を修正する。修正後は Step 1 から再実行して確認。

## バリデーション項目一覧 (16チェック)

| # | チェック内容 | 対象 | 深刻度 |
|---|------------|------|--------|
| 1 | MAFF公式データとの突合（登録番号・有効成分・含有量） | 農薬製品 | ❌ Error |
| 2 | FRAC/IRACコードの実在性 | 有効成分 | ❌ Error |
| 3 | 農薬⇔有効成分リンクの整合性 | 紐付けデータ | ❌ Error |
| 4 | slug重複チェック | 農薬・有効成分 | ❌ Error |
| 5 | 効果データの論理整合性（殺菌剤→害虫等） | 効果データ | ❌ Error |
| 6 | 剤型⇔農薬名の整合性 | 剤型 | ⚠ Warn |
| 7 | 害虫体長のmin/max妥当性 | 病害虫 | ❌/⚠ |
| 8 | コラム内の危険パターン検出 | コラム | ❌ Error |
| 9 | 混用不可データの双方向整合性 | 混用不可 | ❌ Error |
| 10 | resistanceRiskとFRAC/IRACグループの相関 | 有効成分 | ⚠ Warn |
| 11 | 効果レベルの生物学的妥当性 | 効果データ | ⚠ Warn |
| 12 | 登録番号フォーマット検証（4-6桁数字） | 農薬製品 | ❌ Error |
| 13 | 有効成分英名の基本形式チェック | 有効成分 | ⚠ Warn |
| 14 | コラムセクションの構造チェック | コラム | ✓ Info |
| 15 | MAFF未検証製品のリスト出力 | 農薬製品 | ⚠ Warn |
| 16 | slug命名規則統一性（半角英数字+ハイフン） | 全slug | ❌ Error |
| 17 | FRAC/IRACコードのファイル間整合性 | 有効成分 | ❌ Error |
| 18 | 効果データ内の病害虫slug存在確認 | 効果データ | ❌ Error |
| 19 | 効果ゼロの農薬検出（展着剤・特殊剤除外） | 農薬製品 | ⚠ Warn |
| 20 | 全レベルnullの効果データ検出 | 効果データ | ❌ Error |
| 21 | pesticideTypeとFRAC/IRACタイプの整合性 | 農薬×成分 | ⚠ Warn |
| 22 | resistanceRisk設定漏れ検出 | 有効成分 | ⚠ Warn |
| 23 | 希釈倍率の妥当範囲チェック（0倍・20000倍超） | 全ソース | ❌/⚠ |
| 24 | 展着剤リンクのslug存在確認 | 展着剤紐付け | ❌ Error |
| 25 | 有効成分の英名重複チェック | 有効成分 | ❌ Error |
| 26 | 病害虫descriptionの空欄チェック（10文字未満） | 病害虫 | ⚠ Warn |

## データ変更時のルール

### シードデータを変更する際は必ず:

1. **変更する値の根拠を明示する** — MAFF登録番号、公式URLなど
2. **maff-reference.csv を先に更新する** — 公式データを先に記録してからシードを修正
3. **バリデーションスクリプトを実行する** — 修正後に必ず `validate-against-maff.ts` を実行
4. **LLMの出力を鵜呑みにしない** — LLMが「〜のはず」と言った値は必ずMAFF等で裏取り

### LLMに依頼する際の注意:

- 「正確に修正して」ではなく「MAFFの登録番号XXXXXのデータを確認して修正して」と指示する
- FRAC/IRACコードの変更は必ず公式PDF（最新年版）のURLを添えて依頼する
- 学名・科名の変更は jpmoth.org 等の具体的URLを添えて依頼する

## ファイル構成

```
prisma/validation/
├── PROCESS.md                    ← このファイル（プロセス説明）
├── export-pesticide-data.ts      ← シードデータ→CSV変換（全ソースファイル対応）
├── validate-against-maff.ts      ← MAFF公式データとの突合（16チェック）
├── maff-reference.csv            ← MAFF公式データ（人間が記入）
├── validation-report.txt         ← バリデーション結果（自動生成）
├── pesticides.csv                ← 農薬一覧（自動生成）
├── ingredients.csv               ← 有効成分一覧（自動生成）
├── pest-links.csv                ← 紐付け一覧（自動生成）
├── disease-pests.csv             ← 病害虫一覧（自動生成）
├── effects.csv                   ← 効果データ（自動生成）
├── formulation-types.csv         ← 剤型一覧（自動生成）
├── columns.csv                   ← コラム一覧（自動生成）
├── spreader-types.csv            ← 展着剤タイプ一覧（自動生成）
├── spreader-links.csv            ← 展着剤⇔農薬紐付け（自動生成）
└── incompatibilities.csv         ← 混用不可データ（自動生成）
```
