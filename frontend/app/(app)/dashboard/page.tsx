"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Spinner } from "@/components/spinner";
import { ApiError, quizzesApi } from "@/lib/api";
import type { QuizSummary } from "@/lib/types";
import {
  cardClass,
  dangerButtonClass,
  formatDate,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

export default function DashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    quizzesApi
      .list()
      .then((list) => {
        if (cancelled) return;
        setQuizzes(list);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace("/login");
          return;
        }
        setLoadError(
          error instanceof ApiError ? error.message : "โหลดรายการควิซไม่สำเร็จ",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [router, reloadToken]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setCreateError("กรุณากรอกชื่อควิซ");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const quiz = await quizzesApi.create({
        title: trimmed,
        description: description.trim() || undefined,
        // The API requires a complete question set, so a new quiz starts with
        // one editable placeholder question.
        questions: [
          {
            text: "คำถามข้อที่ 1",
            timeLimitSec: 20,
            options: [
              { text: "ตัวเลือก A", isCorrect: true },
              { text: "ตัวเลือก B", isCorrect: false },
              { text: "ตัวเลือก C", isCorrect: false },
              { text: "ตัวเลือก D", isCorrect: false },
            ],
          },
        ],
      });
      router.push(`/quizzes/${quiz.id}`);
    } catch (error) {
      setCreateError(
        error instanceof ApiError ? error.message : "สร้างควิซไม่สำเร็จ",
      );
      setCreating(false);
    }
  }

  async function handleDelete(quiz: QuizSummary) {
    const confirmed = window.confirm(
      `ลบควิซ "${quiz.title}" และคำถามทั้งหมดหรือไม่?`,
    );
    if (!confirmed) return;

    setDeletingId(quiz.id);
    setLoadError(null);
    try {
      await quizzesApi.remove(quiz.id);
      setQuizzes((current) =>
        current ? current.filter((item) => item.id !== quiz.id) : current,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
        return;
      }
      setLoadError(
        error instanceof ApiError ? error.message : "ลบควิซไม่สำเร็จ",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            Host area
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
            คลังควิซของฉัน
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            สร้างชุดคำถามไว้เล่นกับผู้เล่นแบบเรียลไทม์ (เร็ว ๆ นี้)
          </p>
        </div>
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() => {
            setCreateOpen((open) => !open);
            setCreateError(null);
          }}
        >
          {createOpen ? "ปิดแบบฟอร์ม" : "＋ สร้างควิซใหม่"}
        </button>
      </div>

      {createOpen ? (
        <form
          onSubmit={handleCreate}
          className={`${cardClass} flex flex-col gap-4 p-5 sm:p-6`}
        >
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="quiz-title">
              ชื่อควิซ
            </label>
            <input
              id="quiz-title"
              className={inputClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="เช่น ความรู้ทั่วไปรอบโลก"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              className="text-sm font-medium text-slate-300"
              htmlFor="quiz-description"
            >
              คำอธิบาย <span className="text-slate-500">(ไม่บังคับ)</span>
            </label>
            <textarea
              id="quiz-description"
              className={`${inputClass} min-h-20 resize-y`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="คำอธิบายสั้น ๆ สำหรับผู้เล่น"
              maxLength={1000}
            />
          </div>

          {createError ? (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {createError}
            </p>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={creating}
            >
              {creating ? <Spinner className="size-4" /> : null}
              สร้างและแก้ไขคำถาม
            </button>
          </div>
        </form>
      ) : null}

      {loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <span>{loadError}</span>
          <button
            type="button"
            className="font-semibold underline-offset-2 hover:underline"
            onClick={() => {
              setLoadError(null);
              setQuizzes(null);
              setReloadToken((token) => token + 1);
            }}
          >
            ลองใหม่
          </button>
        </div>
      ) : null}

      {quizzes === null ? (
        <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-400">
          <Spinner className="size-5 text-violet-400" />
          กำลังโหลดควิซ…
        </div>
      ) : quizzes.length === 0 ? (
        <div
          className={`${cardClass} flex flex-col items-center gap-3 px-6 py-16 text-center`}
        >
          <span className="text-4xl">🗂️</span>
          <p className="text-lg font-semibold text-slate-100">
            ยังไม่มีควิซเลย
          </p>
          <p className="max-w-sm text-sm text-slate-400">
            เริ่มจากสร้างควิซแรกของคุณ แล้วค่อยเพิ่มคำถามและตัวเลือกทีหลังได้
          </p>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => setCreateOpen(true)}
          >
            สร้างควิซใหม่
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((quiz) => (
            <li
              key={quiz.id}
              className={`${cardClass} group relative flex flex-col gap-4 p-5 transition hover:border-violet-400/30 hover:bg-white/[0.05]`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/quizzes/${quiz.id}`}
                    className="line-clamp-2 text-lg font-semibold text-slate-50 transition group-hover:text-violet-200"
                  >
                    {quiz.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-400">
                    {quiz.description || "ไม่มีคำอธิบาย"}
                  </p>
                </div>
                <button
                  type="button"
                  className={`${dangerButtonClass} shrink-0 px-2.5 py-1.5 text-xs`}
                  onClick={() => handleDelete(quiz)}
                  disabled={deletingId === quiz.id}
                >
                  {deletingId === quiz.id ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    "ลบ"
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-500">
                <span className="rounded-full bg-violet-500/10 px-2.5 py-1 font-medium text-violet-300">
                  {quiz._count.questions} คำถาม
                </span>
                <span>แก้ไข {formatDate(quiz.updatedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
