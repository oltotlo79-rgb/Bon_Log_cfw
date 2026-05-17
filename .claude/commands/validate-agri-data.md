# 農薬・病害虫・肥料・ホルモンデータ正確性検証・修正スキル

prisma/validation/ 配下の全バリデーションデータ（病害虫・薬剤・肥料・効果紐付け・植物ホルモン）を多角的に深く検証し、事実と異なるデータを特定・修正する。

---

## フェーズ構成

このスキルは3フェーズで実行する。各フェーズを省略・スキップしない。

### フェーズ1: データ読み込みと検証（修正しない）
### フェーズ2: 指摘の再検証（修正しない）
### フェーズ3: 確定した指摘のみ修正

---

## フェーズ1: データ読み込みと包括的検証

### 1-1. 前回監査レポートの読み込み

docs/plans/ 内の data-accuracy-audit-*.md および validation-audit-*.md を全て読み、過去に指摘済みの項目をリストアップする。
**前回指摘済みの項目は再度指摘しない。**

### 1-2. 対象ファイルの全量読み込み

以下のCSVを全量読み込む（大きいファイルは分割読み込み）:

#### 農薬・病害虫

| ファイル | 内容 |
|---------|------|
| `prisma/validation/pesticides.csv` | 農薬製品データ |
| `prisma/validation/ingredients.csv` | 有効成分（FRAC/IRACコード含む） |
| `prisma/validation/pest-links.csv` | 農薬⇔有効成分リンク（含有率） |
| `prisma/validation/disease-pests.csv` | 病害虫・益虫データ（体長・説明文含む） |
| `prisma/validation/effects.csv` | 農薬⇔病害虫 効果紐付け |
| `prisma/validation/formulation-types.csv` | 剤型マスタ |
| `prisma/validation/incompatibilities.csv` | 混用禁忌 |
| `prisma/validation/spreader-types.csv` | 展着剤タイプ |
| `prisma/validation/spreader-links.csv` | 展着剤リンク |

#### 肥料

| ファイル | 内容 |
|---------|------|
| `prisma/validation/fertilizer-nutrients.csv` | 栄養素マスタ（16種: 元素記号・カテゴリ・出典） |
| `prisma/validation/fertilizer-categories.csv` | 肥料カテゴリ（7種: 有機固形・液体・化成・葉面散布等） |
| `prisma/validation/fertilizer-tree-species.csv` | 樹種マスタ（20種: カテゴリ・ソート順） |
| `prisma/validation/fertilizer-plans.csv` | 樹種別施肥計画（代表5樹種×12月=60件: action/N/P/K/出典） |
| `prisma/validation/fertilizer-columns.csv` | 肥料コラム記事メタデータ（13件） |

#### ホルモン

| ファイル | 内容 |
|---------|------|
| `prisma/validation/hormones.csv` | ホルモン基本情報（化学式・出典） |
| `prisma/validation/hormone-effects.csv` | ホルモン効果（isPromotingフラグ含む） |
| `prisma/validation/hormone-interactions.csv` | ホルモン間相互作用（type: synergistic/antagonistic/modulatory） |
| `prisma/validation/hormone-seasonal.csv` | 月別活性レベル（関東地方・落葉広葉樹基準） |
| `prisma/validation/hormone-techniques.csv` | ホルモン⇔盆栽技法マッピング（19件: effectType/magnitude/出典） |
| `prisma/validation/hormone-columns.csv` | ホルモンコラム記事メタデータ |

必要に応じてシードファイルも参照する:
- `prisma/seed-pesticide-data.ts` — メインシードデータ
- `prisma/seed-pesticide-additions.ts` — 追加データ
- `prisma/seed-pesticide-additions2.ts` — 追加データ2
- `prisma/seed-fertilizer-data.ts` — 肥料データ
- `prisma/seed-hormone-data.ts` — ホルモンデータ

### 1-3. 検証チェックリスト（全項目を実行）

**A. 有効成分の正確性**
- [ ] FRAC/IRACコードが公式分類（FRAC Code List 2024 / IRAC MoA Classification v11.1）と一致するか
- [ ] 成分名（日本語・英語）が正しいか
- [ ] 抵抗性リスク（resistanceRisk）が作用機序に対して妥当か
- [ ] 成分グループ名が正しいか

