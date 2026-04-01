import { UserRole } from '../modules/users/users.entity';

export enum Permission {
  // System Management
  SYSTEM_SETTINGS = 'system:settings',
  USER_MANAGEMENT = 'user:management',
  
  // Client & Data Management
  CLIENT_CREATE = 'client:create',
  CLIENT_READ = 'client:read',
  CLIENT_UPDATE = 'client:update',
  CLIENT_DELETE = 'client:delete',
  
  // Affaires Management
  AFFAIRE_CREATE = 'affaire:create',
  AFFAIRE_READ = 'affaire:read',
  AFFAIRE_UPDATE = 'affaire:update',
  AFFAIRE_DELETE = 'affaire:delete',
  
  // Sinistres Management
  SINISTRE_CREATE = 'sinistre:create',
  SINISTRE_READ = 'sinistre:read',
  SINISTRE_UPDATE = 'sinistre:update',
  SINISTRE_DELETE = 'sinistre:delete',
  
  // Finance Management
  FINANCE_CREATE = 'finance:create',
  FINANCE_READ = 'finance:read',
  FINANCE_UPDATE = 'finance:update',
  FINANCE_DELETE = 'finance:delete',
  
  // Accounting Management
  ACCOUNTING_CREATE = 'accounting:create',
  ACCOUNTING_READ = 'accounting:read',
  ACCOUNTING_UPDATE = 'accounting:update',
  ACCOUNTING_DELETE = 'accounting:delete',
  
  // Reporting
  REPORT_VIEW = 'report:view',
  REPORT_EXPORT = 'report:export',
  
  // GED (Document Management)
  DOCUMENT_UPLOAD = 'document:upload',
  DOCUMENT_READ = 'document:read',
  DOCUMENT_DELETE = 'document:delete',
}

export const RolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMINISTRATEUR]: [
    Permission.SYSTEM_SETTINGS,
    Permission.USER_MANAGEMENT,
    Permission.CLIENT_READ,
    Permission.AFFAIRE_READ,
    Permission.SINISTRE_READ,
    Permission.FINANCE_READ,
    Permission.ACCOUNTING_READ,
    Permission.REPORT_VIEW,
    Permission.DOCUMENT_READ,
  ],
  
  [UserRole.DIRECTEUR_GENERAL]: [
    Permission.CLIENT_READ,
    Permission.AFFAIRE_READ,
    Permission.SINISTRE_READ,
    Permission.FINANCE_READ,
    Permission.ACCOUNTING_READ,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.DOCUMENT_READ,
  ],
  
  [UserRole.DIRECTEUR_COMMERCIAL]: [
    Permission.CLIENT_READ,
    Permission.AFFAIRE_READ,
    Permission.SINISTRE_READ,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.DOCUMENT_READ,
  ],
  
  [UserRole.DIRECTEUR_FINANCIER]: [
    Permission.CLIENT_READ,
    Permission.AFFAIRE_READ,
    Permission.SINISTRE_READ,
    Permission.FINANCE_READ,
    Permission.ACCOUNTING_READ,
    Permission.REPORT_VIEW,
    Permission.REPORT_EXPORT,
    Permission.DOCUMENT_READ,
  ],
  
  [UserRole.CHARGE_DE_DOSSIER]: [
    Permission.CLIENT_CREATE,
    Permission.CLIENT_READ,
    Permission.CLIENT_UPDATE,
    Permission.CLIENT_DELETE,
    Permission.AFFAIRE_CREATE,
    Permission.AFFAIRE_READ,
    Permission.AFFAIRE_UPDATE,
    Permission.AFFAIRE_DELETE,
    Permission.SINISTRE_READ,
    Permission.REPORT_VIEW,
    Permission.DOCUMENT_UPLOAD,
    Permission.DOCUMENT_READ,
    Permission.DOCUMENT_DELETE,
  ],
  
  [UserRole.RESPONSABLE_PRODUCTION]: [
    Permission.AFFAIRE_READ,
    Permission.REPORT_VIEW,
    Permission.DOCUMENT_UPLOAD,
    Permission.DOCUMENT_READ,
    Permission.DOCUMENT_DELETE,
  ],
  
  [UserRole.TECHNICIEN_SINISTRES]: [
    Permission.AFFAIRE_READ,
    Permission.SINISTRE_CREATE,
    Permission.SINISTRE_READ,
    Permission.SINISTRE_UPDATE,
    Permission.SINISTRE_DELETE,
    Permission.REPORT_VIEW,
    Permission.DOCUMENT_UPLOAD,
    Permission.DOCUMENT_READ,
  ],
  
  [UserRole.AGENT_FINANCIER]: [
    Permission.AFFAIRE_READ,
    Permission.SINISTRE_READ,
    Permission.FINANCE_CREATE,
    Permission.FINANCE_READ,
    Permission.FINANCE_UPDATE,
    Permission.FINANCE_DELETE,
    Permission.ACCOUNTING_READ,
    Permission.REPORT_VIEW,
    Permission.DOCUMENT_UPLOAD,
    Permission.DOCUMENT_READ,
  ],
  
  [UserRole.COMPTABLE]: [
    Permission.FINANCE_READ,
    Permission.ACCOUNTING_CREATE,
    Permission.ACCOUNTING_READ,
    Permission.ACCOUNTING_UPDATE,
    Permission.ACCOUNTING_DELETE,
    Permission.REPORT_VIEW,
    Permission.DOCUMENT_READ,
  ],
  
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return RolePermissions[role]?.includes(permission) || false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}
