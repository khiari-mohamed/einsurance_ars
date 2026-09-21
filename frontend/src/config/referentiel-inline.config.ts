/**
 * TEMPORARY OPERATIONAL BRIDGE — Référentiel inline editing.
 *
 * Context: the client's production Référentiel data isn't ready yet, so the
 * Affaires dropdowns (Cédante / Assuré / Réassureur) come back empty and no
 * affaire can be created or tested. Rather than seed fake data (explicitly
 * refused by the client) or build a shadow entity inside Affaires, we let
 * users create/modify/delete the REAL Référentiel records straight from the
 * dropdown. Source of truth stays the Référentiel module — nothing to
 * migrate later.
 *
 * This flag exists so the whole thing can be switched off in one place once
 * real data lands: the dropdowns keep working exactly as they do today,
 * they just stop offering the Ajouter/Modifier/Supprimer actions.
 *
 * Set VITE_REFERENTIEL_INLINE_EDIT=false in the production .env to disable.
 * Defaults to enabled (the current testing situation) so a missing var
 * doesn't silently break the client's ability to test.
 */
export const REFERENTIEL_INLINE_EDIT_ENABLED =
  (import.meta.env.VITE_REFERENTIEL_INLINE_EDIT as string | undefined) !== 'false';