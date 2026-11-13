export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { questions: number };
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  position: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  timeLimitSec: number;
  position: number;
  options: QuizOption[];
}

export interface QuizDetail extends QuizSummary {
  questions: QuizQuestion[];
}

/** Question shape accepted by POST /quizzes and PUT /quizzes/:id/questions. */
export interface QuestionInput {
  text: string;
  timeLimitSec: number;
  options: { text: string; isCorrect: boolean }[];
}
