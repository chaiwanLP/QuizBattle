import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
            Q
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-50">
            QuizBattle
          </span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
