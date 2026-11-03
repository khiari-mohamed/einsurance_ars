-- Additive renewal details and negotiation history. Existing affaires remain unchanged.
ALTER TABLE "Affaire" ADD COLUMN IF NOT EXISTS "renouvellementDetails" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NegotiationSubject') THEN
    CREATE TYPE "NegotiationSubject" AS ENUM ('PRIME_TAUX', 'RETENTION', 'CAPACITE', 'COMMISSION_COURTAGE', 'PARTICIPATION_BENEFICIAIRE', 'AUTRE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NegotiationStatus') THEN
    CREATE TYPE "NegotiationStatus" AS ENUM ('EN_COURS', 'ACCEPTEE', 'REFUSEE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AffaireNegotiation" (
  "id" TEXT NOT NULL,
  "affaireId" TEXT NOT NULL,
  "round" INTEGER NOT NULL DEFAULT 1,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "counterparty" TEXT NOT NULL,
  "subject" "NegotiationSubject" NOT NULL,
  "currentValue" TEXT,
  "proposedValue" TEXT,
  "status" "NegotiationStatus" NOT NULL DEFAULT 'EN_COURS',
  "deadline" TIMESTAMP(3),
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AffaireNegotiation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffaireNegotiation_affaireId_fkey" FOREIGN KEY ("affaireId") REFERENCES "Affaire"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AffaireNegotiation_affaireId_date_idx" ON "AffaireNegotiation"("affaireId", "date");
