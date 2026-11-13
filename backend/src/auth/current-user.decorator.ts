import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PublicUser } from './auth.types';

type AuthenticatedRequest = Request & { user?: PublicUser };

/** Injects the user that JwtAuthGuard loaded for the current request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user as PublicUser;
  },
);
