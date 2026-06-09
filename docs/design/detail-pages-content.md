# 詳細ページ コンテンツ強化設計

## 1. 概要 / 目的

病害虫詳細・辞典詳細・製品詳細の 3 ページについて、**既存 DB フィールドと検証済みデータ**だけを使い、
表示の depth と内部リンク回遊性を高める。SEO の JSON-LD 整合性も改善する。

### 最重要制約（設計全体に適用）

- 表示する情報はすべて **prisma/schema.prisma の実在フィールド**または **prisma/validation/ の検証済みデータ**に由来する。
- LLM が農薬事実（希釈倍率・効能・症状詳細文など）を創作・補完することは禁止。
- データが DB に存在しない項目は「データ不在のため今回のスコープ外」と明記し、空欄のままにする。
- MAFF 未検証製品（`maff-reference-pending.csv` 記載の約 52 件）については追加注記表示のみ行い、
  事実確認が取れていない情報は表示しない。

---

## 2. 現状整理

### 2-1. 対象ページと現状の表示内容

| ページ | ルート | 現状の主要表示 | 取得アクション |
|--------|--------|--------------|--------------|
| 病害虫詳細 | `/pesticides/diseases-pests/[slug]` | 名前・読み・概要・画像・効く薬剤リスト（効果評価付き） | `getDiseasePestBySlug` |
| 辞典詳細 | `/dictionary/[slug]` | 用語・読み・説明・カテゴリ・関連用語・前後ナビ | `getTermBySlug` + `getRelatedTerms` + `getAdjacentTerms` |
| 製品詳細 | `/pesticides/products/[slug]` | 名前・登録番号・剤型・耐性リスク・成分・混用不可・効果病害虫 | `getPesticideBySlug` |

### 2-2. 現状の不足点

| ページ | 不足点 |
|--------|-------|
| 病害虫詳細 | 体長（`bodySizeMinMm`/`bodySizeMaxMm`）が DB に存在するが未表示。カテゴリ別（disease/pest/beneficial_insect）の絞り込みリンクがない。 |
| 辞典詳細 | 現状で関連用語・前後ナビは実装済み。カテゴリ一覧ページへのリンクのみあり。description の読みやすさ改善余地あり。 |
| 製品詳細 | 同一成分を持つ他製品への横断リンクがない。MAFF 未検証製品の明示的な注記がない。registrationNumber リンクは存在するが JSON-LD の `productID` 整合を確認すべき。 |

---

## 3. 各ページの追加要素設計

### 3-1. 病害虫詳細ページ（`/pesticides/diseases-pests/[slug]`）

#### 追加セクション一覧

| # | セクション名 | 追加する表示内容 | 参照フィールド | 備考 |
|---|------------|----------------|-------------|------|
| A | 体長情報（害虫・益虫のみ） | 「体長: X〜Y mm」 | `DiseasePest.bodySizeMinMm` / `bodySizeMaxMm` | `category === 'pest' || category === 'beneficial_insect'` の場合のみ表示。`null` の場合は非表示 |
| B | カテゴリ内一覧リンク | 「同じカテゴリの病害虫を見る」リンク | `DiseasePest.category` | `/pesticides/diseases-pests?category={category}` への内部リンク |
| C | 効果薬剤数バッジ | ヘッダー付近に「{N}件の薬剤が効果あり」 | `DiseasePest.effects` の `length` | 既存の `({dp.effects.length}件)` を h1 付近に移動して視認性向上 |

**データ不在のため今回のスコープ外:**
- 症状の詳細文（発生時期・症状写真の alt テキスト以上の記述）: `description` フィールドはあるが内容は seed データ依存。追記する場合は MAFF・農文協等の文献に基づき人間が編集することが前提
- 発生しやすい樹種: DB に樹種と病害虫のリレーションは存在しない（seed 拡張が必要、MAFF 裏取り必須）
- 発生シーズン（月）: DB に月フィールドなし

#### ページレイアウト変更（デスクトップ/モバイル共通）

```
[戻るリンク]
[画像 + 名前 + カテゴリバッジ + 読み]
  → ここに体長情報を追加（害虫/益虫のみ、category pill の下）

[概要セクション]（既存）

[農薬免責注意]（既存）

[効く薬剤セクション]（既存）
  → セクション見出し下に「カテゴリ内一覧を見る」リンクを追加
```

#### 追加コンポーネント・実装メモ

- 体長表示: Server Component として追加。`bodySizeMinMm === bodySizeMaxMm` の場合は「{N} mm」、
  異なる場合は「{min}〜{max} mm」と表示。単位は mm 固定（DB の単位に準拠）。
