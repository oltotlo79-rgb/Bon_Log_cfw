# prisma/scripts/ — 本番マスタデータ ピンポイント修正の標準手順

農薬・肥料・ホルモン・辞書などの **マスタ / コンテンツデータ** を本番 DB でピンポイント修正するための、
安全なワンショットスクリプトの書き方・実行手順をまとめる。

## 目次

- [いつ使うか](#いつ使うか)
- [なぜ `npm run db:seed` を本番で使わないか](#なぜ-npm-run-dbseed-を本番で使わないか)
- [標準パターン](#標準パターン)
- [ファイル構成](#ファイル構成)
- [接続設定](#接続設定)
- [実行手順](#実行手順)
- [新しいスクリプトの作り方](#新しいスクリプトの作り方)
- [適用前チェックリスト](#適用前チェックリスト)
- [後処理](#後処理)
- [命名規約](#命名規約)

## いつ使うか

- 本番の master / コンテンツデータ（農薬・肥料・ホルモン・辞書等）に登録された
  **特定レコードの誤りを修正したい**とき。
- 対象は基本的に ID 不変な参照データ（`slug` を持つテーブル）。ユーザー投稿・アカウント等の
  可変データには使わない（それらは通常の Server Action / admin 機能で扱う）。

## なぜ `npm run db:seed` を本番で使わないか

`prisma/seed.ts` とその配下（`prisma/seed/*`）は **開発用データを毎回ゼロから再構築する**
ことを目的とした破壊的スクリプトである。

- `prisma/seed/fertilizer/seed-fertilizer-data.ts` は `fertilizationPlan` / `treeSpecies` /
  `fertilizerNutrient` / `fertilizerCategory` / `fertilizerColumn` を **`$transaction` に
  包まず** 順番に `deleteMany()` する。途中で失敗すると一部だけ消えた不整合状態が残る
  （非原子的）。
- `prisma/seed/pesticide/seed-pesticide-data.ts` は `$transaction` 内ではあるが、
  対象テーブルを **全件 `deleteMany()` してから全件作り直す**。本番で実行すると、
  シードスクリプトに書かれていない過去の追加データ・手動修正が全て消える。

つまり「1 件だけ直したい」という目的に対して、seed は影響範囲が大きすぎる。
本ディレクトリのワンショットスクリプトは、**対象レコードだけ**を `update` / `upsert` し、
全件削除は一切行わない。

## 標準パターン

新しいワンショット適用スクリプトは、次の性質を必ず満たすこと（`_template-oneshot-apply.ts` 参照）。

- **デフォルト dry-run**: 引数なしで実行すると読み取りのみ。`--apply` を渡したときだけ書き込む。
- **単一トランザクション**: 全ての書き込みは 1 回の `prisma.$transaction` 内で行う（部分適用を防ぐ）。
- **冪等**: 既に正しい値であれば「変更なし」と表示し、再実行しても同じ結果になる。
- **fail-closed**: 対象レコードが存在しない場合は `create` で新規作成せず、エラーで停止する
  （想定外のレコードを本番に生成しないため）。
- **限定的な削除**: 全件 `deleteMany()` は使わない。削除は `slug` / `id` 等の具体的なキーで絞り込む。
- **接続先の目視確認**: 実行直後に「接続先 (masked)」を表示し、実行者が本番ホストを目視確認できるようにする。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `lib/prod-apply-client.ts` | 接続解決・マスク表示・`--apply` 判定の共有ヘルパー |
| `_template-oneshot-apply.ts` | 新規スクリプト作成用の雛形（対象は空、そのまま実行しても安全） |
| `apply-validation-fixes-2026-07.ts` | 実例（2026-07 農薬・肥料検証で確定した修正を本番適用済み） |
| `check-counts.ts` | 各マスタテーブルの件数を確認するユーティリティ（`.env.local` 前提） |

## 接続設定

`.env.production`（gitignore 済み、コミット禁止）に本番の接続情報を登録する。

```
DATABASE_URL="postgresql://...（pooler 経由、通常運用向け）"
DIRECT_URL="postgresql://...（非プーリング直接接続）"
```

- ワンショットスクリプトは **`DIRECT_URL` を優先**する。prepared statement を使うため、
  PgBouncer 等のトランザクションプーリング経由だと衝突する可能性があるため。
- Direct 接続（`db.<ref>.supabase.co`）が IPv4 環境から届かない場合は、Supabase の
  **Session pooler**（Transaction pooler は不可。prepared statement と非互換）の接続文字列を
  `DATABASE_URL` / `DIRECT_URL` に設定する。

## 実行手順

`.env.production` に接続情報を登録済みであれば、環境変数の手動設定は不要でそのまま実行できる。

### PowerShell

```powershell
# 1. dry-run（既定・書き込みなし）— 必ず先に実行し、「接続先 (masked)」が本番ホストか目視確認する
npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts

# 2. dry-run の差分内容を確認し、意図通りであれば --apply で反映
npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts --apply

# 3. 冪等性の確認として、もう一度 dry-run し「変更なし」になることを確認
npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts
```

シェルで `$env:DATABASE_URL` / `$env:DIRECT_URL` を明示的に設定して実行した場合は、
そちらが `.env.production` より優先される。実行後は必ず後片付けする。

```powershell
$env:DIRECT_URL = "postgresql://...本番接続文字列..."
npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts
Remove-Item Env:DIRECT_URL
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

### bash

```bash
# 1. dry-run
npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts

# 2. 適用
npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts --apply

# 3. 冪等性確認
npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts
```

シェル変数を明示する場合:

```bash
DIRECT_URL="postgresql://...本番接続文字列..." npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts
```
（コマンド先頭に付ける形なら、そのプロセスだけに環境変数が渡り後片付け不要）

`.env.local` は本パターンのスクリプトでは読み込まない（`lib/prod-apply-client.ts` の設計）。
ローカル DB に対して検証したい場合は、上記のようにシェル環境変数を明示的に渡すこと。

## 新しいスクリプトの作り方

1. `_template-oneshot-apply.ts` を `apply-<topic>-<yyyy-mm>.ts` としてコピーする。
2. 対象レコードと「正しい値」を定数として記入する。**出典（MAFF 登録番号 / 公式サイト URL 等）を
   必ずコメントで残す**（`.claude/rules/pesticide-validation.md` 準拠。農薬・病害虫データの場合は
   MAFF 公式で必ず裏取りする。LLM の出力を鵜呑みにしない）。
3. plan 関数（読み取りのみ）・apply 関数（`$transaction` 内で書き込み）・検証関数を実装する。
4. **使い捨てローカル DB で検証する**（本番に触る前に必須）。
   ```bash
   docker run -d --name scratch-pg-verify \
     -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=verify_db \
     -p 127.0.0.1:55432:5432 postgres:16-alpine

   DATABASE_URL="postgresql://postgres:postgres@localhost:55432/verify_db" \
   DIRECT_URL="postgresql://postgres:postgres@localhost:55432/verify_db" \
     npx prisma db push --accept-data-loss --skip-generate

   # 対象テーブルに「旧値（誤り）」のレコードを用意する
   #   - 本物の .env.local を使った npm run db:seed は create-client.ts が
   #     .env.local を override:true で強制上書きするため、この検証目的には使いにくい。
   #     対象テーブルだけを直接 upsert する小さな一時スクリプトを書くのが確実。

   DATABASE_URL="postgresql://postgres:postgres@localhost:55432/verify_db" \
   DIRECT_URL="postgresql://postgres:postgres@localhost:55432/verify_db" \
     npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts            # dry-run で差分確認
   DATABASE_URL="postgresql://postgres:postgres@localhost:55432/verify_db" \
   DIRECT_URL="postgresql://postgres:postgres@localhost:55432/verify_db" \
     npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts --apply    # 適用
   DATABASE_URL="postgresql://postgres:postgres@localhost:55432/verify_db" \
   DIRECT_URL="postgresql://postgres:postgres@localhost:55432/verify_db" \
     npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts            # 再度 dry-run し「変更なし」を確認

   docker rm -f scratch-pg-verify   # 後片付け
   ```
5. ローカル検証で dry-run 差分・`--apply` 後の冪等性が期待通りであることを確認したら、
   本番 `.env.production` で dry-run → 目視確認 → `--apply` → dry-run（冪等確認）の順に進める。

## 適用前チェックリスト

- [ ] 修正内容の出典を確認した（MAFF 公式サイト・メーカー公式サイト等）
- [ ] dry-run 実行時に表示される「接続先 (masked)」が意図したホストであることを目視確認した
- [ ] dry-run の差分表示が意図通り（想定件数・想定内容と一致）であることを確認した
- [ ] 書き込みが単一の `$transaction` にまとまっている
- [ ] 対象不在時に create せず fail-closed で停止することを確認した
- [ ] 削除は全件 `deleteMany()` ではなく具体的なキーで限定されている
- [ ] ロールバック方針を確認した（対象レコードが少数であれば「旧値を定数として残し、
      逆方向の apply スクリプトで戻せる」程度で十分。大規模変更なら事前に
      Supabase のバックアップ/PITR の復元手順を確認する）

## 後処理

- 本番接続文字列をシェル環境変数で明示した場合は、作業後に必ず環境変数を削除する
  （`Remove-Item Env:DATABASE_URL` / `unset DATABASE_URL` 等）。
- `.env.production` はコミットしない（`.gitignore` 済み）。内容を貼り付けたログ・チャット・
  Issue を作らない。
- 本番接続情報を誤ってターミナル履歴やスクリーンショットに残した場合は、Supabase の
  DB パスワードをローテーションする。

## 命名規約

新規スクリプトは `prisma/scripts/apply-<topic>-<yyyy-mm>.ts` の形式で作成する
（例: `apply-validation-fixes-2026-07.ts`）。
