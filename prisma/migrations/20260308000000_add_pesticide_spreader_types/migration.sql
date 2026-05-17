-- CreateTable: PesticideSpreaderType (薬剤と展着剤の多対多)
CREATE TABLE "pesticide_spreader_types" (
    "pesticide_id" TEXT NOT NULL,
    "spreader_type_id" TEXT NOT NULL,

    CONSTRAINT "pesticide_spreader_types_pkey" PRIMARY KEY ("pesticide_id","spreader_type_id")
);

-- CreateIndex
CREATE INDEX "pesticide_spreader_types_spreader_type_id_idx" ON "pesticide_spreader_types"("spreader_type_id");

-- AddForeignKey
ALTER TABLE "pesticide_spreader_types" ADD CONSTRAINT "pesticide_spreader_types_pesticide_id_fkey" FOREIGN KEY ("pesticide_id") REFERENCES "pesticides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesticide_spreader_types" ADD CONSTRAINT "pesticide_spreader_types_spreader_type_id_fkey" FOREIGN KEY ("spreader_type_id") REFERENCES "spreader_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (Supabase 等)
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.pesticide_spreader_types'::regclass) THEN
    ALTER TABLE public.pesticide_spreader_types ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "postgres_only" ON public.pesticide_spreader_types;
  DROP POLICY IF EXISTS "allow_app_postgres" ON public.pesticide_spreader_types;
  CREATE POLICY "allow_app_postgres" ON public.pesticide_spreader_types
    FOR ALL TO postgres USING (true) WITH CHECK (true);
END $$;
