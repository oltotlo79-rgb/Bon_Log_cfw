import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Coverage reports
    "coverage/**",
    // Temporary / one-off scripts (not application code)
    "tmp/**",
    // Git worktrees (Claude Code temporary branches)
    ".claude/worktrees/**",
    ".clone/**",
    // Utility / migration scripts (not application code)
    "scripts/**",
    // Root-level utility scripts (all deleted; keep pattern for future one-off scripts)
    "*.cjs",
  ]),
  // Custom rules
  {
    rules: {
      // アンダースコアで始まる変数は未使用でも許可
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "sort-imports": ["warn", { ignoreCase: true, ignoreDeclarationSort: true, ignoreMemberSort: true }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      // CLAUDE.md ルール8「any 禁止」を CI で機械強制する（テストファイルは下のブロックで緩和）
      "@typescript-eslint/no-explicit-any": "error",
      // Supabase Data API (supabase-js / PostgREST / GraphQL) は非使用方針。
      // DB アクセスは Prisma 経由のみ。詳細は .claude/rules/prisma-database.md
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/supabase-js", "@supabase/auth-helpers-*", "@supabase/ssr"],
              message:
                "Supabase Data API (supabase-js / PostgREST / GraphQL) は使用禁止。DB アクセスは Prisma 経由のみ。詳細は .claude/rules/prisma-database.md",
            },
          ],
        },
      ],
    },
  },
  // ロガーファイルではconsole使用を許可（ロガー自体の実装に必要なため）
  {
    files: ['lib/logger.ts', 'lib/client-logger.ts', 'lib/security-logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // Prisma seed ファイルは CLI スクリプトなので console 出力を許可
  {
    files: ['prisma/seed/**/*.ts', 'prisma/seed.ts', 'prisma/check-counts.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  // テストファイルでは any 型を許可（モック定義に必要なため）
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);

export default eslintConfig;
