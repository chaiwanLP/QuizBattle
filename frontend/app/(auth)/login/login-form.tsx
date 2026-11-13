"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Spinner } from "@/components/spinner";
import { ApiError, authApi } from "@/lib/api";
import { inputClass, primaryButtonClass } from "@/lib/ui";

function safeNextPath(value: string | null): string {
  // Only allow internal paths, so the query param can't redirect off-site.
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await authApi.login({
        email: email.trim(),
        password,
      });
      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-50">
        เข้าสู่ระบบโฮสต์
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        จัดการควิซและเตรียมเกมของคุณ
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-300" htmlFor="email">
            อีเมล
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-slate-300"
            htmlFor="password"
          >
            รหัสผ่าน
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className={`${primaryButtonClass} mt-2 h-11`}
          disabled={submitting}
        >
          {submitting ? <Spinner className="size-4" /> : null}
          เข้าสู่ระบบ
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        ยังไม่มีบัญชี?{" "}
        <Link
          href="/register"
          className="font-semibold text-violet-300 transition hover:text-violet-200"
        >
          สมัครสมาชิก
        </Link>
      </p>
    </>
  );
}
