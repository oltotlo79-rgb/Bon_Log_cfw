---
globs: "app/api/**/*.ts, app/api/**/*.tsx"
---

# API Routes (Route Handlers) ルール

## 使い分け

- **Server Actions優先** — フォーム送信・データ変更
- **Route Handlers** — 外部連携、Webhook、Cronジョブ、ファイルアップロード

## 規約

- `app/api/` 配下に `route.ts` を作成
- HTTPメソッドごとに関数をエクスポート (`GET`, `POST`, `PUT`, `DELETE`)

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  return NextResponse.json(data)
}

// Dynamic Route
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
}
```

## Cronジョブ

- `verifyCronAuth()` で認証。以下の 2 方式を受け付ける:
  - Bearer: `Authorization: Bearer <CRON_SECRET>` — GitHub Actions cron / Vercel Cron 互換（GET のみ）
  - HMAC: `Authorization: HMAC <sig>` + `X-Cron-Timestamp` — 外部スケジューラ用、リプレイ攻撃耐性あり
- スケジュールは `.github/workflows/cron.yml`（fly.io 本番の実駆動）/ `vercel.json` で定義
- HMAC を強制したい場合は `DISABLE_LEGACY_CRON_AUTH=true` を設定して Bearer を無効化する

## Webhook

- Stripe: `stripe.webhooks.constructEvent()` で署名検証
- べき等性チェック（重複処理防止）

## proxy.ts との関係 (重要)

`proxy.ts` は `API_PREFIX` (`/api/*`) パスを **Basic 認証から除外**する設計。
これは webhook / 外部連携 / cron に対し Basic を要求しないための意図的な分岐であり、
**API route の保護責任は route handler 内に集約される**。

new API route を追加する際は必ず以下を route 内で確認すること:

- [ ] 認証: 公開 webhook 以外は `auth()` または `verifyCronAuth()` 等で identity を確認
- [ ] 認可: ユーザー固有リソースなら `userId` 一致 / `requireAdmin` で gate
- [ ] 入力検証: Zod safeParse でクエリ・ボディを検証
- [ ] レート制限: `enforceUserRateLimit` または route-specific token bucket
- [ ] 署名検証: webhook なら `constructEvent` / HMAC / Bearer 比較
- [ ] べき等性: 同 event 二重処理を防ぐ guard

これら全てが proxy で守られない以上、route handler は **fail-closed の最終防衛線** として
振る舞う必要がある。
