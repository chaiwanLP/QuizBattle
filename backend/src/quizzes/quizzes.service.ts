import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateQuizInput,
  ReplaceQuestionsInput,
  UpdateQuizInput,
} from './quizzes.schemas';

const quizSummarySelect = {
  id: true,
  title: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { questions: true } },
} satisfies Prisma.QuizSelect;

const quizDetailSelect = {
  ...quizSummarySelect,
  questions: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      text: true,
      timeLimitSec: true,
      position: true,
      options: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          text: true,
          isCorrect: true,
          position: true,
        },
      },
    },
  },
} satisfies Prisma.QuizSelect;

type QuestionInput = CreateQuizInput['questions'][number];

function toQuestionCreate(
  questions: QuestionInput[],
): Prisma.QuestionCreateWithoutQuizInput[] {
  return questions.map((question, questionIndex) => ({
    text: question.text,
    timeLimitSec: question.timeLimitSec,
    position: questionIndex,
    options: {
      create: question.options.map((option, optionIndex) => ({
        text: option.text,
        isCorrect: option.isCorrect,
        position: optionIndex,
      })),
    },
  }));
}

@Injectable()
export class QuizzesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByOwner(ownerId: string) {
    return this.prisma.quiz.findMany({
      where: { ownerId },
      orderBy: { updatedAt: 'desc' },
      select: quizSummarySelect,
    });
  }

  async findOneByOwner(ownerId: string, quizId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { id: quizId, ownerId },
      select: quizDetailSelect,
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    return quiz;
  }

  create(ownerId: string, input: CreateQuizInput) {
    return this.prisma.quiz.create({
      data: {
        ownerId,
        title: input.title,
        description: input.description,
        questions: { create: toQuestionCreate(input.questions) },
      },
      select: quizDetailSelect,
    });
  }

  async update(ownerId: string, quizId: string, input: UpdateQuizInput) {
    const { count } = await this.prisma.quiz.updateMany({
      where: { id: quizId, ownerId },
      data: { title: input.title, description: input.description },
    });

    if (count === 0) {
      throw new NotFoundException('Quiz not found');
    }

    return this.findOneByOwner(ownerId, quizId);
  }

  async replaceQuestions(
    ownerId: string,
    quizId: string,
    input: ReplaceQuestionsInput,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.findFirst({
        where: { id: quizId, ownerId },
        select: { id: true },
      });

      if (!quiz) {
        throw new NotFoundException('Quiz not found');
      }

      // Questions and options cascade, so replacing the set is one delete
      // followed by one nested create inside the same transaction.
      await tx.question.deleteMany({ where: { quizId } });
      await tx.quiz.update({
        where: { id: quizId },
        data: { questions: { create: toQuestionCreate(input.questions) } },
      });
    });

    return this.findOneByOwner(ownerId, quizId);
  }

  async remove(ownerId: string, quizId: string): Promise<void> {
    const { count } = await this.prisma.quiz.deleteMany({
      where: { id: quizId, ownerId },
    });

    if (count === 0) {
      throw new NotFoundException('Quiz not found');
    }
  }
}
