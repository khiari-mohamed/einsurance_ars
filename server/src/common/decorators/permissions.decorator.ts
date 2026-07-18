import { SetMetadata } from '@nestjs/common';
import { Permission } from '../../config/permissions.config';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// FIX: previously CurrentUser was defined inline here with a `require()`
// call inside the decorator factory body — untyped and re-executed on
// every decorator application for no reason. The real implementation now
// lives in current-user.decorator.ts; re-exported here so any existing
// imports of `CurrentUser` from this file keep working unchanged.
export { CurrentUser } from './current-user.decorator';