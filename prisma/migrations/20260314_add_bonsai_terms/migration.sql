-- CreateTable
CREATE TABLE "bonsai_terms" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "term" VARCHAR(100) NOT NULL,
    "reading" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonsai_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bonsai_terms_slug_key" ON "bonsai_terms"("slug");

-- CreateIndex
CREATE INDEX "bonsai_terms_category_idx" ON "bonsai_terms"("category");

-- CreateIndex
CREATE INDEX "bonsai_terms_reading_idx" ON "bonsai_terms"("reading");
