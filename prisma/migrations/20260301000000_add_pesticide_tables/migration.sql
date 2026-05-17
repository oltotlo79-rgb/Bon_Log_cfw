-- CreateEnum: DiseasePestCategory
CREATE TYPE "DiseasePestCategory" AS ENUM ('disease', 'pest');

-- CreateEnum: EffectRating
CREATE TYPE "EffectRating" AS ENUM ('excellent', 'good', 'fair', 'poor');

-- CreateEnum: PesticideType
CREATE TYPE "PesticideType" AS ENUM ('fungicide', 'insecticide', 'herbicide', 'other');

-- CreateTable: FormulationType
CREATE TABLE "formulation_types" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "formulation_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DiseasePest
CREATE TABLE "disease_pests" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_kana" VARCHAR(100),
    "category" "DiseasePestCategory" NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disease_pests_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ActiveIngredient
CREATE TABLE "active_ingredients" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "name_en" VARCHAR(200),
    "frac_code" VARCHAR(20),
    "irac_code" VARCHAR(20),
    "ingredient_group" VARCHAR(200),
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Pesticide
CREATE TABLE "pesticides" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "registration_number" VARCHAR(20),
    "pesticide_type" "PesticideType" NOT NULL,
    "formulation_type_id" TEXT,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pesticides_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SpreaderType
CREATE TABLE "spreader_types" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "effect" TEXT,
    "usage_note" TEXT,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spreader_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PesticideColumn
CREATE TABLE "pesticide_columns" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "published_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pesticide_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PesticideActiveIngredient
CREATE TABLE "pesticide_active_ingredients" (
    "pesticide_id" TEXT NOT NULL,
    "active_ingredient_id" TEXT NOT NULL,
    "content_label" VARCHAR(100),

    CONSTRAINT "pesticide_active_ingredients_pkey" PRIMARY KEY ("pesticide_id","active_ingredient_id")
);

-- CreateTable: PesticideEffect
CREATE TABLE "pesticide_effects" (
    "id" TEXT NOT NULL,
    "pesticide_id" TEXT NOT NULL,
    "disease_pest_id" TEXT NOT NULL,
    "prevention_level" "EffectRating",
    "treatment_level" "EffectRating",
    "efficacy_level" "EffectRating",
    "persistence_level" "EffectRating",
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pesticide_effects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "formulation_types_code_key" ON "formulation_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "disease_pests_slug_key" ON "disease_pests"("slug");

-- CreateIndex
CREATE INDEX "disease_pests_category_idx" ON "disease_pests"("category");

-- CreateIndex
CREATE UNIQUE INDEX "active_ingredients_slug_key" ON "active_ingredients"("slug");

-- CreateIndex
CREATE INDEX "active_ingredients_frac_code_idx" ON "active_ingredients"("frac_code");

-- CreateIndex
CREATE INDEX "active_ingredients_irac_code_idx" ON "active_ingredients"("irac_code");

-- CreateIndex
CREATE UNIQUE INDEX "pesticides_slug_key" ON "pesticides"("slug");

-- CreateIndex
CREATE INDEX "pesticides_registration_number_idx" ON "pesticides"("registration_number");

-- CreateIndex
CREATE INDEX "pesticides_pesticide_type_idx" ON "pesticides"("pesticide_type");

-- CreateIndex
CREATE INDEX "pesticides_formulation_type_id_idx" ON "pesticides"("formulation_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "spreader_types_code_key" ON "spreader_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "spreader_types_slug_key" ON "spreader_types"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "pesticide_columns_slug_key" ON "pesticide_columns"("slug");

-- CreateIndex
CREATE INDEX "pesticide_columns_category_idx" ON "pesticide_columns"("category");

-- CreateIndex
CREATE INDEX "pesticide_columns_published_at_idx" ON "pesticide_columns"("published_at");

-- CreateIndex
CREATE INDEX "pesticide_active_ingredients_active_ingredient_id_idx" ON "pesticide_active_ingredients"("active_ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesticide_effects_pesticide_id_disease_pest_id_key" ON "pesticide_effects"("pesticide_id", "disease_pest_id");

-- CreateIndex
CREATE INDEX "pesticide_effects_disease_pest_id_idx" ON "pesticide_effects"("disease_pest_id");

-- AddForeignKey: pesticides.formulation_type_id -> formulation_types.id
ALTER TABLE "pesticides" ADD CONSTRAINT "pesticides_formulation_type_id_fkey" FOREIGN KEY ("formulation_type_id") REFERENCES "formulation_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: pesticide_active_ingredients.pesticide_id -> pesticides.id
ALTER TABLE "pesticide_active_ingredients" ADD CONSTRAINT "pesticide_active_ingredients_pesticide_id_fkey" FOREIGN KEY ("pesticide_id") REFERENCES "pesticides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: pesticide_active_ingredients.active_ingredient_id -> active_ingredients.id
ALTER TABLE "pesticide_active_ingredients" ADD CONSTRAINT "pesticide_active_ingredients_active_ingredient_id_fkey" FOREIGN KEY ("active_ingredient_id") REFERENCES "active_ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: pesticide_effects.pesticide_id -> pesticides.id
ALTER TABLE "pesticide_effects" ADD CONSTRAINT "pesticide_effects_pesticide_id_fkey" FOREIGN KEY ("pesticide_id") REFERENCES "pesticides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: pesticide_effects.disease_pest_id -> disease_pests.id
ALTER TABLE "pesticide_effects" ADD CONSTRAINT "pesticide_effects_disease_pest_id_fkey" FOREIGN KEY ("disease_pest_id") REFERENCES "disease_pests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
