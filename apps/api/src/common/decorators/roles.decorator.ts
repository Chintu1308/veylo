import { SetMetadata } from '@nestjs/common';

/**
 * Roles decorator to secure routes with specific role permissions.
 * Usage: @Roles('org_admin', 'security_analyst')
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
