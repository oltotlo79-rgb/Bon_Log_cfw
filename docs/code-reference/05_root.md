# ルート・types・設定ファイル 解説

プロジェクトルートの `proxy.ts`、`types/`、`instrumentation.ts`、Next.js・Sentry の設定を解説します。

---

## proxy.ts

**役割**: 全リクエストに対して認証チェック・リダイレクト・セキュリティヘッダー・CSP nonce・メンテナンスモードを適用する。

- **NextAuth**: `NextAuth(authConfig)` の `auth` をラップし、セッションを取得。Edge Runtime で動作。
- **Basic 認証**（オプション）: `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` が設定されていれば、全ルートで Basic 認証を要求。開発・ステージング用。
- **メンテナンスモード**: `/api/maintenance/status` を fetch し、メンテナンス中なら `/maintenance` へリダイレクト。`/api`・`/maintenance`・静的ファイルは除外。
- **認証ガード**: 保護パス（`/feed`, `/posts`, `/settings` 等）で未認証なら `/login` へ。`callbackUrl` に現在パスを付与。ログイン済みが `/login`・`/register` に来たら `/feed` へリダイレクト。
- **CSP**: `generateNonce()` で nonce を生成し、`Content-Security-Policy` の `script-src` に `'nonce-xxx'` を付与。インラインスクリプトには同じ nonce を渡す（layout や providers で nonce を注入）。
- **その他ヘッダー**: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`（HSTS）等を設定。
- **matcher**: `/((?!api|_next/static|_next/image|favicon.ico).*)` で API と静的アセットを除外。

---

## instrumentation.ts

**役割**: Next.js の Instrumentation API で、サーバー起動時に Sentry を初期化する。

- `register()` がサーバー起動時に一度だけ呼ばれる。`Sentry.init`（サーバー用）をここで実行し、DSN や environment を設定。
- クライアント側は `sentry.client.config.ts`、Edge は `sentry.edge.config.ts` で初期化。

---

## next.config.ts

**役割**: Next.js のビルド・ランタイム設定。

- **images**: `remotePatterns` で R2 や外部画像ドメインを許可。`next/image` で最適化して表示するために必要。
- **experimental**: PPR（Partial Prerendering）や serverActions の設定がある場合あり。
- **headers**: セキュリティヘッダーを追加する場合、middleware と重複しないようにする。
- **env**: クライアントに渡す環境変数は `NEXT_PUBLIC_` のみ。それ以外はサーバー専用。

---

## sentry.client.config.ts

**役割**: ブラウザ（クライアント）側の Sentry 初期化。

- `Sentry.init` で DSN・environment・tracesSampleRate・replaysSessionSampleRate 等を設定。
- クライアントで発生したエラー・パフォーマンストレースが Sentry に送信される。

---

## sentry.server.config.ts

**役割**: サーバー側（Node.js）の Sentry 初期化。

- サーバーコンポーネントや API Route、Server Actions 内のエラーをキャッチして送信。
- `instrumentation.ts` から呼ぶか、このファイルを Sentry が自動読み込みする構成。

---

## sentry.edge.config.ts

**役割**: Edge Runtime（middleware 等）用の Sentry 初期化。

- Edge では Node の API が使えないため、Edge 用の SDK で初期化する。

---

## types/action-result.ts

**役割**: Server Actions の戻り値用の共通型とヘルパー。

- **ActionResult&lt;T&gt;**  
  `{ ok: true; data: T } | { ok: false; error: string }`。  
  成功時は `data`、失敗時は `error` を返す形式。
- **actionSuccess(data)**  
  `{ ok: true, data }` を返す。
- **actionError(message)**  
  `{ ok: false, error: message }` を返す。

新規・修正する Server Actions ではこの形の返却が推奨。既存の `lib/actions/utils.ts` の `ActionResult`（`success`/`data`）と併存しているため、どちらかに統一するか、段階的に移行する。

---

## types/next-auth.d.ts

**役割**: NextAuth の Session 型を拡張し、`session.user.id` を型安全に使えるようにする。

- `declare module 'next-auth'` で `Session` の `user` に `id: string` を追加。
- `auth()` の戻り値で `session.user.id` が string として認識される。

---

以上がルート・types・設定ファイルの解説です。  
認証の詳細は [01_lib.md](./01_lib.md#auth) の auth.ts、Server Actions の返却形式は [02_lib_actions.md](./02_lib_actions.md#utils) の utils.ts を参照してください。
