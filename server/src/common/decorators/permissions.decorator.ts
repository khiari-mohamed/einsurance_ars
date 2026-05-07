import { SetMetadata } from '@nestjs/common';
import { Permission } from '../../config/permissions.config';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const CurrentUser = () => {
  const { createParamDecorator, ExecutionContext } = require('@nestjs/common');
  return createParamDecorator((_: unknown, ctx: typeof ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  })();
};