/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * チュートリアルMarkdownファイルをPDFに変換するスクリプト
 *
 * 使い方: node scripts/convert-tutorial-pdf.js [filename]
 *   - 引数なし: 全ファイルを変換
 *   - 引数あり: 指定ファイルのみ変換 (例: node scripts/convert-tutorial-pdf.js 00_index.md)
 *
 * 処理フロー:
 *   1. Puppeteerブラウザでmermaid.jsをロード
 *   2. 各Mermaid図をSVGにプリレンダリング
 *   3. MarkdownのMermaidブロックをSVG画像に置換
 *   4. md-to-pdfで最終PDF生成
 */

const { mdToPdf } = require('md-to-pdf');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const TUTORIAL_DIR = path.join(__dirname, '..', 'docs', 'tutorial');
const OUTPUT_DIR = path.join(TUTORIAL_DIR, 'pdf');

// ============================================================
// PDF用CSSの読み込み
// ============================================================
let PDF_CSS = '';
const cssPath = path.join(OUTPUT_DIR, 'tutorial-style.css');
if (fs.existsSync(cssPath)) {
  PDF_CSS = fs.readFileSync(cssPath, 'utf-8');
} else {
  console.warn(`[WARN] 外部CSSファイルが見つかりません: ${cssPath}`);
}

// ============================================================
// Mermaidプリレンダラー
// ============================================================

/**
 * MermaidプリレンダラーClass
 * Puppeteerブラウザ内でmermaid.jsを使いSVGを生成する
 */
class MermaidRenderer {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    const launchOpts = {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      protocolTimeout: 60000,
    };
    const exe = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (exe && fs.existsSync(exe)) launchOpts.executablePath = exe;
    this.browser = await puppeteer.launch(launchOpts);
    this.page = await this.browser.newPage();
    // PDF印刷幅に合わせたビューポート（A4: 210mm - 余白18mm×2 = 174mm ≈ 658px）
    await this.page.setViewport({ width: 658, height: 800 });
    this.page.setDefaultTimeout(30000);

    // Mermaid.jsをロードしたページを準備
    const mermaidPath = path.join(__dirname, 'mermaid.min.js');
    let mermaidScript;
    if (fs.existsSync(mermaidPath)) {
      mermaidScript = `<script>${fs.readFileSync(mermaidPath, 'utf-8')}</script>`;
    } else {
      mermaidScript = `<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>`;
    }

