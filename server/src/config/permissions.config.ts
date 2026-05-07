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

  // Reporting
  REPORTING_READ = 'reporting:read',
  REPORTING_EXPORT = 'reporting:export',
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
  ],

  DIRECTION_COMMERCIALE: [
    Permission.AFFAIRES_CREATE,
    Permission.AFFAIRES_READ,
    Permission.DONNEES_READ,
    Permission.GED_READ,
    Permission.GED_UPLOAD,
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
  ],

  SERVICE_IRDS: [
    Permission.SINISTRES_READ,
    Permission.SINISTRES_UPDATE,
    Permission.SINISTRES_CLOSE,
    Permission.GED_READ,
    Permission.GED_UPLOAD,
  ],
};