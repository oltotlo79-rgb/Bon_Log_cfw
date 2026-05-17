-- CreateEnum
CREATE TYPE "HormoneCategory" AS ENUM ('major', 'secondary');

-- CreateTable
CREATE TABLE "hormone_types" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100),
    "slug" TEXT NOT NULL,
    "category" "HormoneCategory" NOT NULL,
    "chemical_formula" VARCHAR(50),
    "description" TEXT,
    "bonsai_role" TEXT,
    "production_site" TEXT,
    "practical_tips" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "activation_method" TEXT,

    CONSTRAINT "hormone_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hormone_effects" (
    "id" TEXT NOT NULL,
    "hormone_id" TEXT NOT NULL,
    "effect_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_promoting" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hormone_effects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hormone_interactions" (
    "id" TEXT NOT NULL,
    "hormone_a_id" TEXT NOT NULL,
    "hormone_b_id" TEXT NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "description" TEXT,
    "bonsai_relevance" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hormone_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hormone_columns" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "published_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hormone_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hormone_seasonal_levels" (
    "id" TEXT NOT NULL,
    "hormone_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "level" VARCHAR(20) NOT NULL,
    "description" TEXT,

    CONSTRAINT "hormone_seasonal_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hormone_types_slug_key" ON "hormone_types"("slug");

-- CreateIndex
CREATE INDEX "hormone_types_category_idx" ON "hormone_types"("category");

-- CreateIndex
CREATE INDEX "hormone_effects_hormone_id_idx" ON "hormone_effects"("hormone_id");

-- CreateIndex
CREATE UNIQUE INDEX "hormone_interactions_hormone_a_id_hormone_b_id_key" ON "hormone_interactions"("hormone_a_id", "hormone_b_id");

-- CreateIndex
CREATE INDEX "hormone_interactions_hormone_a_id_idx" ON "hormone_interactions"("hormone_a_id");

-- CreateIndex
CREATE INDEX "hormone_interactions_hormone_b_id_idx" ON "hormone_interactions"("hormone_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "hormone_columns_slug_key" ON "hormone_columns"("slug");

-- CreateIndex
CREATE INDEX "hormone_columns_category_idx" ON "hormone_columns"("category");

-- CreateIndex
CREATE UNIQUE INDEX "hormone_seasonal_levels_hormone_id_month_key" ON "hormone_seasonal_levels"("hormone_id", "month");

-- CreateIndex
CREATE INDEX "hormone_seasonal_levels_hormone_id_idx" ON "hormone_seasonal_levels"("hormone_id");

-- AddForeignKey
ALTER TABLE "hormone_effects" ADD CONSTRAINT "hormone_effects_hormone_id_fkey" FOREIGN KEY ("hormone_id") REFERENCES "hormone_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hormone_interactions" ADD CONSTRAINT "hormone_interactions_hormone_a_id_fkey" FOREIGN KEY ("hormone_a_id") REFERENCES "hormone_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hormone_interactions" ADD CONSTRAINT "hormone_interactions_hormone_b_id_fkey" FOREIGN KEY ("hormone_b_id") REFERENCES "hormone_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hormone_seasonal_levels" ADD CONSTRAINT "hormone_seasonal_levels_hormone_id_fkey" FOREIGN KEY ("hormone_id") REFERENCES "hormone_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "hormone_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hormone_effects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hormone_interactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hormone_columns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hormone_seasonal_levels" ENABLE ROW LEVEL SECURITY;
