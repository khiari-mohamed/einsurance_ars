import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// modulePermissions: per-user override on top of role defaults (CDC 1.2
// Section 1). FIX: corrected to match what PermissionsGuard actually reads
// — a flat map of sidebar-module-key -> 'NONE' | 'READ_ONLY', downgrade-only.
// There is currently no mechanism to grant a user access beyond their
// role's default permissions; flag to the client if that's needed.
export interface CurrentUserPayload {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  isActive: boolean;
  isLocked: boolean;
  modulePermissions: Record<string, 'NONE' | 'READ_ONLY'> | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: CurrentUserPayload = request.user;
    return data ? user?.[data] : user;
  },
);