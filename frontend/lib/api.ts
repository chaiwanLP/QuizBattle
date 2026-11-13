import type {
  QuestionInput,
  QuizDetail,
  QuizSummary,
  User,
} from "./types";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/** Error thrown for every non-2xx API response. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface NestErrorBody {
  message?: string | string[];
}

function readErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as NestErrorBody).message;
    if (Array.isArray(message) && message.length > 0) return message.join(", ");
    if (typeof message === "string" && message.length > 0) return message;
  }
  return `Request failed with status ${status}`;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      // The session lives in an httpOnly cookie, so every call must opt in.
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบว่า backend ทำงานอยู่");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, readErrorMessage(body, response.status));
  }

  return body as T;
}

export const authApi = {
  me: () => apiFetch<User>("/auth/me"),
  login: (input: { email: string; password: string }) =>
    apiFetch<User>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  register: (input: {
    email: string;
    password: string;
    displayName: string;
  }) =>
    apiFetch<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
};

export const quizzesApi = {
  list: () => apiFetch<QuizSummary[]>("/quizzes"),
  get: (id: string) => apiFetch<QuizDetail>(`/quizzes/${id}`),
  create: (input: {
    title: string;
    description?: string;
    questions: QuestionInput[];
  }) =>
    apiFetch<QuizDetail>("/quizzes", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  update: (
    id: string,
    input: { title?: string; description?: string | null },
  ) =>
    apiFetch<QuizDetail>(`/quizzes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  replaceQuestions: (id: string, questions: QuestionInput[]) =>
    apiFetch<QuizDetail>(`/quizzes/${id}/questions`, {
      method: "PUT",
      body: JSON.stringify({ questions }),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/quizzes/${id}`, { method: "DELETE" }),
};
