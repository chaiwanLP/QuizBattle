"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SessionContext } from "@/components/session";
import { Spinner } from "@/components/spinner";
import { ApiError, authApi } from "@/lib/api";
import type { User } from "@/lib/types";
import { secondaryButtonClass } from "@/lib/ui";

type Status = "loading" | "ready" | "error";

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    authApi
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [router, attempt]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authApi.logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-slate-400">
        <Spinner className="size-8 text-violet-400" />
        <p className="text-sm">กำลังตรวจสอบเซสชัน…</p>
      </div>
    );
  }

  if (status === "error" || !user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <p className="text-lg font-semibold text-slate-100">
          เชื่อมต่อเซิร์ฟเวอร์ไม่ได้
        </p>
        <p className="max-w-sm text-sm text-slate-400">
          ตรวจสอบว่า backend รันอยู่ที่ port 3000 แล้วลองอีกครั้ง
        </p>
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() => {
            setStatus("loading");
            setAttempt((value) => value + 1);
          }}
        >
          ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={user}>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070a13]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
                Q
              </span>
              <span className="text-base font-bold tracking-tight text-slate-50">
                QuizBattle
              </span>
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-slate-400 transition hover:text-slate-100"
            >
              คลังควิซ
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:inline">
              {user.displayName}
            </span>
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? <Spinner className="size-4" /> : null}
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </SessionContext.Provider>
  );
}
