#!/usr/bin/env node
/**
 * @file scripts/patch-prisma-wasm-loader.mjs
 *
 * Prisma 6 client が Cloudflare Workers で動かない問題への対策パッチ。
 *
 * ## 背景
 *
 * `.prisma/client/wasm.js` の `config.compilerWasm.getQueryCompilerWasmModule()` が
 *     const loader = (await import('#wasm-compiler-loader')).default
 *     const compiler = (await loader).default
 * という流れで subpath import `#wasm-compiler-loader` を経由し、最終的に
 * `wasm-worker-loader.mjs` の `export default import('./query_compiler_bg.wasm')`
 * を呼ぶ。OpenNext の esbuild が `.wasm` 動的 import を `external` でマークするが、
 * Workers ランタイムには filesystem が無く、unenv の `fs.readFileSync` stub が
 * 呼ばれて以下で起動失敗:
 *     [unenv] fs.readFileSync is not implemented yet!
 *
 * ## 対処
 *
 * `prisma generate` 後に以下を行う:
 *   1. `query_compiler_bg.wasm` を Base64 化した sibling JS module を生成
 *   2. **`wasm.js` の `getQueryCompilerWasmModule` 本体を直接書換え**、
 *      subpath import を経由せず WebAssembly.compile(Uint8Array) で生成する
 *   3. 念のため `wasm-worker-loader.mjs` も同様にパッチ (subpath 経由 fallback も塞ぐ)
 *
 * これで `.wasm` 動的 import を一切経由せず、bundle 内の通常 JS 文字列として
 * embed され、Workers で安全に `WebAssembly.Module` を生成できる。
 *
 * ## 副作用
 *
 * Worker bundle が WASM サイズ (約 2 MB) 分大きくなる。
 *
 * Phase 5 で `provider = "prisma-client"` (Prisma 6.7+ TS-first 生成、WASM 不要)
 * への移行を検討する。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const PATCH_MARKER = '// AUTO-PATCHED-BY: scripts/patch-prisma-wasm-loader.mjs'

// patch 対象は複数箇所:
//   - node_modules/.prisma/client/        ← prisma generate 直後
//   - .next/standalone/node_modules/.prisma/client/  ← next build 後、OpenNext が bundle する場所
// 第 1 引数で .prisma/client へのパスを指定可能 (省略時は node_modules 直下)。
const PRISMA_CLIENT_DIR = process.argv[2] ?? path.join('node_modules', '.prisma', 'client')
const WASM_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_bg.wasm')
// CJS module (require できる形式) で base64 を持たせる。
// esbuild は require() を静的解析でインライン化できるが、await import() は
// dynamic require / fs.readFileSync に倒れることがあるため CJS にする。
const BASE64_CJS_MODULE_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_bg.wasm.base64.js')
const BASE64_ESM_MODULE_PATH = path.join(PRISMA_CLIENT_DIR, 'query_compiler_bg.wasm.base64.mjs')
const WORKER_LOADER_PATH = path.join(PRISMA_CLIENT_DIR, 'wasm-worker-loader.mjs')
const EDGE_LOADER_PATH = path.join(PRISMA_CLIENT_DIR, 'wasm-edge-light-loader.mjs')
const WASM_JS_PATH = path.join(PRISMA_CLIENT_DIR, 'wasm.js')

function log(msg) {
  console.log(`[patch-prisma-wasm] ${msg}`)
}

if (!existsSync(WASM_PATH)) {
  log(`WASM file not found at ${WASM_PATH} - skipping`)
  process.exit(0)
}

// ====== 1. Base64 module (CJS + ESM の両方) ======
const wasmBytes = readFileSync(WASM_PATH)
const base64 = wasmBytes.toString('base64')
log(`WASM size: ${wasmBytes.byteLength} bytes, ${base64.length} base64 chars`)

// CJS 版 (require で静的バンドル可能)
const base64CjsContent = `${PATCH_MARKER}
// Generated from query_compiler_bg.wasm. Do not edit directly.
module.exports = ${JSON.stringify(base64)}
`
writeFileSync(BASE64_CJS_MODULE_PATH, base64CjsContent)
log(`wrote base64 CJS module: ${BASE64_CJS_MODULE_PATH}`)

// ESM 版 (sibling loader mjs から import される)
const base64EsmContent = `${PATCH_MARKER}
// Generated from query_compiler_bg.wasm. Do not edit directly.
export default ${JSON.stringify(base64)}
`
writeFileSync(BASE64_ESM_MODULE_PATH, base64EsmContent)
log(`wrote base64 ESM module: ${BASE64_ESM_MODULE_PATH}`)

// ====== 2. wasm-worker-loader.mjs / wasm-edge-light-loader.mjs ======
const loaderContent = `${PATCH_MARKER}
import base64 from './query_compiler_bg.wasm.base64.mjs'

function _base64ToBytes(b64) {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const _compiled = WebAssembly.compile(_base64ToBytes(base64)).then((mod) => ({ default: mod }))
export default _compiled
`
writeFileSync(WORKER_LOADER_PATH, loaderContent)
log(`patched: ${WORKER_LOADER_PATH}`)

if (existsSync(EDGE_LOADER_PATH)) {
  writeFileSync(EDGE_LOADER_PATH, loaderContent)
  log(`patched: ${EDGE_LOADER_PATH}`)
}

// ====== 3. wasm.js の getQueryCompilerWasmModule 本体を直接書換え ======
if (!existsSync(WASM_JS_PATH)) {
  log(`wasm.js not found at ${WASM_JS_PATH} - skipping wasm.js patch`)
  process.exit(0)
}

let wasmJs = readFileSync(WASM_JS_PATH, 'utf-8')
let wasmJsAlreadyPatched = false

if (wasmJs.includes(PATCH_MARKER)) {
  log('wasm.js already patched, skipping wasm.js rewrite (sentinel will still be written)')
  wasmJsAlreadyPatched = true
}

// Prisma が生成する getQueryCompilerWasmModule の典型形:
//   getQueryCompilerWasmModule: async () => {
//     const loader = (await import('#wasm-compiler-loader')).default
//     const compiler = (await loader).default
//     return compiler
//   }
//
// 静的 require() を使う理由: esbuild は require() を build 時に解決して
// インライン化するが、`await import(...)` は dynamic require / fs.readFileSync
// に倒れて Workers で `[unenv] fs.readFileSync is not implemented yet!` を
// 引き起こす。CJS の require で静的バンドルを保証する。
const subpathImportRegex = /getQueryCompilerWasmModule:\s*async\s*\(\s*\)\s*=>\s*\{[^}]*?import\(\s*['"`]#wasm-compiler-loader['"`]\s*\)[^}]*?\}/m
const replacement = `getQueryCompilerWasmModule: async () => {
    ${PATCH_MARKER}
    // Inline Base64 → WebAssembly.compile (Cloudflare Workers compatibility)
    // 静的 require で base64 を bundle 時に inline させる (dynamic import 回避)
    const __prismaWasmBase64 = require('./query_compiler_bg.wasm.base64.js')
    const __bin = atob(__prismaWasmBase64)
    const __bytes = new Uint8Array(__bin.length)
    for (let __i = 0; __i < __bin.length; __i++) __bytes[__i] = __bin.charCodeAt(__i)
    return await WebAssembly.compile(__bytes)
  }`

if (!wasmJsAlreadyPatched) {
  if (!subpathImportRegex.test(wasmJs)) {
    log('WARNING: getQueryCompilerWasmModule pattern not found in wasm.js')
    log('Prisma generator output may have changed. Inspect the file to update the patch.')
    process.exit(1)
  }

  wasmJs = wasmJs.replace(subpathImportRegex, replacement)
  writeFileSync(WASM_JS_PATH, wasmJs)
  log(`patched: ${WASM_JS_PATH}`)
}

// ====== 4. Build 時の sentinel module を project 配下に書き出す ======
// この sentinel をアプリの runtime コード (例: /api/ping) から import すれば、
// build 時に patch が走ったかを runtime レスポンスで確認できる。
const SENTINEL_DIR = path.join('lib', 'generated')
const SENTINEL_PATH = path.join(SENTINEL_DIR, 'prisma-wasm-patch-state.ts')
mkdirSync(SENTINEL_DIR, { recursive: true })
const sentinelTs = `// AUTO-GENERATED by scripts/patch-prisma-wasm-loader.mjs at ${new Date().toISOString()}
// Do not edit. Regenerated on every \`prisma generate && patch\` cycle.
//
// /api/ping?probe=db から import して runtime レスポンスに乗せ、Cloudflare build
// 環境で patch script が実際に走ったかを判別する。
export const PRISMA_WASM_PATCH_STATE = {
  appliedAt: ${JSON.stringify(new Date().toISOString())},
  wasmBytes: ${wasmBytes.byteLength},
  base64Chars: ${base64.length},
  workerLoaderPatched: true,
  wasmJsPatched: true,
} as const
`
writeFileSync(SENTINEL_PATH, sentinelTs)
log(`wrote sentinel: ${SENTINEL_PATH}`)

log('done')
