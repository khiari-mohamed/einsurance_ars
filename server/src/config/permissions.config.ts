export enum Permission {
  // Affaires
  AFFAIRES_CREATE = 'affaires:create',
  AFFAIRES_READ = 'affaires:read',
  AFFAIRES_UPDATE = 'affaires:update',
  AFFAIRES_DELETE = 'affaires:delete',
  AFFAIRES_VALIDATE = 'affaires:validate',
  AFFAIRES_PLACE = 'affaires:place',

  // Sinistres
  SINISTRES_CREATE = 'sinistres:create',
  SINISTRES_READ = 'sinistres:read',
  SINISTRES_UPDATE = 'sinistres:update',
  SINISTRES_VALIDATE = 'sinistres:validate',
  SINISTRES_CLOSE = 'sinistres:close',

  // Finances
  FINANCES_READ = 'finances:read',
  FINANCES_CREATE = 'finances:create',
  FINANCES_UPDATE = 'finances:update',
  FINANCES_APPROVE = 'finances:approve',

  // Comptabilite
  COMPTABILITE_READ = 'comptabilite:read',
  COMPTABILITE_CREATE = 'comptabilite:create',
  COMPTABILITE_VALIDATE = 'comptabilite:validate',
  COMPTABILITE_EXPORT = 'comptabilite:export',

  // Master Data
  DONNEES_READ = 'donnees:read',
  DONNEES_CREATE = 'donnees:create',
  DONNEES_UPDATE = 'donnees:update',
  DONNEES_DELETE = 'donnees:delete',

  // GED
  GED_READ = 'ged:read',
  GED_UPLOAD = 'ged:upload',
  GED_DELETE = 'ged:delete',

  // System
  SYSTEM_READ = 'system:read',
  SYSTEM_UPDATE = 'system:update',
  USERS_MANAGE = 'users:manage',
  SUPER_ADMIN = 'system:super_admin',

  // Reporting
  REPORTING_READ = 'reporting:read',
  REPORTING_EXPORT = 'reporting:export',

  // ============================================================
  // NEW (Bordereaux pass): Bordereaux straddles Affaires (creation/
  // validation, driven by DIRECTION_REASSURANCE) and Finances (payment
  // recording/archival, driven by DAF). Gating every route on AFFAIRES_*
  // alone (the original shape) left DAF — who owns pay()/archive() per
  // the CDC — unable to even GET /bordereaux, since DAF's role has no
  // AFFAIRES_READ at all. These are additive; nothing else references them,
  // so no other module's behavior changes.
  // ============================================================
  BORDEREAUX_READ = 'bordereaux:read',
  BORDEREAUX_CREATE = 'bordereaux:create',
  BORDEREAUX_VALIDATE = 'bordereaux:validate',   // submit/validate/reject/send/reminder
  BORDEREAUX_PAY = 'bordereaux:pay',             // pay/archive
}

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission),

  DIRECTION_REASSURANCE: [
    Permission.AFFAIRES_CREATE,
    Permission.AFFAIRES_READ,
    Permission.AFFAIRES_UPDATE,
    Permission.AFFAIRES_DELETE,
    Permission.AFFAIRES_VALIDATE,
    Permission.AFFAIRES_PLACE,
    Permission.SINISTRES_CREATE,
    Permission.SINISTRES_READ,
    Permission.SINISTRES_UPDATE,
    Permission.SINISTRES_VALIDATE,
    Permission.SINISTRES_CLOSE,
    Permission.DONNEES_READ,
    Permission.DONNEES_CREATE,
    Permission.DONNEES_UPDATE,
    Permission.GED_READ,
    Permission.GED_UPLOAD,
    Permission.REPORTING_READ,
    // NEW: they create/validate/send bordereaux (generate(), submit,
    // validate, reject, send) — mirrors their AFFAIRES_VALIDATE scope.
    Permission.BORDEREAUX_READ,
    Permission.BORDEREAUX_CREATE,
    Permission.BORDEREAUX_VALIDATE,
  ],

  DIRECTION_COMMERCIALE: [
    Permission.AFFAIRES_CREATE,
    Permission.AFFAIRES_READ,
    Permission.DONNEES_READ,
    Permission.GED_READ,
    Permission.GED_UPLOAD,
    // NEW: read-only visibility into bordereaux tied to affaires they created.
    Permission.BORDEREAUX_READ,
  ],

  DIRECTION_GENERALE: [
    Permission.AFFAIRES_READ,
    Permission.SINISTRES_READ,
    Permission.FINANCES_READ,
    Permission.COMPTABILITE_READ,
    Permission.DONNEES_READ,
    Permission.GED_READ,
    Permission.REPORTING_READ,
    Permission.REPORTING_EXPORT,
    // NEW: matches their stated "Read-only all modules" scope.
    Permission.BORDEREAUX_READ,
  ],

  DAF: [
    Permission.FINANCES_READ,
    Permission.FINANCES_CREATE,
    Permission.FINANCES_UPDATE,
    Permission.FINANCES_APPROVE,
    Permission.COMPTABILITE_READ,
    Permission.COMPTABILITE_CREATE,
    Permission.COMPTABILITE_VALIDATE,
    Permission.COMPTABILITE_EXPORT,
    Permission.GED_READ,
    Permission.GED_UPLOAD,
    // NEW: this is the actual fix — DAF can now read bordereaux and
    // record payments/archive them, which they could not do at all before.
    Permission.BORDEREAUX_READ,
    Permission.BORDEREAUX_PAY,
  ],

  SERVICE_IRDS: [
    Permission.SINISTRES_READ,
    Permission.SINISTRES_UPDATE,
    Permission.SINISTRES_CLOSE,
    Permission.GED_READ,
    Permission.GED_UPLOAD,
  ],
};