- カテゴリリンク: 既存の `/pesticides/diseases-pests` 一覧ページが `?category=` クエリを受け取る
  実装であることを backend に確認してから実装すること（backend に要相談）。

---

### 3-2. 辞典詳細ページ（`/dictionary/[slug]`）

#### 現状の評価

辞典詳細は以下がすでに実装されており、基本的な内部リンク設計は完成している。

- 関連用語（同カテゴリ）: `getRelatedTerms` → グリッド表示
- 前後ナビ（同カテゴリ内）: `getAdjacentTerms` → prev/next リンク
- カテゴリ一覧リンク: `/dictionary?category={category}`

#### 追加できる改善（既存フィールドのみ）

| # | 改善内容 | 参照フィールド | 備考 |
|---|---------|-------------|------|
| A | description の長文を `<details>/<summary>` 折りたたみ表示 | `BonsaiTerm.description` | 500 文字以上の場合のみ「続きを読む」展開。Client Component として切り出す |
| B | reading（読み）のルビ表示 | `BonsaiTerm.reading` | `<ruby>` + `<rt>` を使いアクセシビリティを向上。既存の `<p>` 表示より意味が明確 |
| C | `sortOrder` を使った同カテゴリ内での位置表示 | `BonsaiTerm.sortOrder` | 「このカテゴリの第 N 番目」の表示。取得は `getAdjacentTerms` が全件取得しているので index が分かる |

**データ不在のため今回のスコープ外:**
- 用語の図解・イラスト: `BonsaiTerm` に画像フィールドなし（seed 拡張が必要）
- 「この用語が使われた投稿」: 投稿テキストへの辞典リンク機能は未実装
- 他カテゴリの関連用語: `getRelatedTerms` は同カテゴリのみ対象（クロスカテゴリリレーションなし）

#### JSON-LD 整合確認

現状の `DefinedTermJsonLd` は `name`, `description`, `category`, `url` を渡しており問題なし。
`reading` フィールドを `alternateName` として `DefinedTermJsonLd` に追加すると SEO 的に有益。
backend にデータ要件の確認は不要（フィールドは既に取得済み）。

---

### 3-3. 製品詳細ページ（`/pesticides/products/[slug]`）

#### 追加セクション一覧

| # | セクション名 | 追加する表示内容 | 参照フィールド | 備考 |
|---|------------|----------------|-------------|------|
| A | 同一成分の他製品（横断リンク） | 「この製品と同じ成分を含む薬剤」として成分ごとにリンク | `Pesticide.ingredients[].activeIngredient.slug`（成分詳細ページへ）| 成分詳細ページ（`/pesticides/ingredients/[slug]`）は既に実装済み。そこへの内部リンクを追加するだけ |
| B | MAFF 未検証バッジ | `registrationNumber` が null の場合に警告バッジ表示 | `Pesticide.registrationNumber`（null か否か） | `prisma/validation/PROCESS.md` Step 2b の方針に準拠。「MAFF 未検証」のバッジを `PesticideDisclaimer` 近辺に配置 |
| C | 同一剤型の製品リンク | 「同じ剤型の薬剤を見る」 | `Pesticide.formulationType.code` | `/pesticides/formulations/{code}` への内部リンク（`buildPesticideFormulationsPath` が既に存在） |

**データ不在のため今回のスコープ外:**
- 希釈倍率・散布量: `Pesticide` モデルに希釈倍率フィールドなし。追加する場合は MAFF 登録ラベルで裏取りが必要（MAFF 未検証のリスクが高い）
- 使用時期・散布回数: 同上、DB フィールドなし
- ユーザーレビュー・使用感: `Pesticide` にレビュー機能なし（将来機能）

#### 製品詳細ページ内での追加配置位置

```
[パンくず + 商品名 + タイプバッジ]
  → ここに MAFF未検証バッジを追加（registrationNumber === null の場合）

[農薬免責注意]（既存）

[基本情報セクション]（既存）
  → 剤型の Link の後に「同じ剤型の薬剤を見る」テキストリンクを追加

[成分（原体）セクション]（既存）
  → 各成分行はすでに /pesticides/ingredients/[slug] へのリンクになっている（変更不要）
  → セクション下部に「成分ページでは同じ成分を含む薬剤を一覧できます」の案内テキストを追加

[混用不可セクション]（既存）

[効果のある病害虫セクション]（既存）
```

#### MAFF 未検証バッジ仕様

