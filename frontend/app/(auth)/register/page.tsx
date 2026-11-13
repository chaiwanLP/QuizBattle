"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Spinner } from "@/components/spinner";
import { ApiError, authApi } from "@/lib/api";
import { inputClass, primaryButtonClass } from "@/lib/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (displayName.trim().length === 0) {
      setError("กรุณากรอกชื่อที่ใช้แสดง");
      return;
    }
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (password !== confirmPassword) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-50">
        สมัครเป็นโฮสต์
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        สร้างบัญชีเพื่อเริ่มสร้างควิซของคุณ
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-slate-300"
            htmlFor="displayName"
          >
            ชื่อที่ใช้แสดง
          </label>
          <input
            id="displayName"
            required
            maxLength={50}
            className={inputClass}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="เช่น ครูสมชาย"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            className={inputClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="อย่างน้อย 8 ตัวอักษร"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="text-sm font-medium text-slate-300"
            htmlFor="confirmPassword"
          >
            ยืนยันรหัสผ่าน
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className={inputClass}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="พิมพ์รหัสผ่านอีกครั้ง"
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
          สมัครสมาชิก
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        มีบัญชีอยู่แล้ว?{" "}
        <Link
          href="/login"
          className="font-semibold text-violet-300 transition hover:text-violet-200"
        >
          เข้าสู่ระบบ
        </Link>
      </p>
    </>
  );
}
