---
globs: "lib/auth.ts, lib/auth.config.ts, app/api/auth/**/*.ts, types/next-auth.d.ts, components/auth/**/*.tsx, app/(auth)/**/*.tsx, app/providers.tsx"
---

# NextAuth.js (Auth.js v5) ルール

## 構成ファイル

| ファイル | 役割 |
|---------|------|
| `lib/auth.ts` | NextAuth設定本体（プロバイダー、コールバック、登録関数） |
| `lib/auth.config.ts` | Edge Runtime互換の設定（proxy.tsから使用） |
| `types/next-auth.d.ts` | Session型拡張（`id`, `isAdmin`） |
| `app/api/auth/[...nextauth]/route.ts` | `handlers` のエクスポート |
| `app/providers.tsx` | `SessionProvider` ラッパー |

## 認証チェックパターン

```typescript
// Server Actionでの認証
import { auth } from '@/lib/auth'

const session = await auth()
if (!session?.user?.id) return actionError(ERR_AUTH_REQUIRED)
```

## セッション戦略

- **JWT戦略** (`session: { strategy: 'jwt' }`)
- `jwt` コールバックで `token.id` にユーザーIDを格納
- `session` コールバックで `session.user.id` に展開

## プロバイダー

- **Credentials**: メール/パスワード + bcrypt（ソルトラウンド12）
- **Google OAuth**: `allowDangerousEmailAccountLinking: true`

## Proxy連携

- `proxy.ts` で `auth()` を使って保護ルートを判定
- 保護パス: `PROTECTED_PATHS` (lib/constants/routes.ts)
- 認証ページ: ログイン済みは `/feed` にリダイレクト
