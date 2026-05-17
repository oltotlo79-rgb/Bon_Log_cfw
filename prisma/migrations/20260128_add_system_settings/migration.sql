-- CreateTable: EmailBlacklist
CREATE TABLE "email_blacklist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_blacklist_email_key" ON "email_blacklist"("email");

-- CreateIndex
CREATE INDEX "email_blacklist_email_idx" ON "email_blacklist"("email");

-- CreateTable: DeviceBlacklist
CREATE TABLE "device_blacklist" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "reason" TEXT,
    "original_email" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_blacklist_fingerprint_key" ON "device_blacklist"("fingerprint");

-- CreateIndex
CREATE INDEX "device_blacklist_fingerprint_idx" ON "device_blacklist"("fingerprint");

-- CreateTable: UserDevice
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_user_id_fingerprint_key" ON "user_devices"("user_id", "fingerprint");

-- CreateIndex
CREATE INDEX "user_devices_user_id_idx" ON "user_devices"("user_id");

-- CreateIndex
CREATE INDEX "user_devices_fingerprint_idx" ON "user_devices"("fingerprint");

-- CreateTable: SystemSetting
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");
