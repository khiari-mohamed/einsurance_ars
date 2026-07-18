import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, ROLE_PERMISSIONS } from '../../config/permissions.config';

// FIX: naive `perm.split(':')[0].toUpperCase()` produced two different
// override keys ('SYSTEM', 'USERS') for permissions that both belong to
// the single "Fichier" sidebar module per the CDC (1.1 + 1.2 both live
// under Fichier). An admin override like { FICHIER: 'NONE' } would
// silently do nothing against SYSTEM_READ/SYSTEM_UPDATE/USERS_MANAGE/
// SUPER_ADMIN. This map is the single source of truth for permission
// prefix -> sidebar module key, used by whatever builds the Fichier >
// Droits d'accès screen.
const MODULE_ALIAS: Record<string, string> = {
  system: 'FICHIER',
  users: 'FICHIER',
  affaires: 'AFFAIRES',
  sinistres: 'SINISTRES',
  finances: 'FINANCES',
  comptabilite: 'COMPTABILITE',
  donnees: 'DONNEES',
  ged: 'GED',
  reporting: 'REPORTING',
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Accès refusé');

    // Super admin bypasses everything
    if (user.role === 'SUPER_ADMIN') return true;

    // Get base permissions from role
    const rolePerms: Permission[] = ROLE_PERMISSIONS[user.role] ?? [];

    // Override with user-level module permissions if set — downgrade-only
    // (NONE / READ_ONLY), never grants beyond the role's own permissions.
    const moduleOverrides: Record<string, string> = user.modulePermissions ?? {};

    const hasPermission = required.every((perm) => {
      const [prefix] = perm.split(':');
      const module = MODULE_ALIAS[prefix] ?? prefix.toUpperCase();
      const override = moduleOverrides[module];

      if (override === 'NONE') return false;
      if (override === 'READ_ONLY' && !perm.endsWith(':read')) return false;

      return rolePerms.includes(perm);
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        `Vous n'avez pas les droits nécessaires: ${required.join(', ')}`,
      );
    }

    return true;
  }
}