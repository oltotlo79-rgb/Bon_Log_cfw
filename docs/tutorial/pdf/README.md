# チュートリアル PDF

このフォルダには、`docs/tutorial/` 内の Markdown を PDF に変換したファイルが出力されます。

## 見やすさの工夫

- **図・表・コードブロックで改ページしない**  
  CSS で `page-break-inside: avoid` を指定しているため、図や Mermaid ダイアグラム・表・コードブロックの途中でページが切れません。大きい図は次のページにまとめて表示されます。
- **見出しだけがページ末に残らない**  
  `page-break-after: avoid` により、見出しの直後は可能な限り同じページに収まります。
- **空白ページを抑える**  
  段落の orphans/widows を指定し、対象はチュートリアル本編（`00_index.md` 〜 `22_deploy.md`）のみで、`pdf/README.md` などは変換しません。

スタイルは `tutorial-style.css`（方法2で使用）および `convert-all-nomermaid-pdf.js` 内の CSS で共通の改ページルールを適用しています。

## 生成方法

### 方法1: 一括変換（Mermaid はコードブロックのまま表示）

```bash
# 環境変数で Chrome を指定（必須）
# Windows（PowerShell）
$env:PUPPETEER_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run tutorial:pdf

# Windows（コマンドプロンプト）
set PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
npm run tutorial:pdf
```

### 方法2: Mermaid 図を描画して PDF（要 Chrome）

Mermaid を SVG に変換してから PDF 化する場合（図付きで見やすい場合）。

```bash
# 環境変数で Chrome を指定（上記と同様）
# 全ファイル
npm run tutorial:pdf:full

# 単一ファイルのみ
node scripts/convert-tutorial-pdf.js 00_index.md
```

## 注意

- PDF 生成には **Chrome**（または Chromium）が必要です。
- 「Could not find Chrome」と出る場合は、`PUPPETEER_EXECUTABLE_PATH` に Chrome の実行ファイルパスを設定してください（例: `C:\Program Files\Google\Chrome\Application\chrome.exe`）。
- ファイルが大きい場合は 1 ファイルあたり 1〜2 分かかることがあります。
