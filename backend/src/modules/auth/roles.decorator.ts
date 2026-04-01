import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/users.entity';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
