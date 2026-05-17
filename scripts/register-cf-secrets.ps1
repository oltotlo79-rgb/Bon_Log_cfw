# ============================================================
# Cloudflare Workers Secrets 一括登録スクリプト (PowerShell)
# ============================================================
#
# 使い方:
#   1. 下の $secrets ハッシュテーブルの値を .env.local からコピーして埋める
#   2. PowerShell で:
#        .\scripts\register-cf-secrets.ps1 -Env staging
#      production にも反映する場合:
#        .\scripts\register-cf-secrets.ps1 -Env production
#
# 動作:
#   - 値が空 or <<placeholder>> のままの key は SKIP (Yellow)
#   - 各 key について `wrangler secret put $key --env $Env` を実行
#   - stdin 経由で値を渡すため、対話確認なしで一括登録できる
#
# 注意:
#   - .env.local や本ファイルの値部分は絶対に commit しないこと
#   - wrangler login 済みである必要がある
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('staging','production')]
    [string]$Env
)

$ErrorActionPreference = 'Stop'

# Wrangler 認証チェック
$wranglerAuth = wrangler whoami 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "wrangler login が必要です。先に 'wrangler login' を実行してください。"
    exit 1
}
Write-Host "Wrangler auth OK: $wranglerAuth" -ForegroundColor Green

# ステージング / 本番で URL を切り替える
$appUrl = if ($Env -eq 'staging') { "https://staging.bon-log.com" } else { "https://www.bon-log.com" }

$secrets = @{
    # === 認証 ===
    NEXTAUTH_SECRET = "<<.env.local の NEXTAUTH_SECRET をここに>>"
    NEXTAUTH_URL = $appUrl

    # === DB (Hyperdrive 利用時は接続情報は binding 経由なので不要) ===
    # Hyperdrive を使わず Supabase direct で接続する場合は DATABASE_URL を設定
    # DATABASE_URL = "<<.env.local の DATABASE_URL>>"
    SUPABASE_CA_CERT = "<<.env.local の SUPABASE_CA_CERT (Base64)>>"

    # === Google OAuth ===
    GOOGLE_CLIENT_ID = "<<.env.local の GOOGLE_CLIENT_ID>>"
    GOOGLE_CLIENT_SECRET = "<<.env.local の GOOGLE_CLIENT_SECRET>>"

    # === Stripe ===
    STRIPE_SECRET_KEY = "<<.env.local の STRIPE_SECRET_KEY>>"
    STRIPE_WEBHOOK_SECRET = "<<.env.local の STRIPE_WEBHOOK_SECRET>>"
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "<<.env.local の NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY>>"
    STRIPE_PRICE_ID_MONTHLY = "<<.env.local の STRIPE_PRICE_ID_MONTHLY>>"
    STRIPE_PRICE_ID_YEARLY = "<<.env.local の STRIPE_PRICE_ID_YEARLY>>"

    # === Email ===
    EMAIL_PROVIDER = "resend"
    RESEND_API_KEY = "<<.env.local の RESEND_API_KEY>>"
    EMAIL_FROM = "<<.env.local の EMAIL_FROM>>"

    # === Redis (Upstash) ===
    UPSTASH_REDIS_REST_URL = "<<.env.local の UPSTASH_REDIS_REST_URL>>"
    UPSTASH_REDIS_REST_TOKEN = "<<.env.local の UPSTASH_REDIS_REST_TOKEN>>"

    # === Storage (R2) ===
    STORAGE_PROVIDER = "r2"
    R2_ACCOUNT_ID = "<<.env.local の R2_ACCOUNT_ID>>"
    R2_ACCESS_KEY_ID = "<<.env.local の R2_ACCESS_KEY_ID>>"
    R2_SECRET_ACCESS_KEY = "<<.env.local の R2_SECRET_ACCESS_KEY>>"
    R2_BUCKET_NAME = "<<.env.local の R2_BUCKET_NAME>>"
    R2_PUBLIC_URL = "<<.env.local の R2_PUBLIC_URL>>"

    # === App URL ===
    NEXT_PUBLIC_APP_URL = $appUrl

    # === 2FA 暗号化キー (32 byte hex) ===
    TWO_FACTOR_ENCRYPTION_KEY = "<<.env.local の TWO_FACTOR_ENCRYPTION_KEY>>"

    # === Web Push (VAPID) ===
    VAPID_PRIVATE_KEY = "<<.env.local の VAPID_PRIVATE_KEY>>"
    NEXT_PUBLIC_VAPID_PUBLIC_KEY = "<<.env.local の NEXT_PUBLIC_VAPID_PUBLIC_KEY>>"
    VAPID_SUBJECT = "mailto:noreply@bon-log.com"

    # === Cron 認証 ===
    CRON_SECRET = "<<.env.local の CRON_SECRET>>"

    # === 検索モード ===
    SEARCH_MODE = "trgm"

    # === 広告 ===
    NEXT_PUBLIC_AD_PROVIDER = "ninja"

    # === Sentry (Phase 2 では shim のため無効でも可) ===
    # SENTRY_DSN = "<<.env.local の SENTRY_DSN>>"
    # NEXT_PUBLIC_SENTRY_DSN = "<<.env.local の NEXT_PUBLIC_SENTRY_DSN>>"

    # === Basic 認証 (staging を限定公開にしたい場合のみ) ===
    # BASIC_AUTH_ENABLED = "true"
    # BASIC_AUTH_USER = "..."
    # BASIC_AUTH_PASSWORD = "..."
}

$total = $secrets.Count
$registered = 0
$skipped = 0

foreach ($key in $secrets.Keys) {
    $value = $secrets[$key]
    if ([string]::IsNullOrWhiteSpace($value) -or $value -match '^<<.*>>$') {
        Write-Host "[SKIP] $key (値が未設定)" -ForegroundColor Yellow
        $skipped++
        continue
    }
    Write-Host "[PUT ] $key (env: $Env)" -ForegroundColor Cyan
    $value | wrangler secret put $key --env $Env
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to register secret: $key"
        exit 1
    }
    $registered++
}

Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "完了: $registered/$total 件登録, $skipped 件スキップ" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "登録された secret 一覧を確認するには:" -ForegroundColor White
Write-Host "  wrangler secret list --env $Env" -ForegroundColor White
