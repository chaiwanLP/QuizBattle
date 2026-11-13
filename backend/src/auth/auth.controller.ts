import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './auth.schemas';
import { AuthService } from './auth.service';
import { ACCESS_TOKEN_COOKIE, SESSION_TTL_MS } from './auth.constants';
import type { PublicUser } from './auth.types';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body({ schema: registerSchema }) body: RegisterInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const user = await this.auth.register(body);
    await this.startSession(response, user);
    return user;
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicUser> {
    const user = await this.auth.validateCredentials(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.startSession(response, user);
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(ACCESS_TOKEN_COOKIE, this.baseCookieOptions());
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: PublicUser): PublicUser {
    return user;
  }

  private async startSession(
    response: Response,
    user: PublicUser,
  ): Promise<void> {
    const token = await this.auth.signToken(user);
    response.cookie(ACCESS_TOKEN_COOKIE, token, {
      ...this.baseCookieOptions(),
      maxAge: SESSION_TTL_MS,
    });
  }

  private baseCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      path: '/',
    };
  }
}
