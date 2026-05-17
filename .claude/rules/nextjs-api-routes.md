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
  - Bearer: `Authorization: Bearer <CRON_SECRET>` — Vercel Cron の標準仕様（GET のみ）
  - HMAC: `Authorization: HMAC <sig>` + `X-Cron-Timestamp` — 外部スケジューラ用、リプレイ攻撃耐性あり
- `vercel.json` でスケジュール定義
- HMAC を強制したい場合は `DISABLE_LEGACY_CRON_AUTH=true` を設定して Bearer を無効化する

## Webhook

- Stripe: `stripe.webhooks.constructEvent()` で署名検証
- べき等性チェック（重複処理防止）
