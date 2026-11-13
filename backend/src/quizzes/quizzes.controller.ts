import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { PublicUser } from '../auth/auth.types';
import { QuizzesService } from './quizzes.service';
import {
  createQuizSchema,
  replaceQuestionsSchema,
  updateQuizSchema,
  type CreateQuizInput,
  type ReplaceQuestionsInput,
  type UpdateQuizInput,
} from './quizzes.schemas';

@UseGuards(JwtAuthGuard)
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  list(@CurrentUser() user: PublicUser) {
    return this.quizzes.findAllByOwner(user.id);
  }

  @Get(':id')
  detail(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.quizzes.findOneByOwner(user.id, id);
  }

  @Post()
  create(
    @CurrentUser() user: PublicUser,
    @Body({ schema: createQuizSchema }) body: CreateQuizInput,
  ) {
    return this.quizzes.create(user.id, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: updateQuizSchema }) body: UpdateQuizInput,
  ) {
    return this.quizzes.update(user.id, id, body);
  }

  @Put(':id/questions')
  replaceQuestions(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: replaceQuestionsSchema }) body: ReplaceQuestionsInput,
  ) {
    return this.quizzes.replaceQuestions(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: PublicUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.quizzes.remove(user.id, id);
  }
}
