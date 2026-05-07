import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, ROLE_PERMISSIONS } from '../../config/permissions.config';

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

    // Override with user-level module permissions if set
    const moduleOverrides: Record<string, string> = user.modulePermissions ?? {};

    const hasPermission = required.every((perm) => {
      // Check module-level override
      const [module] = perm.split(':');
      const override = moduleOverrides[module.toUpperCase()];
      if (override === 'NONE') return false;
      if (override === 'READ_ONLY' && !perm.includes(':read')) return false;

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