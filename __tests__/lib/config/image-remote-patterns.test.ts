// @vitest-environment node

/**
 * `buildImageRemotePatterns` の回帰テスト。
 *
 * 守るべき不変条件:
 *   1. `next build` (CI / Lighthouse / ローカル smoke) を NODE_ENV=production だけで
 *      落とさない。判定は VERCEL_ENV を見る。
 *   2. Vercel 本番で R2 hostname を導出できれば wildcard fallback を付けない (strict)。
 *   3. R2_PUBLIC_URL / R2_BUCKET_NAME+R2_ACCOUNT_ID から hostname を自動導出できる
 *      (新たに R2_PUBLIC_HOSTNAME 環境変数を要求しない)。
 *   4. R2 を一切設定していない本番 (STORAGE_PROVIDER=local/supabase) でも build が通る。
 */

import { describe, it, expect } from 'vitest'
import { buildImageRemotePatterns } from '@/lib/config/image-remote-patterns'

describe('buildImageRemotePatterns', () => {
  describe('Vercel 本番デプロイ (VERCEL_ENV=production)', () => {
    it('R2_PUBLIC_HOSTNAME 明示指定: 厳密パターンのみで wildcard fallback は付かない', () => {
      const patterns = buildImageRemotePatterns({
        VERCEL_ENV: 'production',
        R2_PUBLIC_HOSTNAME: 'cdn.bon-log.example.com',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === 'cdn.bon-log.example.com')).toBe(true)
      expect(patterns.some((p) => p.hostname === '*.r2.dev')).toBe(false)
      expect(patterns.some((p) => p.hostname === '*.r2.cloudflarestorage.com')).toBe(false)
    })

    it('R2_PUBLIC_URL から hostname を自動導出する (新 env var を要求しない)', () => {
      const patterns = buildImageRemotePatterns({
        VERCEL_ENV: 'production',
        R2_PUBLIC_URL: 'https://cdn.bon-log.example.com',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === 'cdn.bon-log.example.com')).toBe(true)
      expect(patterns.some((p) => p.hostname === '*.r2.dev')).toBe(false)
    })

    it('R2_PUBLIC_HOSTNAME は R2_PUBLIC_URL より優先する', () => {
      const patterns = buildImageRemotePatterns({
        VERCEL_ENV: 'production',
        R2_PUBLIC_HOSTNAME: 'explicit.example.com',
        R2_PUBLIC_URL: 'https://from-url.example.com',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === 'explicit.example.com')).toBe(true)
      expect(patterns.some((p) => p.hostname === 'from-url.example.com')).toBe(false)
    })

    it('R2_BUCKET_NAME + R2_ACCOUNT_ID から {bucket}.{account}.r2.dev を導出する', () => {
      // r2-provider.ts の `R2_PUBLIC_URL` 未設定時のデフォルト URL と一致させる。
      const patterns = buildImageRemotePatterns({
        VERCEL_ENV: 'production',
        R2_BUCKET_NAME: 'mybucket',
        R2_ACCOUNT_ID: 'abc123',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === 'mybucket.abc123.r2.dev')).toBe(true)
      expect(patterns.some((p) => p.hostname === '*.r2.dev')).toBe(false)
    })

    it('R2 を一切設定していない本番 (STORAGE_PROVIDER=local/supabase) でも throw せず wildcard fallback を付ける', () => {
      // 旧実装は throw していたため Vercel deploy が落ちる回帰を起こした。
      // R2 を運用していない本番では他ストレージの URL を使うため、wildcard を残しても
      // 実害はない (R2 の URL は本番には現れない)。
      const patterns = buildImageRemotePatterns({
        VERCEL_ENV: 'production',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === '*.r2.dev')).toBe(true)
      expect(patterns.some((p) => p.hostname === '*.r2.cloudflarestorage.com')).toBe(true)
    })

    it('不正な R2_PUBLIC_URL は無視して wildcard fallback で build を継続する', () => {
      const patterns = buildImageRemotePatterns({
        VERCEL_ENV: 'production',
        R2_PUBLIC_URL: 'not-a-url',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === '*.r2.dev')).toBe(true)
    })

    it('R2_CUSTOM_HOSTNAME 単独でも厳密パターンを付ける', () => {
      const patterns = buildImageRemotePatterns({
        VERCEL_ENV: 'production',
        R2_PUBLIC_URL: 'https://cdn.example.com',
        R2_CUSTOM_HOSTNAME: 'custom.r2.example.com',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === 'cdn.example.com')).toBe(true)
      expect(patterns.some((p) => p.hostname === 'custom.r2.example.com')).toBe(true)
      expect(patterns.some((p) => p.hostname === '*.r2.cloudflarestorage.com')).toBe(false)
    })
  })

  describe('CI smoke build / Lighthouse / Vercel preview / local (VERCEL_ENV != production)', () => {
    it('NODE_ENV=production 単独では throw しない (CI 回帰のクリティカルケース)', () => {
      // `next build` は smoke build でも NODE_ENV=production を強制するため、
      // ここで throw すると CI / Lighthouse / ローカル `next build` が必ず落ちる。
      expect(() =>
        buildImageRemotePatterns({
          NODE_ENV: 'production',
        } as NodeJS.ProcessEnv),
      ).not.toThrow()
    })

    it('R2 環境変数なし: wildcard fallback で build が通る', () => {
      const patterns = buildImageRemotePatterns({
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === '*.r2.dev')).toBe(true)
      expect(patterns.some((p) => p.hostname === '*.r2.cloudflarestorage.com')).toBe(true)
    })

    it('VERCEL_ENV=preview: wildcard fallback を許容する', () => {
      const patterns = buildImageRemotePatterns({
        VERCEL_ENV: 'preview',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === '*.r2.dev')).toBe(true)
    })

    it('R2_PUBLIC_HOSTNAME 設定時は wildcard より優先するが、custom 側の wildcard fallback は残す', () => {
      const patterns = buildImageRemotePatterns({
        R2_PUBLIC_HOSTNAME: 'cdn.example.com',
      } as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === 'cdn.example.com')).toBe(true)
      // R2_CUSTOM_HOSTNAME は未設定なので fallback wildcard が残る (非本番は柔軟性優先)
      expect(patterns.some((p) => p.hostname === '*.r2.cloudflarestorage.com')).toBe(true)
    })
  })

  describe('Supabase / Unsplash パターン (共通)', () => {
    it('SUPABASE_STORAGE_HOSTNAME を環境変数から拾う', () => {
      const patterns = buildImageRemotePatterns({
        SUPABASE_STORAGE_HOSTNAME: 'project.supabase.co',
      } as NodeJS.ProcessEnv)
      const supabase = patterns.find((p) => p.hostname === 'project.supabase.co')
      expect(supabase).toBeDefined()
      expect(supabase?.pathname).toBe('/storage/v1/object/public/**')
    })

    it('SUPABASE_STORAGE_HOSTNAME 未設定なら *.supabase.co にフォールバック', () => {
      const patterns = buildImageRemotePatterns({} as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === '*.supabase.co')).toBe(true)
    })

    it('Unsplash パターンを常に含む (ランディングページ用の静的 photo URL)', () => {
      const patterns = buildImageRemotePatterns({} as NodeJS.ProcessEnv)
      expect(patterns.some((p) => p.hostname === 'images.unsplash.com')).toBe(true)
    })
  })
})
