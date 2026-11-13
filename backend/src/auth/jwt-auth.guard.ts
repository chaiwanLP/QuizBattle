import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from './auth.constants';
import type { PublicUser } from './auth.types';
import { AuthService } from './auth.service';

type AuthenticatedRequest = Request & {
  cookies?: Record<string, string | undefined>;
  user?: PublicUser;
};

function extractToken(request: AuthenticatedRequest): string | undefined {
  const cookieToken = request.cookies?.[ACCESS_TOKEN_COOKIE];
  if (cookieToken) return cookieToken;

  // Also accept "Authorization: Bearer <token>" so tools and future mobile
  // clients can use the same API.
  const header = request.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  return undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const user = await this.auth.verifyToken(token);
    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    request.user = user;
    return true;
  }
}
