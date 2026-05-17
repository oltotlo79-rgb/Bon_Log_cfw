# コメント規約

## 原則

**デフォルトはコメントを書かない。** 識別子（関数名・変数名・型名）で意図を表現するのが第一優先。
コメントを書く価値があるのは「コードを読んでも分からない WHY」がある時だけ。

> CLAUDE.md ルート規約より:
> - Default to writing no comments. Only add one when the WHY is non-obvious.
> - Don't explain WHAT the code does, since well-named identifiers already do that.
> - Don't reference the current task, fix, or callers.

このファイルはその原則をプロジェクト固有のパターンに具体化したもの。

## 書くべきコメント (KEEP)

### 1. 隠れた制約・非自明な不変条件
読者が驚く、あるいは「なぜこう書いた？」と思う箇所に **WHY** を書く。

```typescript
// pg_bigm は2文字以上で初めて trigram と一致する。1文字検索は LIKE にフォールバック
if (query.length < 2) return prisma.post.findMany({ where: { content: { contains: query } } })
```

### 2. 外部要因による回避コード
特定のバグ・ライブラリ仕様・ブラウザ挙動への対処は記述する。

```typescript
// Safari 17 で IntersectionObserver が rootMargin を無視するため manual fallback
```

### 3. Server Action パターンのステップ番号 (プロジェクト方針)
`.claude/rules/server-actions.md` の必須パターンを示す番号コメントは **維持する**。
新規 Action でも同形式で書くこと。

```typescript
// 1. 認証
// 2. Zod バリデーション
// 3. レート制限
// 4. ビジネスロジック
```

### 4. ファイルヘッダ JSDoc (`@module`)
モジュール概要を 1〜3 行で示す既存慣習は維持。ただし**1行で説明できないモジュールは設計を見直す**。

```typescript
/**
 * @module lib/storage/index
 * Storage Strategy: 環境変数 STORAGE_PROVIDER で R2 / local を切り替える。
 */
```

### 5. 機械可読ディレクティブ
- `// eslint-disable-next-line <rule>` — 無効化理由を同行に書く
- `// @ts-expect-error <理由>` — 必須
- `'use client'` / `'use server'` — Next.js ディレクティブ（コメントではないが先頭固定）

## 書いてはいけないコメント (REMOVE)

### (a) WHAT コメント — 識別子から自明
```typescript
// ❌ ユーザー一覧を取得
const users = await prisma.user.findMany()

// ❌ ID で投稿を検索
const post = await prisma.post.findUnique({ where: { id } })
```
関数名・変数名で十分伝わるなら書かない。書くなら **WHY**。

### (b) タスク参照・PR 説明
```typescript
// ❌ #1234 対応
// ❌ Issue #567 で報告された不具合の修正
// ❌ レビュー指摘により追加
```
これらは PR 説明・コミットメッセージに書く。コードに残すと腐る。

### (c) 古いコード残骸・移行メモ
```typescript
// ❌ 旧実装では Record<string, unknown> を使っていた
// ❌ TODO: 後で消す
// ❌ 旧キーからのマイグレーション (移行完了後も残っている)
```
git history が真実。完了したらコメントごと削除。

### (d) 過剰な区切りコメント
```typescript
// ❌
// ============================================================
// Helper Functions
// ============================================================

// ❌
// --- query builders ---
```
セクション分けは**空行 1〜2 行**で行う。装飾文字の連発はしない。
ただしファイル先頭の `@module` JSDoc は許容。

### (e) 情報量ゼロの JSDoc
```typescript
// ❌
/** CMS ページ一覧を取得 */
export async function listCmsPages() { ... }
```
関数名で分かることをそのまま書かない。書くなら**引数の制約・戻り値の意味・副作用**を書く。

### (f) ステップ説明 (Server Action 以外)
Server Action の `// 1. 認証` パターンは方針として維持するが、**それ以外の関数で「1. xxx → 2. yyy」を書かない**。
処理を読めば分かる順番を番号で再掲しない。

```typescript
// ❌ 通常のヘルパー関数で
function buildQuery() {
  // 1. ベースクエリ作成
  const base = ...
  // 2. フィルタ適用
  const filtered = ...
  // 3. ソート適用
  return sorted
}
```

### (g) 絵文字付きコメント
✅ ❌ 🚀 🔥 などをコメントに含めない（このルールファイル自体は説明用に使用）。

### (h) コメントアウトされた死んだコード
```typescript
// ❌
// const oldImpl = await legacyFetch(id)
// if (oldImpl) return oldImpl
const result = await newFetch(id)
```
削除する。git history で復元できる。

## 言語

- **日本語**: ビジネスロジック・ドメイン知識の説明
- **英語**: 純技術的な参照（ライブラリ名・RFC 番号・URL 等）
- **混在は OK** だが、1 コメント内では統一する

## レビュー時のチェック項目

PR レビュー / セルフレビュー時に以下を確認:

- [ ] そのコメントを消したら読者が困るか？ → No なら消す
- [ ] 関数名・変数名で表現できないか？ → できるなら命名で解決
- [ ] WHY が書かれているか？ WHAT のみなら削る
- [ ] PR 説明に書くべき内容（issue 番号・修正経緯）になっていないか？
- [ ] git log で分かる情報を再掲していないか？

## 既存コードの扱い

過去のコメントで本規約に反するものが残っていても、**触っているファイルでなければ機械的に削除しない**。
編集する際にその箇所のコメントが規約違反であれば**ついでに整える**こと。