    await this.page.setContent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
${mermaidScript}
<script>
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
  sequence: { useMaxWidth: true, mirrorActors: false },
  er: { useMaxWidth: true },
  gantt: { useMaxWidth: true },
});
</script>
<div id="container" style="width:658px;"></div>
</body></html>`, { waitUntil: 'networkidle0', timeout: 30000 });

    // mermaidが利用可能か確認
    const ready = await this.page.evaluate(() => typeof mermaid !== 'undefined');
    if (!ready) throw new Error('Mermaid.js failed to load');
  }

  /**
   * Mermaidコードを SVG 文字列にレンダリング
   * @param {string} code - Mermaid記法
   * @param {string} id - ユニークID
   * @returns {string|null} SVG文字列 or null（失敗時）
   */
  async render(code, id) {
    try {
      const svg = await this.page.evaluate(async (mermaidCode, diagId) => {
        try {
          const { svg } = await mermaid.render(diagId, mermaidCode);
          return svg;
        } catch (_e) {
          return null;
        }
      }, code, id);
      return svg;
    } catch {
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// ============================================================
// SVG → img data URI 変換
// ============================================================

/**
 * SVG文字列をBase64エンコードした <img> タグに変換する。
 *
 * インラインSVGの問題:
 *   - width="100%" + height未設定 → レイアウト高さが0と計算され後続テキストと重なる
 *   - SVGは原子的要素でページ分割不可 → 大きいSVGが空白ページを生む
 *
 * <img> タグなら:
 *   - max-width + max-height で比率を保って縮小できる（クリッピングではなくスケーリング）
 *   - ブラウザが正しくレイアウト高さを計算する
 */
function svgToImgTag(svgStr) {
  const base64 = Buffer.from(svgStr).toString('base64');
  return `<img src="data:image/svg+xml;base64,${base64}" style="max-width:100%; max-height:750px; height:auto; display:block; margin:0 auto;" />`;
}

// ============================================================
// Markdown前処理
// ============================================================

/**
 * Markdownコンテンツ内の```mermaid```ブロックを抽出
 * 引用ブロック内のMermaid（> プレフィックス付き）にも対応
 * @returns {{ index: number, fullMatch: string, code: string }[]}
 */
function extractMermaidBlocks(content) {
  // 通常のMermaidブロック + 引用ブロック内のMermaidブロック
  // \r\n (CRLF) にも対応（\r?\n）
  const regex = /(?:>[ \t]*)?```mermaid\r?\n([\s\S]*?)(?:>[ \t]*)?```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    let code = match[1].trim();
    // 引用ブロックのプレフィックス（> ）を各行から除去
    if (code.startsWith('>')) {
      code = code.split('\n').map(line => line.replace(/^>\s?/, '')).join('\n').trim();
    }
    blocks.push({
      index: match.index,
      fullMatch: match[0],
      code,
    });
  }
  return blocks;
}

/**
 * Mermaidブロックをレンダリング済みSVGのHTMLに置換
 */
async function replaceMermaidWithSvg(content, renderer, fileLabel) {
  const blocks = extractMermaidBlocks(content);
  if (blocks.length === 0) return content;

  console.log(`    Mermaid図: ${blocks.length}個`);

  let result = content;
  let offset = 0;
  let rendered = 0;
  let failed = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const id = `mmd_${fileLabel}_${i}`;

    const rawSvg = await renderer.render(block.code, id);

    let replacement;
    if (rawSvg) {
      // SVGを<img>タグ（data URI）として埋め込み
      const imgTag = svgToImgTag(rawSvg);
      replacement = `\n<div class="mermaid-rendered">\n${imgTag}\n</div>\n`;
      rendered++;
    } else {
      // レンダリング失敗時はコードブロックのまま残す
      replacement = block.fullMatch;
      failed++;
    }

    const adjustedIndex = block.index + offset;
    result =
      result.substring(0, adjustedIndex) +
      replacement +
      result.substring(adjustedIndex + block.fullMatch.length);
    offset += replacement.length - block.fullMatch.length;
  }

  console.log(`    レンダリング: ${rendered}成功 / ${failed}失敗`);
  return result;
}

// ============================================================
// PDF変換
// ============================================================

async function convertFile(content, outputPath) {
  const pdf = await mdToPdf(
    { content },
    {
      stylesheet: [],
      css: PDF_CSS,
      script: [],  // Mermaidスクリプトは不要（プリレンダリング済み）
      body_class: [],
      marked_options: {
        gfm: true,
        breaks: false,
      },
      marked_extensions: [],
      pdf_options: {
        format: 'A4',
        margin: { top: '25mm', right: '20mm', bottom: '25mm', left: '20mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 8pt; color: #999; width: 100%; text-align: center; padding: 0 20mm;">
            <span>BON-LOG チュートリアル</span>
          </div>`,
        footerTemplate: `
          <div style="font-size: 8pt; color: #999; width: 100%; text-align: center; padding: 0 20mm;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>`,
      },
      launch_options: (() => {
        const opts = { args: ['--no-sandbox', '--disable-setuid-sandbox'], protocolTimeout: 120000 };
        const exe = process.env.PUPPETEER_EXECUTABLE_PATH;
        if (exe && fs.existsSync(exe)) opts.executablePath = exe;
        return opts;
      })(),
      page_media_type: 'screen',
    }
  );

  if (pdf && pdf.content) {
    fs.writeFileSync(outputPath, pdf.content);
    return pdf.content.length;
  }
  return 0;
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.log('=== チュートリアル PDF変換 ===\n');

  // 出力ディレクトリ
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // 対象ファイル（一括時はチュートリアル本編 00_〜22_ のみ。pdf/README 等は除外）
  const targetFile = process.argv[2];
  const allMd = fs.readdirSync(TUTORIAL_DIR).filter(f => f.endsWith('.md') && /^\d{2}_/.test(f)).sort();
  const files = targetFile ? [targetFile] : allMd;

  console.log(`対象ファイル: ${files.length}個\n`);

  // Mermaidレンダラー初期化
  console.log('Mermaidレンダラー初期化中...');
  const renderer = new MermaidRenderer();
  await renderer.init();
  console.log('Mermaidレンダラー準備完了\n');

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const inputPath = path.join(TUTORIAL_DIR, file);
    if (!fs.existsSync(inputPath)) {
      console.log(`  [SKIP] ${file} - ファイルが見つかりません`);
      failed++;
      continue;
    }

    const outputPath = path.join(OUTPUT_DIR, file.replace('.md', '.pdf'));
    const content = fs.readFileSync(inputPath, 'utf-8');
    const lineCount = content.split('\n').length;
    const fileLabel = file.replace('.md', '').replace(/\W/g, '_');

    console.log(`[${success + failed + 1}/${files.length}] ${file} (${lineCount}行)`);

    try {
      // Phase 1: Mermaid図をSVGにプリレンダリング
      const processedContent = await replaceMermaidWithSvg(content, renderer, fileLabel);

      // Phase 2: md-to-pdfでPDF生成
      console.log('    PDF生成中...');
      const size = await convertFile(processedContent, outputPath);

      if (size > 0) {
        const sizeMB = (size / 1024 / 1024).toFixed(1);
        console.log(`    -> ${file.replace('.md', '.pdf')} (${sizeMB} MB)\n`);
        success++;
      } else {
        console.log(`    [ERROR] PDF生成に失敗\n`);
        failed++;
      }
    } catch (err) {
      console.log(`    [ERROR] ${err.message}\n`);
      failed++;
    }
  }

  // クリーンアップ
  await renderer.close();

  console.log(`=== 完了 ===`);
  console.log(`成功: ${success}/${files.length}`);
  if (failed > 0) console.log(`失敗: ${failed}/${files.length}`);
  console.log(`出力先: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
