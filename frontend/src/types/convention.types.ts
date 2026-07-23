// Types matching ConventionsController / ConventionsService / AttachConventionDto
// exactly. Conventions are polymorphic (CEDANTE | REASSUREUR | CO_COURTIER) —
// exactly one of cedanteId/reassureurId/coCourtId will be set depending on
// partnerType, mirroring the Convention Prisma model.

export type ConventionPartnerType = 'CEDANTE' | 'REASSUREUR' | 'CO_COURTIER';

// Subset of the Document model actually useful to display — matches what
// `include: { document: true }` returns on Convention queries.
export interface ConventionDocument {
  id: string;
  nom: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  filePath: string;
  documentType?: string;
  createdAt: string;
}

export interface Convention {
  id: string;
  cedanteId?: string;
  reassureurId?: string;
  coCourtId?: string;
  documentId: string;
  document: ConventionDocument;
  dateSignature?: string;
  dateEffet?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}