**B. 農薬製品の正確性**
- [ ] pesticideType（insecticide/fungicide/acaricide/compound/other）が正しいか
  - 単一成分の製品が compound になっていないか（lime-sulfur等の例外を除く）
  - MAFF登録分類と整合しているか
- [ ] 剤型（formulationType）が実際の製品と一致するか
- [ ] 登録番号がMAFF登録と一致するか（存在する場合）
- [ ] 含有率（contentLabel）が空欄でないか、MAFF登録値と一致するか

**C. 病害虫データの正確性**
- [ ] category（disease/pest/beneficial_insect）が正しいか
- [ ] bodySizeMinMm / bodySizeMaxMm が昆虫学・菌学文献と一致するか
- [ ] **説明文（description）内の体長記載がCSVのbodySizeフィールドと一致するか**（過去に片方だけ修正されて不整合が生じたケースあり）
- [ ] 説明文の病原菌名・学名が正しいか
- [ ] 説明文の生態記述が事実に即しているか

**D. 効果紐付けの正確性**
- [ ] 殺菌剤がウイルス性・ファイトプラズマ性病害にリンクされていないか（到達不可能）
- [ ] 接触型殺菌剤（FRAC M群）が維管束内病害にリンクされていないか
- [ ] 効果レベル（prevention/treatment/efficacy/persistence）が作用機序と整合するか
  - 保護殺菌剤（M群）: treatmentLevel = none
  - 接触型殺虫剤: persistenceLevel ≠ excellent
  - 浸透移行性: treatmentLevel = good以上
- [ ] 同一有効成分を含む複数製品間で、効果リンクのカバレッジが整合しているか
  - 例: applaud-wp（ブプロフェジン単剤）に12件リンクがあるのに、applaud-ace-fl（ブプロフェジン+フェンピロキシメート）に2件しかない場合はギャップ
- [ ] 同一FRACグループの銅剤（M01）間でリンクが整合しているか
- [ ] 効果データが0件の農薬がないか

**E. 肥料データの正確性**
- [ ] 栄養素（fertilizer-nutrients.csv）のsymbol・category（primary/secondary/trace）が植物栄養学の分類と一致するか
  - 三大要素（N,P,K）= primary、カルシウム・マグネシウム・硫黄 = secondary、残り = trace
  - ニッケル（Brown et al. 1987）、ケイ素（有用元素）、コバルト（根粒菌用）の分類が正確か
- [ ] 栄養素の役割・欠乏症・過剰症がTaiz & Zeiger等の農学文献と一致するか
- [ ] 肥料カテゴリ（fertilizer-categories.csv）の分類が一般的な肥料学と整合するか
- [ ] 樹種（fertilizer-tree-species.csv）のcategory（conifer/deciduous/flowering/fruiting/grass/evergreen）が正しいか
- [ ] 施肥計画（fertilizer-plans.csv）のaction（none/light/moderate/heavy）が季節管理の常識と整合するか
  - 五葉松: 春〜夏はすべて none（鉄則）、秋のみ施肥
  - 楓: 7月以降 nitrogen = none（紅葉のため窒素厳禁）
  - 皐月: 3〜5月は none（蕾〜開花期は施肥厳禁）
  - 梅: 1〜2月は none（開花期）、3月にお礼肥（P重視）
  - 黒松: 6月 none（芽切り前）、9〜11月は秋肥（K重視）
- [ ] 施肥計画とコラム記事の間に表面上の矛盾がないか（ある場合、例外として正当か確認）
- [ ] コラム記事（fertilizer-columns.csv）のcategory（basics/seasonal/technique/troubleshooting）が内容と一致するか
- [ ] シードデータ（seed-fertilizer-data.ts）とバリデーションCSV（fertilizer-*.csv）の値が一致するか

**F. ホルモンデータの正確性**
- [ ] 化学式がPubChem/IUPACと一致するか（hormones.csv）
- [ ] ホルモン効果のisPromotingフラグが正しいか（hormone-effects.csv）
  - 「促進」する効果 → true
  - 「抑制」する効果 → false（例: 老化抑制、分岐抑制）
