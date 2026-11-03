-- Additive nullable column: existing Affaire rows remain valid and unchanged.
ALTER TABLE "Affaire" ADD COLUMN IF NOT EXISTS "nom" TEXT;
