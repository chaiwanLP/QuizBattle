import { z } from 'zod';

const optionSchema = z.object({
  text: z.string().trim().min(1).max(500),
  isCorrect: z.boolean(),
});

const questionSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    timeLimitSec: z.number().int().min(5).max(300).default(20),
    options: z.array(optionSchema).min(2).max(6),
  })
  .refine(
    (question) =>
      question.options.filter((option) => option.isCorrect).length === 1,
    {
      message: 'A question must have exactly one correct option',
      path: ['options'],
    },
  );

export const createQuizSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  questions: z.array(questionSchema).min(1).max(100),
});
export type CreateQuizInput = z.infer<typeof createQuizSchema>;

export const updateQuizSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    // `null` clears the description.
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;

export const replaceQuestionsSchema = z.object({
  questions: z.array(questionSchema).min(1).max(100),
});
export type ReplaceQuestionsInput = z.infer<typeof replaceQuestionsSchema>;