- [ ] ホルモン効果の記述が植物生理学の教科書的知見（Taiz & Zeiger等）と一致するか
- [ ] 相互作用のtype（synergistic/antagonistic/modulatory）が正しいか（hormone-interactions.csv）
- [ ] 月別活性レベルが関東地方の落葉広葉樹の生理と整合するか（hormone-seasonal.csv）
  - オーキシン: 春夏high、冬minimal
  - ABA: 冬high（休眠維持）、春minimal、夏は乾燥でlow
  - ジベレリン: 春high（芽吹き）、秋冬minimal
  - サイトカイニン: 根の活動期に連動
  - エチレン: 秋high（落葉期）
- [ ] 生合成部位の記述が正しいか（seed-hormone-data.ts の productionSite）
- [ ] コラム記事の科学的内容が正確か（hormone-columns.csv + seed-hormone-data.ts のcontent）
  - Skoog & Miller 1957 のオーキシン/サイトカイニン比
  - Lang et al. 1987 の休眠3段階分類
  - ホルミシス（eustress）の概念
- [ ] シードデータ（seed-hormone-data.ts）とバリデーションCSV（hormone-*.csv）の値が一致するか

**F2. ホルモン技法マッピングの正確性**
- [ ] 技法のeffectType（increase/decrease/redistribute）が科学的に正しいか（hormone-techniques.csv）
  - 摘芯→オーキシンdecrease（頂芽除去）、サイトカイニンincrease（側芽解放）
  - 剪定→オーキシンdecrease、サイトカイニンincrease、ジベレリン軽度increase（再生成長）
  - 針金掛け→エチレンincrease（接触形態形成: Jaffe 1973）
  - 植替え→サイトカイニンdecrease（根端除去）
  - 取り木→オーキシンincrease（極性輸送遮断・蓄積: Sachs 1991）
  - 水やり管理→ABAincrease（乾燥ストレス: Zhu 2002）
  - 日照管理→オーキシンredistribute（Cholodny-Went説）、フロリゲンincrease（光周性）
- [ ] magnitude（strong/moderate/mild）が効果の大きさとして妥当か
- [ ] bestMonths配列が季節管理の常識と整合するか
- [ ] 各技法のhormoneSlugがhormones.csvに存在するか
- [ ] 出典（source列）が空欄でないか、引用が正確か
- [ ] シードデータ（seed-hormone-data.ts の技法セクション）とCSV（hormone-techniques.csv）の値が一致するか

**G. 新規紐付け提案**
- [ ] 病害虫と薬剤で紐付けられていないが紐付け可能なものはないか
- [ ] 同一成分・同一系統の薬剤間でリンクに大きな差がないか
- [ ] 盆栽で重要だが効果リンクが0件の病害虫はないか

### 1-4. 指摘リストの作成

発見した全指摘を以下の形式でリストアップする（まだ修正しない）:

```
| # | カテゴリ | 対象 | 現在値 | 推奨値 | 根拠 | 信頼度 |
```

信頼度は以下の基準:
- **HIGH**: 公式ソース（FRAC/IRAC/MAFF/PubChem/学術文献）で確認済み、または同一データベース内の整合性で明白
- **MEDIUM**: 複数の二次資料で支持されるが公式ソースで直接確認できていない
- **LOW**: LLMの知識のみに基づく推測

---

## フェーズ2: 指摘の再検証（最重要フェーズ）

**フェーズ1の全指摘を1件ずつ再検証する。このフェーズが最も重要。**

### 2-1. 再検証の手順

各指摘について以下を実行:

1. **反証の試み**: 「この指摘が間違っている可能性はないか」を積極的に検討
   - 現在値が正しい理由があるのではないか
   - データベースの設計意図として意図的な値ではないか
   - 過去の監査で誤検出と判定された類似ケースはないか

2. **複数ソースでの裏取り**: 単一ソースに依存しない
   - FRAC/IRACコード → 公式Code List（最新版の年を明記）
   - 害虫体長 → 最低2つの異なるソース
   - 効果紐付け → 作用機序の科学的原理 + 同一成分の他製品との整合性
   - ホルモン化学式 → PubChem CID で確認
   - ホルモン効果 → Taiz & Zeiger 等の教科書 + 原著論文