```
variant: warning に準じた amber 系バッジ
text: 「MAFF 登録番号 未確認」
icon: AlertTriangle (lucide-react、既存で import 済み)
tooltip/補足: 「この製品の登録情報はMAFFで未確認です。使用前に農林水産省の農薬登録情報提供システムでご確認ください。」
link: href="https://pesticide.maff.go.jp/" target="_blank" rel="noopener noreferrer"
```

---

## 4. データの流れと参照フィールド早見表

### 4-1. 病害虫詳細

| 表示項目 | DB モデル | フィールド | 取得済みか |
|---------|---------|---------|---------|
| 体長（min/max） | `DiseasePest` | `bodySizeMinMm`, `bodySizeMaxMm` | `getDiseasePestBySlug` は `findUnique` だが現状 select していない → **追加 select 必要** |
| カテゴリ | `DiseasePest` | `category` | 取得済み |
| 効果薬剤数 | `PesticideEffect[]` | `effects.length` | 取得済み |

**backend に要相談:** `getDiseasePestBySlug` の `findUnique` の `include` に `bodySizeMinMm`, `bodySizeMaxMm` を追加する必要がある。現状の `include` は `effects { select { ... } }` のみで `DiseasePest` 本体フィールドは全取得されるため、実際には Prisma がデフォルトで全フィールドを取得している。`findUnique` のデフォルト動作を確認の上で実装すること。

### 4-2. 辞典詳細

| 表示項目 | DB モデル | フィールド | 取得済みか |
|---------|---------|---------|---------|
| 用語 | `BonsaiTerm` | `term` | 取得済み |
| 読み | `BonsaiTerm` | `reading` | 取得済み |
| 説明 | `BonsaiTerm` | `description` | 取得済み |
| カテゴリ | `BonsaiTerm` | `category` | 取得済み |
| sortOrder | `BonsaiTerm` | `sortOrder` | `getAdjacentTerms` 経由で間接取得可 |

### 4-3. 製品詳細

| 表示項目 | DB モデル | フィールド | 取得済みか |
|---------|---------|---------|---------|
| 登録番号（null チェック用） | `Pesticide` | `registrationNumber` | 取得済み |
| 剤型コード（内部リンク用） | `FormulationType` | `code` | 取得済み（`formulationType.code`） |
| 成分の slug（成分詳細ページへのリンク） | `ActiveIngredient` | `slug` | 取得済み（`ingredients[].activeIngredient.slug`） |

---

## 5. SEO 観点

### 5-1. 既存 JSON-LD との整合

| ページ | 現状の JSON-LD | 今回の変更 |
|--------|--------------|---------|
| 病害虫詳細 | `BreadcrumbJsonLd` のみ | 変更なし（`ProductJsonLd` / `DefinedTermJsonLd` は対象外） |
| 辞典詳細 | `DefinedTermJsonLd`（name, description, category, url） | `alternateName: term.reading` を追加することを提案 |
| 製品詳細 | `ProductJsonLd`（name, description, url, category, productID, additionalProperties） | 変更なし。`productID` は `registrationNumber` で正しく設定済み |

### 5-2. 内部リンクによる回遊改善

今回追加するリンクの種類と効果:

| リンク | 追加ページ | 遷移先 | 効果 |
|--------|----------|-------|-----|
| 体長絞り込み | 病害虫詳細 | `/pesticides/diseases-pests?bodySizeMm={value}` | 同サイズ帯の害虫発見を支援 |
| カテゴリ一覧 | 病害虫詳細 | `/pesticides/diseases-pests?category={cat}` | カテゴリページへの PageRank 分散 |
| 成分詳細 | 製品詳細 | `/pesticides/ingredients/[slug]` | 既存リンク（変更なし・確認のみ） |
| 剤型フィルター | 製品詳細 | `/pesticides/formulations/{code}` | 同剤型製品への横断 |

---

## 6. コンポーネント分割と Server / Client 判定

### 6-1. 病害虫詳細 — 追加コンポーネント

| コンポーネント名 | 配置先 | Server / Client | 役割 |
|---------------|--------|--------------|-----|
| `BodySizeDisplay` | `components/pesticide/BodySizeDisplay.tsx` | Server | bodySizeMinMm / bodySizeMaxMm を受け取りテキスト表示する純粋表示コンポーネント |

props:
```
type BodySizeDisplayProps = {
  minMm: number | null
  maxMm: number | null
}
```

### 6-2. 辞典詳細 — 追加コンポーネント

| コンポーネント名 | 配置先 | Server / Client | 役割 |
|---------------|--------|--------------|-----|
| `TermDescriptionExpanded` | `components/dictionary/TermDescriptionExpanded.tsx` | Client | 長文の description を折りたたみ展開するインタラクティブコンポーネント |

