import Link from "next/link";

const features = [
  {
    icon: "✏️",
    title: "สร้างควิซได้เอง",
    body: "เพิ่มคำถาม ตัวเลือก และเวลาตอบต่อข้อได้อย่างอิสระ",
  },
  {
    icon: "🔗",
    title: "แชร์โค้ดห้อง",
    body: "ให้ผู้เล่นเข้าห้องด้วย PIN เดียวกันจากมือถือ (กำลังมา)",
  },
  {
    icon: "⚡",
    title: "คะแนนเรียลไทม์",
    body: "อันดับและคะแนนอัปเดตทันทีหลังแต่ละข้อ (กำลังมา)",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
            Q
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-50">
            QuizBattle
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-400"
          >
            เริ่มใช้งาน
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-24">
        <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
          Real-time quiz battle
        </span>

        <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight text-slate-50 sm:text-6xl">
          เปลี่ยนบทเรียนให้เป็น{" "}
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-sky-300 bg-clip-text text-transparent">
            เกมตอบคำถาม
          </span>{" "}
          ที่ทุกคนอยากเล่น
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
          สร้างชุดคำถามของคุณเอง แชร์ให้ผู้เล่นเข้ามาตอบพร้อมกัน
          แล้วดูคะแนนขึ้นกระดานแบบเรียลไทม์
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-violet-500 px-8 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition hover:bg-violet-400"
          >
            สร้างควิซแรกฟรี
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-8 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
          >
            เข้าสู่ระบบ
          </Link>
        </div>

        <section className="mt-16 grid w-full gap-4 text-left sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur"
            >
              <span className="text-2xl">{feature.icon}</span>
              <h2 className="mt-3 text-base font-semibold text-slate-100">
                {feature.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                {feature.body}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 py-6 text-center text-xs text-slate-600 sm:px-6">
        QuizBattle · Next.js + NestJS + PostgreSQL + Redis
      </footer>
    </div>
  );
}
