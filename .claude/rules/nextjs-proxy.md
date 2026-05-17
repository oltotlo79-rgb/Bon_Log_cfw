---
globs: "proxy.ts"
---

# Proxy ルール (Next.js 16)

## 概要

`proxy.ts` は Next.js 16 で `middleware.ts` に代わるファイル。Edge Runtime で実行される。

## 責務

1. **認証チェック**: 保護ルートへの未認証アクセスをリダイレクト
2. **セキュリティヘッダー**: CSP (nonce付き), HSTS, X-Frame-Options, CORS
3. **Origin検証**: Server ActionsのCSRF保護
4. **メンテナンスモード**: Redis (30秒キャッシュ) で状態管理
5. **管理者ルート保護**: `/admin/*` は `isAdmin` チェック

## 実装パターン

```typescript
import { auth } from '@/lib/auth'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  // 保護ルートへの未認証 → /login にリダイレクト
  // 認証済みで /login → /feed にリダイレクト
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
```

## 注意

- Edge Runtime制約: Node.js API (`fs`, `crypto` の一部) は使用不可
- ルート定数は `lib/constants/routes.ts` の `PROTECTED_PATHS` を参照（公開ページは PROTECTED_PATHS に含まれない = deny-list 方式）
- `lib/auth.config.ts` の `authorized` callback は常に `true` を返し、認可判定は proxy.ts に一本化（NextAuth 既定リダイレクトでは `callbackUrl` を付与できないため）