3. **判定**: 各指摘に以下のいずれかを付与
   - **確定（修正する）**: 反証の余地がない。信頼度HIGH。
   - **要確認（修正しない）**: 正しい可能性が高いがMAFF等での確認が必要。
   - **誤検出（取り下げ）**: 再検証の結果、現在値が正しいと判明。

### 2-2. 特に注意すべき誤検出パターン（過去の教訓）

以下は過去の監査で誤検出と判定された例。同じ誤りを繰り返さない:

| 誤検出パターン | 例 | 教訓 |
|--------------|---|------|
| FRAC/IRACコードのサブグループ混同 | ピフルブミド 25B→25Aは誤り（25Bが正しい） | サブグループ（A/B）は化学構造に基づく別分類 |
| 体長の成虫/幼虫混同 | カブラハバチの12-18mmは幼虫サイズで正しい | DBは被害段階の虫体サイズを記録する方針 |
| 汎用カテゴリのサイズ範囲 | ケムシ・イモムシのmax 40mmは意図的（大型種は個別登録） | 汎用カテゴリと個別エントリの棲み分けを確認 |
| 旧FRAC番号の「更新」提案 | FRAC 41はテトラサイクリン系で正しい（31はカルボン酸系） | FRAC番号は暗記に頼らず公式リストで確認 |
| 製品の有効成分の取り違え | diana-wdg = スピネトラム（シアントラニリプロールではない） | pest-links.csvの実データを必ず確認 |
| 施肥スケジュールの「矛盾」誤検出 | 楓6月 "light" は梅雨前の移行期として正当 | 月単位のコラムと樹種別プランは抽象度が異なる |
| ホルモン分子式の「重複」指摘 | ストリゴラクトンとGA3は同一分子式C19H22O6だが構造異性体 | 分子式の一致は構造の同一を意味しない |
| ホルモン技法の「不足」指摘 | 全ホルモンに全技法のリンクがないのは正常 | 科学的根拠のある紐付けのみ登録する方針 |
| 施肥計画CSV「不完全」指摘 | fertilizer-plans.csvは代表5樹種のみ | 残り15種は基本パターンに準拠しており意図的 |

### 2-3. 再検証結果の記録

```
| # | 元の指摘 | 再検証結果 | 判定 | 理由 |
```

---

## フェーズ3: 確定指摘の修正実施

**フェーズ2で「確定（修正する）」と判定された指摘のみ修正する。**

### 3-1. 修正対象ファイル

修正は以下の両方に実施する:

1. **バリデーションCSV** (`prisma/validation/*.csv`)
2. **シードデータ** (`prisma/seed-pesticide-data.ts`, `seed-pesticide-additions.ts`, `seed-pesticide-additions2.ts`, `seed-fertilizer-data.ts`, `seed-hormone-data.ts`)

CSVとシードの整合性を確認すること。過去にCSVだけ修正してシードが未修正（またはその逆）のケースが発生している。

### 3-2. 修正手順

1. バリデーションCSVを修正
2. 対応するシードファイルを修正
3. CSVとシードの値が一致していることをgrepで確認
4. `npx vitest run` でテストが全パスすることを確認

### 3-3. 監査レポートの出力

修正完了後、`docs/plans/data-accuracy-audit-{日付}.md` にレポートを出力する。

レポートには以下を含める:
- 検証済み（問題なし）の項目一覧
- 修正実施済みの項目（差分の概要）
- 未修正（MAFF等での確認待ち）の項目
- 新規効果紐付け提案（前回と重複しないもの）
- 前回監査からの修正状況の追跡

---

## 制約事項

- **正確性を最優先**: 不確実な修正は実施しない。「修正しない」判断は正当。
- **LLMの知識を鵜呑みにしない**: 特にFRAC/IRACコード、含有量、登録番号、ホルモン化学式はLLMの記憶が不正確な場合がある。データベース内の整合性チェックとPubChem等の公式DBでの確認を優先する。
- **農薬データの変更時はMAFF等の公式ソースで裏取りする** （CLAUDE.mdルール準拠）
- **ホルモンデータの変更時はPubChem・学術文献で裏取りする**
- **前回指摘済みの項目を再度指摘しない**: docs/plans/ の過去レポートを必ず確認する
