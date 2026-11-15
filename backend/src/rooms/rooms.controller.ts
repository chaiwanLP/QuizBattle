import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { PublicUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  createRoomSchema,
  roomCodeSchema,
  type CreateRoomInput,
} from './rooms.schemas';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  /** Hosts create a room for one of their quizzes. */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: PublicUser,
    @Body({ schema: createRoomSchema }) body: CreateRoomInput,
  ) {
    return this.rooms.create(user, body.quizId);
  }

  /** Anyone with the code can look up the lobby (e.g. the join screen). */
  @Get(':code')
  get(@Param('code') code: string) {
    const parsed = roomCodeSchema.safeParse(code);
    if (!parsed.success) {
      throw new BadRequestException('Invalid room code');
    }
    return this.rooms.getState(code);
  }
}
