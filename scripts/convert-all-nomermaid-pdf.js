/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * 全チュートリアルをMermaid図なしでPDFに一括変換。
 * （Mermaidはコードブロックとして出力されます。図付きPDFは convert-tutorial-pdf.js を使用し、Chrome をインストールしてください）
 *
 * 使い方: node scripts/convert-all-nomermaid-pdf.js
 * 環境変数: PUPPETEER_EXECUTABLE_PATH に Chrome のパスを指定可能
 *  例（Windows）: set PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
 */

const { mdToPdf } = require('md-to-pdf');
const fs = require('fs');
const path = require('path');

const TUTORIAL_DIR = path.join(__dirname, '..', 'docs', 'tutorial');
const OUTPUT_DIR = path.join(TUTORIAL_DIR, 'pdf');

const PDF_CSS = `
body { font-family: "Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic","Meiryo","Noto Sans JP",sans-serif; font-size: 10pt; line-height: 1.7; color: #1a1a1a; max-width: 100%; }
h1 { font-size: 22pt; font-weight: 700; color: #1b5e20; border-bottom: 3px solid #2e7d32; padding-bottom: 8px; margin-top: 40px; margin-bottom: 16px; page-break-after: avoid; }
h2 { font-size: 16pt; font-weight: 700; color: #2e7d32; border-bottom: 1.5px solid #a5d6a7; padding-bottom: 6px; margin-top: 32px; margin-bottom: 12px; page-break-after: avoid; }
h3 { font-size: 13pt; font-weight: 600; color: #388e3c; margin-top: 24px; margin-bottom: 8px; page-break-after: avoid; }
h4 { font-size: 11pt; font-weight: 600; color: #43a047; margin-top: 16px; margin-bottom: 6px; page-break-after: avoid; }
pre { background-color: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 16px; font-size: 8.5pt; line-height: 1.5; overflow-x: auto; page-break-inside: avoid; }
code { font-family: "Cascadia Code","Fira Code","Source Code Pro","Consolas",monospace; font-size: 8.5pt; }
:not(pre) > code { background-color: #f0f0f0; border: 1px solid #ddd; border-radius: 3px; padding: 1px 5px; font-size: 9pt; }
table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 9pt; page-break-inside: avoid; }
th { background-color: #e8f5e9; border: 1px solid #c8e6c9; padding: 8px 12px; text-align: left; font-weight: 600; color: #2e7d32; }
td { border: 1px solid #e0e0e0; padding: 6px 12px; }
tr:nth-child(even) { background-color: #fafafa; }
a { color: #1976d2; text-decoration: none; }
blockquote { border-left: 4px solid #a5d6a7; margin: 16px 0; padding: 8px 16px; background-color: #f1f8e9; color: #33691e; page-break-inside: avoid; }
blockquote p { margin: 4px 0; }
ul, ol { margin: 8px 0; padding-left: 24px; }
li { margin: 3px 0; }
hr { border: none; border-top: 2px solid #c8e6c9; margin: 24px 0; }
strong { color: #1b5e20; }
img { max-width: 100%; height: auto; page-break-inside: avoid; display: block; margin: 0.8em 0; }
.mermaid-rendered { page-break-inside: avoid; display: block; margin: 1em 0; }
p, li { orphans: 3; widows: 3; }
h1 + *, h2 + *, h3 + *, h4 + * { page-break-before: avoid; }
`;

const launchOptions = () => {
  const opts = { args: ['--no-sandbox', '--disable-setuid-sandbox'], protocolTimeout: 120000 };
  const exe = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (exe && fs.existsSync(exe)) opts.executablePath = exe;
  return opts;
};

async function convertOne(file) {
  const inputPath = path.join(TUTORIAL_DIR, file);
  const outputPath = path.join(OUTPUT_DIR, file.replace('.md', '.pdf'));
  const content = fs.readFileSync(inputPath, 'utf-8');

  const pdf = await mdToPdf(
    { content },
    {
      stylesheet: [],
      css: PDF_CSS,
      script: [],
      body_class: [],
      marked_options: { gfm: true, breaks: false },
      pdf_options: {
        format: 'A4',
        margin: { top: '20mm', right: '18mm', bottom: '20mm', left: '18mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 8pt; color: #999; width: 100%; text-align: center; padding: 0 20mm;"><span>BON-LOG チュートリアル</span></div>',
        footerTemplate: '<div style="font-size: 8pt; color: #999; width: 100%; text-align: center; padding: 0 20mm;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
        timeout: 120000,
      },
      launch_options: launchOptions(),
      page_media_type: 'screen',
    }
  );

  if (pdf && pdf.content) {
    fs.writeFileSync(outputPath, pdf.content);
    return pdf.content.length;
  }
  return 0;
}

async function main() {
  console.log('=== チュートリアル PDF変換（Mermaidはコードブロック表示） ===\n');

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs.readdirSync(TUTORIAL_DIR).filter((f) => f.endsWith('.md') && /^\d{2}_/.test(f)).sort();
  console.log(`対象: ${files.length} ファイル\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const inputPath = path.join(TUTORIAL_DIR, file);
    const lineCount = fs.readFileSync(inputPath, 'utf-8').split('\n').length;
    console.log(`[${i + 1}/${files.length}] ${file} (${lineCount}行)`);

    try {
      const size = await convertOne(file);
      if (size > 0) {
        const sizeMB = (size / 1024 / 1024).toFixed(1);
        console.log(`    -> ${file.replace('.md', '.pdf')} (${sizeMB} MB)\n`);
        success++;
      } else {
        console.log('    [ERROR] 生成失敗\n');
        failed++;
      }
    } catch (err) {
      console.log(`    [ERROR] ${err.message}\n`);
      failed++;
    }
  }

  console.log('=== 完了 ===');
  console.log(`成功: ${success}/${files.length}`);
  if (failed > 0) console.log(`失敗: ${failed}/${files.length}`);
  console.log(`出力先: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
