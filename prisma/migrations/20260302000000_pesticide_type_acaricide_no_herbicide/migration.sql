-- Remove herbicide, add acaricide to PesticideType
-- Step 1: Update any herbicide to other
UPDATE "pesticides" SET "pesticide_type" = 'other' WHERE "pesticide_type" = 'herbicide';

-- Step 2: Create new enum without herbicide, with acaricide
CREATE TYPE "PesticideType_new" AS ENUM ('fungicide', 'insecticide', 'acaricide', 'other');

-- Step 3: Change column to use new enum
ALTER TABLE "pesticides" ALTER COLUMN "pesticide_type" TYPE "PesticideType_new" USING ("pesticide_type"::text::"PesticideType_new");

-- Step 4: Drop old enum and rename new one
DROP TYPE "PesticideType";
ALTER TYPE "PesticideType_new" RENAME TO "PesticideType";
