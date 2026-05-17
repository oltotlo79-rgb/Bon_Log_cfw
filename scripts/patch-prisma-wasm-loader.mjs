#!/usr/bin/env node
/**
 * @file scripts/patch-prisma-wasm-loader.mjs
 *
 * Prisma 6 client が Cloudflare Workers で動かない問題への対策パッチ。
 *
 * ## 背景
 *
 * `engineType = "client"` で生成された `.prisma/client/wasm-worker-loader.mjs` は:
 *     export default import('./query_compiler_bg.wasm')
 * と、`.wasm` ファイルの動的 import を行う。
 *
 * OpenNext for Cloudflare の esbuild は `.wasm` を `external` でマークし
 * 静的 path に変換するが、Workers ランタイムには filesystem が無いため
 * `import('/path/to/file.wasm')` → unenv の `fs.readFileSync` stub →
 * `[unenv] fs.readFileSync is not implemented yet!` で起動時に失敗する。
 *
 * ## 対処
 *
 * `prisma generate` の **直後** に本スクリプトが:
 *   1. `query_compiler_bg.wasm` を読み bytes を Base64 化した sibling JS module を作る
 *   2. `wasm-worker-loader.mjs` / `wasm-edge-light-loader.mjs` を `WebAssembly.compile`
 *      ベースの実装に書き換える (`.wasm` 動的 import を経由しない)
 *
 * これにより esbuild は **通常の JS 文字列** として WASM bytes を bundle に含め、
 * Workers ランタイムで `WebAssembly.compile(Uint8Array)` で安全に instantiate できる。
 *
 * ## 副作用
 *
 * Worker bundle が WASM サイズ (約 2 MB) 分大きくなる。Workers の 10 MB 上限まで
 * は余裕がある (現状の bundle は約 7 MB / gzip)。
 *
 * Phase 5 で `provider = "prisma-client"` (Prisma 6.7+ TypeScript-first 生成、WASM 不要)
 * への移行を検討する。それまでは本パッチで凌ぐ。
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const PRISMA_CLIENT_DIR = path.join('node_modules', '.prisma', 'client')
const WASM_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_bg.wasm')
const BASE64_MODULE_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_bg.wasm.base64.mjs')
const WORKER_LOADER_PATH = path.join(PRISMA_CLIENT_DIR, 'wasm-worker-loader.mjs')
const EDGE_LOADER_PATH = path.join(PRISMA_CLIENT_DIR, 'wasm-edge-light-loader.mjs')

const PATCH_MARKER = '// AUTO-PATCHED-BY: scripts/patch-prisma-wasm-loader.mjs'

if (!existsSync(WASM_PATH)) {
  console.log('[patch-prisma-wasm] WASM file not found at', WASM_PATH, '- skipping (prisma generate not yet run?)')
  process.exit(0)
}

const existingLoader = existsSync(WORKER_LOADER_PATH) ? readFileSync(WORKER_LOADER_PATH, 'utf-8') : ''
if (existingLoader.includes(PATCH_MARKER)) {
  console.log('[patch-prisma-wasm] already patched, skipping')
  process.exit(0)
}

console.log('[patch-prisma-wasm] reading WASM:', WASM_PATH)
const wasmBytes = readFileSync(WASM_PATH)
const base64 = wasmBytes.toString('base64')
console.log('[patch-prisma-wasm] WASM size:', wasmBytes.byteLength, 'bytes,', base64.length, 'base64 chars')

const base64ModuleContent = `${PATCH_MARKER}
// Generated from query_compiler_bg.wasm. Do not edit directly.
export default ${JSON.stringify(base64)}
`
writeFileSync(BASE64_MODULE_PATH, base64ModuleContent)
console.log('[patch-prisma-wasm] wrote base64 module:', BASE64_MODULE_PATH)

const loaderContent = `${PATCH_MARKER}
// Original: \`export default import('./query_compiler_bg.wasm')\` is incompatible
// with Cloudflare Workers (no fs). Replaced with inline base64 → WebAssembly.compile.
import base64 from './query_compiler_bg.wasm.base64.mjs'

function base64ToUint8Array(b64) {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Prisma の呼び出し側は \`(await loader).default\` で WebAssembly.Module を取り出すため
// \`{ default: <module> }\` 形状の Promise を default export する。
const compiledModulePromise = WebAssembly.compile(base64ToUint8Array(base64)).then((mod) => ({ default: mod }))
export default compiledModulePromise
`

writeFileSync(WORKER_LOADER_PATH, loaderContent)
console.log('[patch-prisma-wasm] patched:', WORKER_LOADER_PATH)

if (existsSync(EDGE_LOADER_PATH)) {
  writeFileSync(EDGE_LOADER_PATH, loaderContent)
  console.log('[patch-prisma-wasm] patched:', EDGE_LOADER_PATH)
}

console.log('[patch-prisma-wasm] done')