props:
```
type TermDescriptionExpandedProps = {
  description: string
  collapseThreshold?: number  // デフォルト 500 文字
}
```

description が `collapseThreshold` 以下の場合は展開ボタンを表示せず全文表示する。
`useState` で `expanded` を管理するため Client Component。

### 6-3. 製品詳細 — 追加コンポーネント

| コンポーネント名 | 配置先 | Server / Client | 役割 |
|---------------|--------|--------------|-----|
| `MaffUnverifiedBadge` | `components/pesticide/MaffUnverifiedBadge.tsx` | Server | registrationNumber が null の場合に表示する警告バッジ（純粋表示） |

props:
```
type MaffUnverifiedBadgeProps = {
  show: boolean  // registrationNumber === null のとき true
}
```

---

## 7. エッジケース

| ケース | 挙動 |
|--------|------|
| `bodySizeMinMm` / `bodySizeMaxMm` が両方 null | `BodySizeDisplay` は何も表示しない（`null` を許容した設計） |
| `bodySizeMinMm === bodySizeMaxMm` | 「約 {N} mm」と表示 |
| 辞典 description が 0 文字 | `TermDescriptionExpanded` は展開制御なしで空表示 |
| 製品に成分（ingredients）が 0 件 | 成分セクション自体を非表示（既存実装） |
| MAFF 未検証バッジが表示される製品で incompatibleWith が空 | 両セクション独立表示（干渉なし） |
| 体長絞り込みリンク先のクエリパラメータが未実装 | リンクを追加するだけにとどめ、一覧ページ側で `bodySizeMm` クエリ対応が完了してから有効化する（backend に要相談） |

---

## 8. 既存との一貫性メモ

| 要素 | 流用元 |
|------|--------|
| セクション見出し + アイコン のスタイル | `PesticideDetailPage` の `<div className="w-7 h-7 rounded-md flex items-center justify-center bg-primary/10 text-primary">` パターン |
| 内部リンクカード（hover 効果） | `DictionaryTermPage` の関連用語リンク `rounded-lg border border-border p-3 hover:border-primary/50 hover:bg-muted/50` |
| 警告バッジ スタイル | 製品詳細の耐性リスク `bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300` |
| `buildPesticideFormulationsPath` | `lib/constants/path-builders` に既存（製品詳細ページで既に import 済み） |
| `DefinedTermJsonLd` | `components/seo/JsonLd`（辞典詳細ページで既に使用） |
| `BreadcrumbJsonLd` | `components/seo/BreadcrumbJsonLd`（病害虫・製品詳細ページで使用） |

---

## 9. 実装上の注意点

1. **`bodySizeMinMm` / `bodySizeMaxMm` の取得確認:**
   `getDiseasePestBySlug` は `findUnique` を使っており、`include` 指定がない本体フィールドは
   Prisma がデフォルトで返す。`bodySizeMinMm` が戻り値の型に含まれているか `ReturnType` を確認してから
   ページ側でアクセスすること。型エラーが出る場合は `select` に明示的に追加する（lib/actions/pesticide.ts の `getDiseasePestBySlug` 修正）。

2. **MAFF 未検証バッジの表示条件の精査:**
   `maff-reference-pending.csv` に記載の約 52 件が `registrationNumber === null` と一致するかは
   seed データで確認が必要。登録番号は持っているが MAFF で未確認の製品も存在する可能性があるため、
   厳密に言えば「registrationNumber === null」ではなく `isVerified` 相当のフラグが理想。
   ただし現状 DB にそのフラグは存在しない。`registrationNumber === null` でのバッジ表示を暫定仕様とし、
   将来的な `isVerified` フィールド追加は別タスクとする（backend に要相談）。

3. **辞典 `TermDescriptionExpanded` の SSR 考慮:**
   Client Component だが、初期表示は折りたたみ状態でよい。
   SEO クローラーは JS を実行しないため、全文を HTML に含めつつ CSS で視覚的に折りたたむか、
   JS で展開する実装にすること（`hidden` 属性ではなく `max-height` + `overflow-hidden` を推奨）。

4. **体長絞り込みリンクの URL:**
   一覧ページ（`/pesticides/diseases-pests`）が `bodySizeMm` クエリを受け付ける実装は
   `lib/actions/pesticide.ts` の `getDiseasePests` では対応済み（`bodySizeMm` パラメータあり）。
   一覧ページの URL クエリパース側の実装状況を確認してからリンクを有効化すること。
