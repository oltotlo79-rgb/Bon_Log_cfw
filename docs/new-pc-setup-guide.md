# 新しいPCへのClaude Code + Bonsai SNSプロジェクト セットアップガイド

このドキュメントは、現在の開発環境を新しいWindows PCに完全再現するための手順書です。
上から順番に進めれば、旧PCと同じ状態で開発を再開できます。

> **所要時間の目安**: 回線速度にもよりますが、全工程で約1〜2時間です。

---

## 目次

1. [前提ソフトウェアのインストール](#1-前提ソフトウェアのインストール)
2. [Gitの設定](#2-gitの設定)
3. [プロジェクトのクローン](#3-プロジェクトのクローン)
4. [Node.js依存関係のインストール](#4-nodejs依存関係のインストール)
5. [環境変数の設定](#5-環境変数の設定)
6. [Docker + PostgreSQLの起動](#6-docker--postgresqlの起動)
7. [Prismaのセットアップ](#7-prismaのセットアップ)
8. [Claude Codeのインストール](#8-claude-codeのインストール)
9. [Claude Codeのグローバル設定](#9-claude-codeのグローバル設定)
10. [MCPサーバーの設定](#10-mcpサーバーの設定)
11. [Claude Codeのプロジェクト設定](#11-claude-codeのプロジェクト設定)
12. [Claude Codeのメモリ復元](#12-claude-codeのメモリ復元)
13. [動作確認](#13-動作確認)
14. [トラブルシューティング](#14-トラブルシューティング)

---

## 0. ターミナル（コマンドを打つ場所）について

このガイドでは「ターミナルで以下を実行」という指示が何度も出てきます。
Windowsでターミナルを開く方法は以下の通りです:

### ターミナルの開き方

1. キーボードで `Windowsキー` を押す（画面左下のWindowsマーク）
2. 「**terminal**」または「**ターミナル**」と入力
3. 「**Windows Terminal**」が表示されるのでクリック

黒い画面が開いたら、そこにコマンド（`git --version` など）を入力して `Enter` キーを押します。

> **別の方法**: VS Codeをインストール済みなら、VS Codeを開いて `Ctrl + @`（バッククォート）でターミナルを開くこともできます。

### コマンドの読み方

このガイドのコードブロック内で `#` で始まる行は**コメント（説明）**です。入力する必要はありません:

```bash
# これはコメント。入力しなくてOK
node --version   # ← これを入力してEnter
```

---

## 1. 前提ソフトウェアのインストール

以下のソフトウェアを順番にインストールしてください。

### 1-1. Node.js (v22.x)

**Node.jsとは**: JavaScriptをPC上で動かすためのソフトウェアです。このプロジェクトの実行に必須です。
**npmとは**: Node.jsに付属するパッケージ管理ツールです。ライブラリのインストールに使います。

現在の環境: **Node.js v22.14.0 / npm 11.7.0**

1. https://nodejs.org/ にアクセス
2. **LTS版（v22.x系）** をダウンロード（ページ中央の大きなボタン）
3. ダウンロードした `.msi` ファイルをダブルクリックして実行
4. インストーラーの画面を進める:
   - ライセンス同意 → Next
   - インストール先 → デフォルトのまま Next
   - **「Tools for Native Modules」のチェックボックスにチェックを入れる**（ネイティブモジュールのビルドに必要）
   - Install → Finish
5. **PCを再起動**する（PATHの反映のため）
6. ターミナルを開いて確認:

```bash
node --version   # v22.x.x と表示されればOK
npm --version    # 11.x.x と表示されればOK
```

> **うまくいかない場合**: 「'node' は認識されていません」と出たら、PCを再起動してください。それでもダメならNode.jsを再インストールしてください。

### 1-2. Git

**Gitとは**: ソースコードのバージョン管理ツールです。コードの変更履歴を記録したり、GitHubとやり取りしたりするために使います。

現在の環境: **git version 2.47.1.windows.1**

1. https://git-scm.com/download/win にアクセス
2. 「**64-bit Git for Windows Setup**」をクリックしてダウンロード
3. ダウンロードした `.exe` をダブルクリックして実行
4. インストーラーの設定（以下の画面以外はデフォルトのまま Next でOK）:

| 設定画面 | 選択する項目 | 理由 |
|---------|------------|------|
| Default editor | **Use Visual Studio Code as Git's default editor** | VS Codeで差分確認ができる |
| Adjusting your PATH | **Git from the command line and also from 3rd-party software** | ターミナルからgitコマンドが使える（デフォルト） |
| Line ending conversions | **Checkout as-is, commit Unix-style line endings** | チーム開発での改行コード統一 |

5. ターミナルを**新しく開き直して**確認:

```bash
git --version    # git version 2.x.x と表示されればOK
```

### 1-3. Docker Desktop

**Dockerとは**: アプリケーションを「コンテナ」という隔離された環境で動かすツールです。
このプロジェクトでは、ローカル開発用のPostgreSQLデータベースをDockerで動かしています。

> **WSL 2とは**: Windows上でLinuxを動かす仕組みです。Docker Desktopが内部で使っています。
> Docker Desktopのインストーラーが自動的にWSL 2もセットアップしてくれるので、通常は手動設定不要です。

現在の環境: **Docker 29.1.3 / Docker Compose v2.40.3**

1. https://www.docker.com/products/docker-desktop/ にアクセス
2. 「**Download for Windows**」をクリック
3. ダウンロードした `.exe` を実行してインストール
4. インストール完了後、**PCを再起動**
5. 再起動後、Docker Desktopが自動起動する（タスクバー右下にクジラアイコンが表示される）
6. 初回起動時にライセンス同意画面が出るので「Accept」
7. ターミナルで確認:

```bash
docker --version          # Docker version 2x.x.x と表示されればOK
docker compose version    # Docker Compose version v2.x.x と表示されればOK
```

> **「docker: command not found」と出る場合**: Docker Desktopが起動しているか確認してください（タスクバー右下のクジラアイコン）。起動していなければダブルクリックで起動してください。

### 1-4. VS Code（推奨エディタ）

**VS Codeとは**: Microsoftが作ったコードエディタです。このプロジェクトの開発で使っています。

1. https://code.visualstudio.com/ にアクセス
2. 「**Download for Windows**」をクリックしてインストール
3. インストーラーで「**Add to PATH**」にチェックが入っていることを確認

#### 推奨拡張機能のインストール方法

VS Codeを開いた後:
1. 左サイドバーの四角が4つ並んだアイコン（Extensions）をクリック（またはショートカット `Ctrl + Shift + X`）
2. 検索バーに拡張機能名を入力
3. 「**Install**」ボタンをクリック

以下の拡張機能をインストールしてください:

| 拡張機能名 | 用途 |
|-----------|------|
| ESLint | コードの静的解析（書き方の間違いを指摘してくれる） |
| Prettier | コードの自動整形 |
| Prisma | データベーススキーマファイルのシンタックスハイライト |
| Tailwind CSS IntelliSense | CSSクラス名の自動補完 |
| Claude Code | Claude Code IDE拡張（ターミナル不要でClaude Codeが使える） |

---

## 2. Gitの設定

ターミナルを開いて、以下のコマンドを**1行ずつ**実行してください。

### 2-1. ユーザー情報の設定

Gitに「自分は誰か」を教えます。コミット（変更の記録）に名前とメールが記録されます。

```bash
git config --global user.name "yuya"
git config --global user.email "あなたのメールアドレス"
```

> `"yuya"` と `"あなたのメールアドレス"` は自分の情報に書き換えてください。GitHubに登録しているメールアドレスを使うのがベストです。

### 2-2. SSHキーの生成

**SSHキーとは**: GitHubとの通信を暗号化するための「合鍵」のようなものです。パスワードの代わりに使います。

```bash
ssh-keygen -t ed25519 -C "あなたのメールアドレス"
```

実行すると、以下のように対話形式で質問されます:

```
Generating public/private ed25519 key pair.
Enter file in which to save the key (C:\Users\yuya/.ssh/id_ed25519):
```
→ **何も入力せずにEnter**（デフォルトの保存場所でOK）

```
Enter passphrase (empty for no passphrase):
```
→ **何も入力せずにEnter**（パスフレーズなしでOK。セキュリティを高めたい場合は任意のパスワードを入力）

```
Enter same passphrase again:
```
→ **もう一度Enter**

これで `C:\Users\yuya\.ssh\` フォルダに2つのファイルが生成されます。

### 2-3. 公開鍵とは？

`ssh-keygen` を実行すると、以下の2つのファイルが生成されます:

| ファイル | 種類 | 用途 |
|---------|------|------|
| `~/.ssh/id_ed25519` | **秘密鍵** | 自分のPCに保管。**絶対に他人に見せない・送らない** |
| `~/.ssh/id_ed25519.pub` | **公開鍵** | GitHubに登録する。他人に見せてもOK |

> **たとえ話**: 秘密鍵は「家の鍵」、公開鍵は「鍵穴」です。鍵穴（公開鍵）をGitHubに設置して、鍵（秘密鍵）は自分だけが持ちます。鍵を持っている人だけがGitHubにアクセスできる仕組みです。

公開鍵（`.pub`ファイル）の中身は、以下のような1行のテキストです:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI... your-email@example.com
```

この文字列全体をコピーして、GitHubに登録します。

### 2-4. GitHubへの公開鍵登録手順

1. ターミナルで公開鍵を表示する:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
   画面に `ssh-ed25519 AAAA...` という長い文字列が表示されます。

2. 表示された文字列を**行の先頭から末尾まで全文選択してコピー**する
   - マウスで選択 → 右クリック → コピー
   - または選択して `Ctrl + C`

3. ブラウザで https://github.com/settings/keys を開く（GitHubにログイン済みであること）

4. 右上の緑色のボタン **「New SSH key」** をクリック

5. フォームが表示されるので、以下を入力:

   | フィールド | 入力内容 |
   |-----------|---------|
   | **Title** | この鍵の識別名。自由に付けてOK（例: `新しいPC`, `Desktop-2026`） |
   | **Key type** | `Authentication Key`（最初から選ばれているのでそのまま） |
   | **Key** | 手順2でコピーした公開鍵を**ここにペースト**する（`Ctrl + V`） |

6. **「Add SSH key」** ボタンをクリックして保存
   - GitHubのパスワード入力を求められたら入力してください

7. 接続テスト（ターミナルに戻る）:
   ```bash
   ssh -T git@github.com
   ```
   初回は以下のように聞かれます:
   ```
   Are you sure you want to continue connecting (yes/no/[fingerprint])?
   ```
   → **`yes` と入力してEnter**

   成功すると以下のメッセージが表示されます:
   ```
   Hi yuya! You've successfully authenticated, but GitHub does not provide shell access.
   ```
   このメッセージが出ればOKです。「shell access」は不要なので気にしないでください。

---

## 3. プロジェクトのクローン

**クローンとは**: GitHubにあるリポジトリ（プロジェクト）を自分のPCにダウンロードすることです。
コードだけでなく、全ての変更履歴や設定ファイルも一緒に取得されます。

```bash
# 作業ディレクトリを作成（-p は「途中のフォルダも一緒に作る」オプション）
mkdir -p ~/Desktop/Bonsai

# 作成したフォルダに移動
cd ~/Desktop/Bonsai

# GitHubからプロジェクトをクローン（SSH接続）
git clone git@github.com:あなたのユーザー名/bonsai-sns-project.git
```

> **`~` とは**: ホームディレクトリの省略記号です。Windows では `C:\Users\yuya` を意味します。
> つまり `~/Desktop/Bonsai` は `C:\Users\yuya\Desktop\Bonsai` と同じです。

> **HTTPS接続を使う場合**（SSHキーの設定をスキップした場合）:
> ```bash
> git clone https://github.com/あなたのユーザー名/bonsai-sns-project.git
> ```
> ただし、push（コードのアップロード）のたびにユーザー名とパスワード（またはPAT）の入力が必要になります。

クローン後、プロジェクトフォルダに移動:

```bash
cd bonsai-sns-project
```

> **確認**: `ls` コマンドを実行して、`package.json`, `CLAUDE.md` などが表示されればクローン成功です。

クローンすると以下のファイルは**自動的に取得**されます（手動コピー不要）:
- `CLAUDE.md` — Claude Codeのプロジェクト指示書
- `.claude/rules/*.md` — 機能別ルール（12ファイル）
- `.mcp.json` — MCPサーバー設定

---

## 4. Node.js依存関係のインストール

**依存関係（node_modules）とは**: プロジェクトが使っているライブラリ（React, Next.js, Prismaなど）の集まりです。
`package.json` にリストが書いてあり、`npm install` でまとめてダウンロードされます。

```bash
# プロジェクトフォルダにいることを確認
# pwd コマンドで現在地を表示できる
pwd
# → /c/Users/yuya/Desktop/Bonsai/bonsai-sns-project と表示されればOK

# 依存関係をインストール（数分かかります）
npm install
```

完了すると、以下が自動的に実行されます:
- `node_modules/` フォルダに約1000以上のパッケージがダウンロードされる
- `postinstall` → `prisma generate`（データベースクライアントの自動生成）
- `prepare` → `husky`（Gitコミット時の自動チェック機能の設定）

> **`node_modules/` フォルダ**: 非常に大きなフォルダ（数百MB）ですが、Gitには含まれません（`.gitignore`で除外済み）。
> 新しいPCでは毎回 `npm install` で再作成します。

---

## 5. 環境変数の設定

**環境変数（`.env.local`）とは**: データベースのパスワードやAPIキーなど、**公開してはいけない秘密情報**を保管するファイルです。
Gitにはコミットされないので、PC移行時は手動でコピーする必要があります。

### 5-1. テンプレートからファイルを作成

```bash
cp .env.local.example .env.local
```

> **`cp` とは**: ファイルをコピーするコマンドです。`.env.local.example`（テンプレート）を `.env.local`（実際に使うファイル）としてコピーしています。

### 5-2. 旧PCから値をコピーする（推奨）

**一番簡単な方法**: 旧PCの `.env.local` ファイルをUSBメモリやクラウドストレージ経由で新PCにコピーしてください。

旧PCでのファイルの場所:
```
C:\Users\yuya\Desktop\Bonsai\bonsai-sns-project\.env.local
```

> **注意**: `.env.local` はドットで始まるファイルです。エクスプローラーでは「隠しファイル」になっている場合があります。
> 表示するには: エクスプローラー上部の「表示」→「表示」→「隠しファイル」にチェック

### 5-3. 手動で設定する場合

VS Codeで `.env.local` を開きます:

```bash
code .env.local
```

以下の環境変数を設定してください。各サービスの管理画面から値を取得します。

```bash
# === データベース（Supabase PostgreSQL）===
# Supabaseダッシュボード → Settings → Database → Connection string で取得
DATABASE_URL="postgresql://postgres.xxxx:パスワード@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.xxxx:パスワード@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# === 認証（NextAuth.js）===
NEXTAUTH_URL="http://localhost:3000"
# ランダムな秘密鍵。以下のコマンドで生成できる:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NEXTAUTH_SECRET="xxxxxxxxxxxxxxxx"

# === アプリURL ===
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# === Redis（Upstash）===
# Upstashダッシュボード → データベース → REST API で取得
UPSTASH_REDIS_REST_URL="https://xxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxxxxxxx"

# === ストレージ（Cloudflare R2）===
# Cloudflareダッシュボード → R2 → APIトークン で取得
STORAGE_PROVIDER="r2"
R2_ACCOUNT_ID="xxxxxxxx"
R2_ACCESS_KEY_ID="xxxxxxxx"
R2_SECRET_ACCESS_KEY="xxxxxxxx"
R2_BUCKET_NAME="xxxxxxxx"
R2_PUBLIC_URL="https://..."

# === メール（Resend）===
# https://resend.com/api-keys で取得
RESEND_API_KEY="re_xxxxxxxx"

# === 決済（Stripe）===
# https://dashboard.stripe.com/apikeys で取得
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."

# === 監視（Sentry）===
# Sentryプロジェクト → Settings → Client Keys で取得
SENTRY_DSN="https://xxxx@xxxx.ingest.sentry.io/xxxx"
NEXT_PUBLIC_SENTRY_DSN="https://xxxx@xxxx.ingest.sentry.io/xxxx"

# === 2要素認証 ===
# ランダムな32バイトのhex文字列。以下のコマンドで生成:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TWO_FACTOR_ENCRYPTION_KEY="xxxxxxxx"

# === Google OAuth ===
# Google Cloud Console → APIとサービス → 認証情報 で取得
GOOGLE_CLIENT_ID="xxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxxxxxxx"
```

> **絶対にやってはいけないこと**: `.env.local` をGitにコミットすること。パスワードやAPIキーが全世界に公開されてしまいます。
> `.gitignore` に `.env.local` が含まれているので、通常は自動的に除外されますが、`git add .env.local` を手動で実行しないでください。

---

## 6. Docker + PostgreSQLの起動

ローカル開発用にPostgreSQLデータベースをDockerで起動します。

> **Supabase（クラウドDB）に直接接続する場合**: この手順はスキップしてOKです。
> `.env.local` の `DATABASE_URL` にSupabaseのURLが入っていれば、ローカルのPostgreSQLは不要です。

### 6-1. Docker Desktopが起動しているか確認

タスクバー右下（時計の近く）にクジラのアイコンがあればOKです。
なければ、スタートメニューから「Docker Desktop」を起動してください。

### 6-2. PostgreSQLを起動

```bash
# プロジェクトフォルダにいることを確認
cd ~/Desktop/Bonsai/bonsai-sns-project

# PostgreSQLのみ起動（-d はバックグラウンドで実行するオプション）
docker compose up -d postgres
```

### 6-3. 起動確認

```bash
docker compose ps
```

以下のように `running` と表示されればOK:
```
NAME                    STATUS
bonsai-sns-postgres-1   running
```

> **停止する時**: `docker compose down`
> **データごと完全削除**: `docker compose down -v`（テーブルやデータも消えます）

---

## 7. Prismaのセットアップ

**Prismaとは**: データベースを操作するためのツール（ORM）です。
SQLを直接書く代わりに、TypeScriptのコードでデータベースを操作できます。

### 7-1. 各コマンドの意味

| コマンド | やること | いつ使う？ |
|---------|---------|-----------|
| `npx prisma generate` | TypeScriptの型定義を生成 | スキーマ変更後（`npm install` で自動実行済み） |
| `npx prisma db push` | スキーマをデータベースに反映 | **初回セットアップ時**、スキーマ変更時 |
| `npx prisma db seed` | テストデータを投入 | 任意（空のDBに初期データを入れたい時） |

### 7-2. 実行

```bash
# Prismaクライアントの生成（npm installで自動実行済みだが念のため）
npx prisma generate

# スキーマをデータベースに反映（テーブルを作成する）
npx prisma db push
```

> **「テーブル」とは**: データベースの中の表のこと。ユーザー情報、投稿情報など、データの種類ごとにテーブルが存在します。
> `db push` はこれらのテーブルをデータベースに作成します。

### 7-3. シードデータの投入（任意）

```bash
# テスト用の初期データを投入（やらなくても動きます）
npx prisma db seed
```

> **注意**: 本番DB（Supabase）へのシード投入は、必ず明示的に判断してから行ってください。
> 容量を圧迫するため、不要なら実行しないでください。

### 7-4. DB管理GUIで確認（任意）

```bash
npx prisma studio
```

ブラウザが開き、データベースの中身をGUIで確認・編集できます。
テーブル一覧が表示されれば、セットアップ成功です。
確認が済んだら `Ctrl + C` で終了します。

---

## 8. Claude Codeのインストール

**Claude Codeとは**: Anthropic社のAIアシスタント「Claude」をターミナルから使えるCLIツールです。
コードの作成・修正・レビュー・質問応答などをAIに依頼できます。

### 8-1. CLIのインストール

```bash
# -g は「グローバル（PC全体で使えるように）インストール」の意味
npm install -g @anthropic-ai/claude-code
```

インストール後の確認:

```bash
claude --version
# 現在のバージョン: 2.1.96（バージョンが表示されればOK）
```

### 8-2. 初回認証（Anthropicアカウントへのログイン）

```bash
claude
```

初回起動時、以下のような流れになります:
1. ターミナルに「ブラウザを開きます」的なメッセージが表示される
2. ブラウザが自動で開く
3. Anthropicアカウント（claude.aiのアカウント）でログイン
4. 「Claude Codeからのアクセスを許可しますか？」→ 許可する
5. ターミナルに戻ると、Claude Codeが使えるようになっている

> **Anthropicアカウントがない場合**: https://claude.ai/ で作成してください。
> Claude Codeの利用にはAnthropicの有料プラン（Pro / Max / Team）が必要です。

### 8-3. IDE拡張のインストール（任意）

VS Code上でClaude Codeを直接使えるようになります。

1. VS Codeを開く
2. `Ctrl + Shift + X` で拡張機能を開く
3. 「**Claude Code**」を検索してインストール
4. VS Codeの左サイドバーにClaudeのアイコンが追加される

---

## 9. Claude Codeのグローバル設定

**グローバル設定とは**: PC全体に適用されるClaude Codeの設定です。
どのプロジェクトを開いても、この設定が基本になります。

### 9-1. 設定ファイルの作成

以下のファイルを作成します:

**ファイルの場所**: `C:\Users\yuya\.claude\settings.json`

> **`.claude` フォルダが見つからない場合**: Claude Codeを一度起動（手順8-2）すれば自動作成されます。

#### VS Codeで作成する方法:

```bash
# VS Codeで直接開く（ファイルがなければ新規作成される）
code ~/.claude/settings.json
```

以下の内容を貼り付けて保存（`Ctrl + S`）:

```json
{
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_ここにGitHub PATを設定"
  },
  "enabledPlugins": {
    "frontend-design@claude-plugins-official": true
  },
  "skipDangerousModePermissionPrompt": true
}
```

#### 各設定の意味:

| キー | 説明 |
|------|------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub連携用のトークン。Claude CodeがGitHubのPR作成やissue閲覧をできるようになる |
| `enabledPlugins` | フロントエンド設計支援プラグインの有効化 |
| `skipDangerousModePermissionPrompt` | 危険な操作の確認ダイアログをスキップ（慣れている人向け） |

### 9-2. GitHub Personal Access Token (PAT) の取得方法

**PATとは**: GitHubのパスワードの代わりに使う「アクセストークン」です。

1. https://github.com/settings/tokens にアクセス（GitHubにログイン済みであること）
2. **「Generate new token」** → **「Generate new token (classic)」** をクリック
3. 設定画面が開くので:
   - **Note**: トークンの識別名（例: `Claude Code - 新PC`）
   - **Expiration**: 有効期限（`90 days` や `No expiration` を選択）
   - **Select scopes**: 以下にチェックを入れる:
     - `repo`（全リポジトリへのアクセス）
     - `read:org`（組織情報の読み取り）
4. ページ下部の **「Generate token」** をクリック
5. **緑色の背景でトークンが表示される** → これをコピー

> **重要**: トークンは**この画面を閉じると二度と表示されません**。必ずコピーしてください。
> コピーし忘れた場合は、古いトークンを削除して新しく作り直してください。

6. コピーしたトークンを `settings.json` の `"ghp_ここにGitHub PATを設定"` の部分にペースト

---

## 10. MCPサーバーの設定

**MCPサーバーとは**: Claude Codeが外部ツール（GitHub, データベース, ファイルシステムなど）と連携するための仕組みです。
MCPサーバーが接続されていると、Claude Codeが直接GitHubにPRを作ったり、データベースを検索したりできます。

### 10-1. 設定ファイルの確認

MCPサーバーの設定はプロジェクトルートの **`.mcp.json`** に書かれています。
このファイルはリポジトリに含まれているため、クローン時に**自動取得**されます。

### 10-2. 設定済みのMCPサーバー一覧

| サーバー | できること | 認証情報 |
|---------|-----------|---------|
| `filesystem` | プロジェクト内のファイルを読み書き | 不要 |
| `postgres` | SQLでデータベースを直接操作 | `.env.local` の `DATABASE_URL` を自動参照 |
| `github` | PR作成、issue管理、コード検索 | `settings.json` の `GITHUB_PERSONAL_ACCESS_TOKEN` を自動参照 |
| `memory` | 会話履歴の永続メモリ | 不要 |
| `supabase` | Supabaseプロジェクトの操作 | `.mcp.json` 内にトークン記載済み |

### 10-3. トークンの確認・再生成

`.mcp.json` 内にトークンが直接書かれているサーバー（supabase）があります。
旧PCと同じリポジトリをクローンしていれば、値はそのまま使えます。

**トークンが期限切れなどで動かない場合、以下で再生成してください:**

| サーバー | トークン再生成URL |
|---------|-----------------|
| Supabase | https://supabase.com/dashboard/account/tokens |
| GitHub | https://github.com/settings/tokens |

再生成したら `.mcp.json`（Supabase）または `~/.claude/settings.json`（GitHub）の該当箇所を書き換えてください。

---

## 11. Claude Codeのプロジェクト設定

**プロジェクト設定とは**: このプロジェクト専用のClaude Codeの設定です。
Claude Codeにどの操作を許可するか（ファイル編集OK、`rm -rf` は禁止、など）を定義します。

### 11-1. プロジェクトローカル設定ファイルの作成

> **このファイルは `.gitignore` に含まれるため、クローンでは取得されません。手動で作成する必要があります。**

**ファイルの場所**: `C:\Users\yuya\Desktop\Bonsai\bonsai-sns-project\.claude\settings.local.json`

#### 作成方法:

```bash
# プロジェクトフォルダに移動
cd ~/Desktop/Bonsai/bonsai-sns-project

# VS Codeで開く
code .claude/settings.local.json
```

以下の内容をまるごと貼り付けて保存（`Ctrl + S`）:

```json
{
  "permissions": {
    "allow": [
      "ViewFile",
      "ListFiles",
      "EditFile",
      "WebFetch",
      "Bash(mkdir:*)",
      "mcp__filesystem__list_directory",
      "Bash(npm install:*)",
      "Bash(npx shadcn@latest init -d)",
      "Bash(npm run build:*)",
      "Bash(npm run lint:*)",
      "Bash(npx shadcn@latest add:*)",
      "Bash(npm run db:seed:*)",
      "Bash(npx next:*)",
      "Bash(npx tsx:*)",
      "WebSearch",
      "Bash(npx tsc:*)",
      "Bash(node -e ':*)",
      "Bash(npx prisma:*)",
      "Bash(git add:*)",
      "Bash(git status:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(shutdown:*)",
      "Bash(reboot:*)",
      "Bash(chmod:*)",
      "ViewFile(.env*)",
      "ViewFile(~/.ssh/*)",
      "ViewFile(.git/*)"
    ],
    "defaultMode": "bypassPermissions"
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "filesystem",
    "postgres",
    "github",
    "memory"
  ],
  "skipDangerousModePermissionPrompt": true
}
```

#### 設定の意味:

| セクション | 説明 |
|-----------|------|
| `permissions.allow` | Claude Codeに**許可する操作**のリスト。ファイル閲覧、編集、ビルド、git操作など |
| `permissions.deny` | Claude Codeに**禁止する操作**のリスト。`rm -rf`（全削除）、`.env`の閲覧、SSHキーの閲覧など |
| `defaultMode: "bypassPermissions"` | 上記リスト以外の操作は確認なしで実行（上級者向け設定） |
| `enableAllProjectMcpServers` | `.mcp.json` のMCPサーバーを全て有効化 |
| `enabledMcpjsonServers` | 有効にするMCPサーバーの名前リスト |

### 11-2. リポジトリに含まれる設定（自動取得・設定不要）

以下のファイルはリポジトリにコミットされているため、クローン時に自動取得されます:

| ファイル | 役割 |
|---------|------|
| `CLAUDE.md` | プロジェクト全体の指示書（開発コマンド、コーディング規約など） |
| `.claude/rules/auth-nextauth.md` | 認証（NextAuth）のルール |
| `.claude/rules/nextjs-components.md` | コンポーネント設計のルール |
| `.claude/rules/nextjs-data-fetching.md` | データ取得のルール |
| `.claude/rules/nextjs-error-handling.md` | エラーハンドリングのルール |
| `.claude/rules/nextjs-performance.md` | パフォーマンス最適化のルール |
| `.claude/rules/nextjs-api-routes.md` | APIルートのルール |
| `.claude/rules/nextjs-proxy.md` | Proxyのルール |
| `.claude/rules/prisma-database.md` | データベース操作のルール |
| `.claude/rules/server-actions.md` | Server Actionのルール |
| `.claude/rules/pesticide-validation.md` | 農薬データ検証のルール |
| `.claude/rules/testing.md` | テストのルール |
| `.claude/rules/setup-docker.md` | Docker環境のルール |

---

## 12. Claude Codeのメモリ復元

**メモリとは**: Claude Codeが「以前の会話で学んだこと」を保存しているファイルです。
例えば「pushしてと言われたら全ファイルをプッシュする」「シードを勝手にDBに反映しない」といったルールが保存されています。

### 12-1. メモリファイルの場所

メモリは PC上の以下のフォルダに保存されています:

```
C:\Users\yuya\.claude\projects\C--Users-yuya-Desktop-Bonsai-bonsai-sns-project\memory\
```

> **フォルダ名の意味**: `C--Users-yuya-Desktop-Bonsai-bonsai-sns-project` はプロジェクトのフルパスをハイフンで繋いだものです。
> ユーザー名やプロジェクトの場所が変わるとフォルダ名も変わります。

### 12-2. 方法A: 旧PCからファイルをコピー（推奨）

旧PCの上記フォルダから、以下の4ファイルを新PCの同じ場所にコピーします:

| ファイル | 内容 |
|---------|------|
| `MEMORY.md` | メモリの目次（インデックス） |
| `feedback_commit_push.md` | 「全部プッシュ」指示時の挙動ルール |
| `feedback_seed_manual_only.md` | 本番シードは手動実行のみ |
| `feedback_version_check.md` | バージョン記載時は実値を確認するルール |

#### コピー先フォルダが存在しない場合:

1. まずClaude Codeをプロジェクトディレクトリで一度起動する:
   ```bash
   cd ~/Desktop/Bonsai/bonsai-sns-project
   claude
   ```
2. 何か一言話しかけて（「こんにちは」など）から `/exit` で終了
3. これでフォルダが自動作成される
4. 旧PCのメモリファイルをコピーする

### 12-3. 方法B: Claude Codeに口頭で伝える（ファイルコピーできない場合）

旧PCのファイルが手に入らない場合は、Claude Codeを起動して以下のように伝えてください:

```
以下のルールを覚えてください:
1. 「全部プッシュ」と言ったら、全ファイルをコミット＆プッシュしてください。ファイル種別で勝手に除外しないでください。
2. 本番DBへのシード反映（seed実行）は、私が明示的に指示した場合のみ実行してください。自動で実行しないでください。
3. ドキュメントにバージョン番号を書く時は、package.jsonの値ではなく npx <tool> --version で実際のバージョンを確認してください。
```

---

## 13. 動作確認

すべてのセットアップが完了したら、以下の順で動作確認をしてください。

### 13-1. 開発サーバー

```bash
cd ~/Desktop/Bonsai/bonsai-sns-project
npm run dev
```

ブラウザで http://localhost:3000 にアクセスして、アプリが表示されることを確認。

> **初回は時間がかかります**: Next.jsがコードをコンパイルするため、最初のページ表示まで10〜30秒ほどかかることがあります。

終了するときは、ターミナルで `Ctrl + C` を押します。

### 13-2. ビルド（本番用のコンパイル）

```bash
npm run build
```

エラーなく `✓ Compiled successfully` と表示されればOK。

### 13-3. Lint（コード品質チェック）

```bash
npm run lint
```

### 13-4. テスト

```bash
# ユニットテスト（個々の関数・コンポーネントのテスト）
npm test

# E2Eテスト（ブラウザを自動操作するテスト）
# 初回はブラウザのダウンロードが必要
npx playwright install
npm run test:e2e
```

### 13-5. Claude Codeの動作確認

```bash
cd ~/Desktop/Bonsai/bonsai-sns-project
claude
```

起動後、以下を確認してください:

| 確認項目 | 確認方法 |
|---------|---------|
| CLAUDE.mdが読み込まれている | 起動時のログに `CLAUDE.md` が表示される |
| MCPサーバーが接続されている | `/mcp` と入力して、各サーバーの状態を確認 |
| メモリが復元されている | 「覚えていることを教えて」と聞いてみる |

---

## 14. トラブルシューティング

### `node --version` で「認識されていません」と出る

**原因**: Node.jsのインストールが完了していないか、PATHが通っていない

**対処**:
1. PCを再起動する
2. それでもダメなら Node.js を再インストール
3. インストール時に「Add to PATH」にチェックが入っていることを確認

### `npm install` でネイティブモジュールのビルドに失敗する

**原因**: C++コンパイラがインストールされていない

**対処**:
```bash
# 管理者権限のターミナルで実行
npm install --global windows-build-tools
```
または Node.js インストーラーを再実行して「Tools for Native Modules」にチェックを入れる

### `sharp` のインストールに失敗する

**原因**: 画像処理ライブラリ `sharp` のネイティブバイナリがダウンロードできない

**対処**:
```bash
npm install --platform=win32 --arch=x64 sharp
```

### Docker Desktopが起動しない

**原因**: WSL 2が有効化されていない

**対処**:
1. PowerShellを**管理者として実行**（スタートメニューで「PowerShell」を右クリック →「管理者として実行」）
2. 以下を実行:
   ```powershell
   wsl --install
   ```
3. PCを再起動
4. Docker Desktopを再度起動

### `npx prisma generate` でエラーが出る

**対処**:
```bash
# node_modulesを一度削除して再インストール
rm -rf node_modules
npm install
npx prisma generate
```

### Claude CodeのMCPサーバーが接続できない

**対処**:
1. Claude Code内で `/mcp` を実行して、どのサーバーがエラーか確認
2. npxのキャッシュをクリア:
   ```bash
   npx clear-npx-cache
   ```
3. Claude Codeを再起動（`/exit` → `claude`）

### Playwrightのブラウザがインストールされていない

**症状**: `npm run test:e2e` で「Executable doesn't exist」エラー

**対処**:
```bash
# テスト用ブラウザをダウンロード（Chromium, Firefox, WebKit）
npx playwright install

# Chromiumだけでいい場合:
npx playwright install chromium
```

### ポート3000が別のアプリに使用されている

**症状**: `npm run dev` で「Port 3000 is already in use」

**対処**:
```bash
# ポート3000を使っているプロセスを特定
netstat -ano | findstr :3000

# 右端に表示されるPID（数字）を使ってプロセスを終了
taskkill /PID 12345 /F
# ↑ 12345 の部分を実際のPIDに置き換える
```

---

## 旧PCからコピーすべきファイル一覧（チェックリスト）

移行時にコピーが必要なファイルのまとめです。
**リポジトリに含まれるファイルはクローンで自動取得されるため、以下のファイルだけコピーすればOKです。**

| | ファイル | 場所 | 重要度 | 備考 |
|---|---------|------|-------|------|
| [ ] | `.env.local` | プロジェクトルート | **必須** | 環境変数。これがないとアプリが動かない |
| [ ] | `.claude/settings.local.json` | プロジェクトルート | 高 | Claude Code権限設定。なくても動くが毎回許可が必要になる |
| [ ] | `settings.json` | `~/.claude/` | 高 | Claude Codeグローバル設定 + GitHub PAT |
| [ ] | `memory/` フォルダ（4ファイル） | `~/.claude/projects/.../` | 中 | Claude Codeの学習済みルール。口頭でも再教育可能 |
| [ ] | `~/.ssh/` フォルダ | ホームディレクトリ | 中 | SSH鍵。新PCで再生成してGitHubに登録してもOK |

---

*このガイドは 2026-04-09 時点の環境に基づいています。*
*Node.js v22.14.0 / npm 11.7.0 / Git 2.47.1 / Docker 29.1.3 / Claude Code 2.1.96*
