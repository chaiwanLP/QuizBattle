"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Spinner } from "@/components/spinner";
import { ApiError, quizzesApi } from "@/lib/api";
import type { QuizDetail } from "@/lib/types";
import {
  cardClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

interface DraftOption {
  key: string;
  text: string;
  isCorrect: boolean;
}

interface DraftQuestion {
  key: string;
  text: string;
  timeLimitSec: number;
  options: DraftOption[];
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;
const MIN_TIME = 5;
const MAX_TIME = 300;

function newKey(): string {
  return crypto.randomUUID();
}

function createQuestion(index: number): DraftQuestion {
  return {
    key: newKey(),
    text: `คำถามข้อที่ ${index + 1}`,
    timeLimitSec: 20,
    options: [
      { key: newKey(), text: "ตัวเลือก A", isCorrect: true },
      { key: newKey(), text: "ตัวเลือก B", isCorrect: false },
      { key: newKey(), text: "ตัวเลือก C", isCorrect: false },
      { key: newKey(), text: "ตัวเลือก D", isCorrect: false },
    ],
  };
}

function toDraft(quiz: QuizDetail): DraftQuestion[] {
  return quiz.questions.map((question) => ({
    key: question.id,
    text: question.text,
    timeLimitSec: question.timeLimitSec,
    options: question.options.map((option) => ({
      key: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
    })),
  }));
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export default function QuizEditor() {
  const params = useParams<{ id: string }>();
  const quizId = params.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    quizzesApi
      .get(quizId)
      .then((quiz) => {
        if (cancelled) return;
        setTitle(quiz.title);
        setDescription(quiz.description ?? "");
        setQuestions(toDraft(quiz));
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/quizzes/${quizId}`)}`);
          return;
        }
        if (error instanceof ApiError && error.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setLoadError(describeError(error, "โหลดควิซไม่สำเร็จ"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [quizId, router]);

  function updateQuestion(key: string, patch: Partial<DraftQuestion>) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key ? { ...question, ...patch } : question,
      ),
    );
  }

  function updateOption(
    questionKey: string,
    optionKey: string,
    patch: Partial<DraftOption>,
  ) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === questionKey
          ? {
              ...question,
              options: question.options.map((option) =>
                option.key === optionKey ? { ...option, ...patch } : option,
              ),
            }
          : question,
      ),
    );
  }

  function markCorrect(questionKey: string, optionKey: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === questionKey
          ? {
              ...question,
              options: question.options.map((option) => ({
                ...option,
                isCorrect: option.key === optionKey,
              })),
            }
          : question,
      ),
    );
  }

  function addOption(questionKey: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === questionKey && question.options.length < MAX_OPTIONS
          ? {
              ...question,
              options: [
                ...question.options,
                { key: newKey(), text: "", isCorrect: false },
              ],
            }
          : question,
      ),
    );
  }

  function removeOption(questionKey: string, optionKey: string) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.key !== questionKey) return question;
        if (question.options.length <= MIN_OPTIONS) return question;

        const removed = question.options.find(
          (option) => option.key === optionKey,
        );
        const options = question.options.filter(
          (option) => option.key !== optionKey,
        );

        // Never leave a question without a correct answer.
        if (removed?.isCorrect && options.length > 0) {
          options[0] = { ...options[0], isCorrect: true };
        }

        return { ...question, options };
      }),
    );
  }

  function addQuestion() {
    setQuestions((current) => [...current, createQuestion(current.length)]);
  }

  function removeQuestion(questionKey: string) {
    setQuestions((current) => {
      if (current.length <= 1) return current;
      return current.filter((question) => question.key !== questionKey);
    });
  }

  function validate(): string | null {
    if (!title.trim()) return "กรุณากรอกชื่อควิซ";
    if (questions.length === 0) return "ต้องมีอย่างน้อย 1 คำถาม";

    for (const [index, question] of questions.entries()) {
      const label = `ข้อ ${index + 1}`;
      if (!question.text.trim()) return `${label}: กรุณากรอกคำถาม`;
      if (question.options.length < MIN_OPTIONS) {
        return `${label}: ต้องมีอย่างน้อย ${MIN_OPTIONS} ตัวเลือก`;
      }
      if (question.options.some((option) => !option.text.trim())) {
        return `${label}: ตัวเลือกทุกช่องต้องไม่ว่าง`;
      }
      if (question.options.filter((option) => option.isCorrect).length !== 1) {
        return `${label}: ต้องมีคำตอบที่ถูกต้องเพียง 1 ข้อ`;
      }
    }

    return null;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const problem = validate();
    if (problem) {
      setNotice({ kind: "error", message: problem });
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      await quizzesApi.update(quizId, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
      });
      await quizzesApi.replaceQuestions(
        quizId,
        questions.map((question) => ({
          text: question.text.trim(),
          timeLimitSec: question.timeLimitSec,
          options: question.options.map((option) => ({
            text: option.text.trim(),
            isCorrect: option.isCorrect,
          })),
        })),
      );
      setNotice({ kind: "success", message: "บันทึกควิซเรียบร้อยแล้ว" });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/quizzes/${quizId}`)}`);
        return;
      }
      setNotice({
        kind: "error",
        message: describeError(error, "บันทึกไม่สำเร็จ"),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`ลบควิซ "${title}" และคำถามทั้งหมดหรือไม่?`)) return;

    setDeleting(true);
    try {
      await quizzesApi.remove(quizId);
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace("/login");
        return;
      }
      setNotice({
        kind: "error",
        message: describeError(error, "ลบควิซไม่สำเร็จ"),
      });
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-400">
        <Spinner className="size-5 text-violet-400" />
        กำลังโหลดควิซ…
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-slate-100">ไม่พบควิซนี้</p>
        <p className="text-sm text-slate-400">
          ควิซอาจถูกลบไปแล้ว หรือคุณไม่มีสิทธิ์เข้าถึง
        </p>
        <Link href="/dashboard" className={secondaryButtonClass}>
          กลับไปคลังควิซ
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-lg font-semibold text-slate-100">{loadError}</p>
        <Link href="/dashboard" className={secondaryButtonClass}>
          กลับไปคลังควิซ
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="text-sm text-slate-400 transition hover:text-slate-100"
        >
          ← กลับไปคลังควิซ
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={dangerButtonClass}
            onClick={handleDelete}
            disabled={deleting || saving}
          >
            {deleting ? <Spinner className="size-4" /> : null}
            ลบควิซ
          </button>
          <button
            type="submit"
            className={primaryButtonClass}
            disabled={saving || deleting}
          >
            {saving ? <Spinner className="size-4" /> : null}
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.kind === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/20 bg-rose-500/10 text-rose-200"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      <section className={`${cardClass} flex flex-col gap-4 p-5 sm:p-6`}>
        <div className="flex flex-col gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
            htmlFor="editor-title"
          >
            ชื่อควิซ
          </label>
          <input
            id="editor-title"
            type="text"
            className="w-full rounded-xl border border-transparent bg-transparent px-0 text-2xl font-bold tracking-tight text-slate-50 outline-none placeholder:text-slate-600 focus:border-transparent"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="ตั้งชื่อควิซของคุณ"
            maxLength={200}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
            htmlFor="editor-description"
          >
            คำอธิบาย
          </label>
          <textarea
            id="editor-description"
            className={`${inputClass} min-h-20 resize-y`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="คำอธิบายสั้น ๆ (ไม่บังคับ)"
            maxLength={1000}
          />
        </div>

        <p className="text-xs text-slate-500">
          ทั้งหมด {questions.length} คำถาม · แต่ละข้อมีได้ {MIN_OPTIONS}–
          {MAX_OPTIONS} ตัวเลือก และต้องมีคำตอบที่ถูกต้อง 1 ข้อ
        </p>
      </section>

      <div className="flex flex-col gap-4">
        {questions.map((question, questionIndex) => (
          <section
            key={question.key}
            className={`${cardClass} flex flex-col gap-4 p-5 sm:p-6`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-violet-500/15 text-sm font-bold text-violet-300">
                  {questionIndex + 1}
                </span>
                <span className="text-sm font-semibold text-slate-200">
                  คำถามข้อที่ {questionIndex + 1}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  เวลา
                  <input
                    type="number"
                    min={MIN_TIME}
                    max={MAX_TIME}
                    aria-label={`เวลาตอบข้อ ${questionIndex + 1} (วินาที)`}
                    className="w-20 rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-violet-400/60"
                    value={question.timeLimitSec}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      updateQuestion(question.key, {
                        timeLimitSec: Number.isNaN(value)
                          ? MIN_TIME
                          : Math.min(MAX_TIME, Math.max(MIN_TIME, value)),
                      });
                    }}
                  />
                  วินาที
                </label>
                <button
                  type="button"
                  className={`${dangerButtonClass} px-2.5 py-1.5 text-xs`}
                  onClick={() => removeQuestion(question.key)}
                  disabled={questions.length <= 1}
                  title={
                    questions.length <= 1
                      ? "ต้องมีอย่างน้อย 1 คำถาม"
                      : "ลบคำถามข้อนี้"
                  }
                >
                  ลบข้อนี้
                </button>
              </div>
            </div>

            <input
              type="text"
              className={inputClass}
              aria-label={`คำถามข้อที่ ${questionIndex + 1}`}
              value={question.text}
              onChange={(event) =>
                updateQuestion(question.key, { text: event.target.value })
              }
              placeholder="พิมพ์คำถาม"
              maxLength={500}
            />

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                ตัวเลือก · เลือกวงกลมหน้าคำตอบที่ถูก
              </p>
              {question.options.map((option, optionIndex) => (
                <div key={option.key} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name={`correct-${question.key}`}
                    checked={option.isCorrect}
                    onChange={() => markCorrect(question.key, option.key)}
                    className="size-4 shrink-0 accent-violet-500"
                    aria-label={`ตั้งตัวเลือก ${optionIndex + 1} เป็นคำตอบที่ถูก`}
                  />
                  <input
                    type="text"
                    className={inputClass}
                    aria-label={`ตัวเลือก ${String.fromCharCode(65 + optionIndex)} ของข้อ ${questionIndex + 1}`}
                    value={option.text}
                    onChange={(event) =>
                      updateOption(question.key, option.key, {
                        text: event.target.value,
                      })
                    }
                    placeholder={`ตัวเลือก ${String.fromCharCode(65 + optionIndex)}`}
                    maxLength={500}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-30"
                    onClick={() => removeOption(question.key, option.key)}
                    disabled={question.options.length <= MIN_OPTIONS}
                    title="ลบตัวเลือกนี้"
                    aria-label="ลบตัวเลือกนี้"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="self-start rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-violet-400/40 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => addOption(question.key)}
                disabled={question.options.length >= MAX_OPTIONS}
              >
                ＋ เพิ่มตัวเลือก
              </button>
            </div>
          </section>
        ))}
      </div>

      <button
        type="button"
        className={`${secondaryButtonClass} w-full border-dashed py-3`}
        onClick={addQuestion}
        disabled={questions.length >= 100}
      >
        ＋ เพิ่มคำถาม
      </button>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-[#070a13]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="hidden text-xs text-slate-500 sm:inline">
            การบันทึกจะแทนที่คำถามทั้งชุดด้วยข้อมูลล่าสุดในหน้านี้
          </span>
          <div className="ml-auto flex gap-3">
            <Link href="/dashboard" className={secondaryButtonClass}>
              ยกเลิก
            </Link>
            <button
              type="submit"
              className={primaryButtonClass}
              disabled={saving || deleting}
            >
              {saving ? <Spinner className="size-4" /> : null}
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
