-- CreateTable
-- メール確認用トークン（登録後のアドレス確認）
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_verification_tokens_token_key" UNIQUE ("token"),
    CONSTRAINT "email_verification_tokens_email_token_key" UNIQUE ("email", "token")
);
