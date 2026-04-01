import { useAuthStore } from '../lib/store';
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions } from '../config/permissions';

export function usePermissions() {
  const { user } = useAuthStore();
  const userRole = user?.role || 'CHARGE_DE_DOSSIER';

  return {
    hasPermission: (permission: Permission) => hasPermission(userRole, permission),
    hasAnyPermission: (permissions: Permission[]) => hasAnyPermission(userRole, permissions),
    hasAllPermissions: (permissions: Permission[]) => hasAllPermissions(userRole, permissions),
    canCreate: (module: 'client' | 'affaire' | 'sinistre' | 'finance' | 'accounting') => {
      const permissionMap = {
        client: Permission.CLIENT_CREATE,
        affaire: Permission.AFFAIRE_CREATE,
        sinistre: Permission.SINISTRE_CREATE,
        finance: Permission.FINANCE_CREATE,
        accounting: Permission.ACCOUNTING_CREATE,
      };
      return hasPermission(userRole, permissionMap[module]);
    },
    canUpdate: (module: 'client' | 'affaire' | 'sinistre' | 'finance' | 'accounting') => {
      const permissionMap = {
        client: Permission.CLIENT_UPDATE,
        affaire: Permission.AFFAIRE_UPDATE,
        sinistre: Permission.SINISTRE_UPDATE,
        finance: Permission.FINANCE_UPDATE,
        accounting: Permission.ACCOUNTING_UPDATE,
      };
      return hasPermission(userRole, permissionMap[module]);
    },
    canDelete: (module: 'client' | 'affaire' | 'sinistre' | 'finance' | 'accounting') => {
      const permissionMap = {
        client: Permission.CLIENT_DELETE,
        affaire: Permission.AFFAIRE_DELETE,
        sinistre: Permission.SINISTRE_DELETE,
        finance: Permission.FINANCE_DELETE,
        accounting: Permission.ACCOUNTING_DELETE,
      };
      return hasPermission(userRole, permissionMap[module]);
    },
    isAdmin: () => userRole === 'ADMINISTRATEUR',
    isDirecteurGeneral: () => userRole === 'DIRECTEUR_GENERAL',
    isDirecteurCommercial: () => userRole === 'DIRECTEUR_COMMERCIAL',
    isDirecteurFinancier: () => userRole === 'DIRECTEUR_FINANCIER',
    isChargeDeDossier: () => userRole === 'CHARGE_DE_DOSSIER',
    isResponsableProduction: () => userRole === 'RESPONSABLE_PRODUCTION',
    isTechnicienSinistres: () => userRole === 'TECHNICIEN_SINISTRES',
    isAgentFinancier: () => userRole === 'AGENT_FINANCIER',
    isComptable: () => userRole === 'COMPTABLE',
  };
}
