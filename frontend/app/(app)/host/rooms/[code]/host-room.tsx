"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/spinner";
import { createRoomSocket, type GameSocket } from "@/lib/socket";
import type { RoomState } from "@/lib/types";
import {
  cardClass,
  dangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

type Status = "connecting" | "ready" | "error" | "closed";
type Copied = "code" | "link" | null;

export default function HostRoom() {
  const params = useParams<{ code: string }>();
  const code = params.code;

  const [status, setStatus] = useState<Status>("connecting");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState<Copied>(null);
  const [closing, setClosing] = useState(false);

  const socketRef = useRef<GameSocket | null>(null);

  useEffect(() => {
    const socket = createRoomSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("host:join", { code }, (result) => {
        if (!result.ok) {
          setStatus("error");
          setError(result.error);
          return;
        }

        setRoom(result.room);
        setStatus("ready");
        setError(null);
      });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("room:state", (next) => {
      setRoom(next);
      setStatus("ready");
      setError(null);
    });

    socket.on("room:closed", () => {
      setStatus("closed");
      setRoom(null);
      socket.disconnect();
    });

    socket.on("connect_error", () => {
      setConnected(false);
      // The lobby survives reconnects, so only the first failure is fatal.
      setStatus((current) => (current === "ready" ? current : "error"));
      setError((current) => current ?? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  async function copy(kind: Exclude<Copied, null>) {
    const text =
      kind === "code"
        ? code
        : `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตัวเอง");
    }
  }

  function handleClose() {
    const socket = socketRef.current;
    if (!socket?.connected) {
      setError("การเชื่อมต่อขาดหาย กรุณารอสักครู่แล้วลองใหม่");
      return;
    }

    if (!window.confirm("ปิดห้องนี้และให้ผู้เล่นทุกคนออกหรือไม่?")) return;

    setClosing(true);
    setError(null);
    socket.emit("host:close", { code }, (result) => {
      if (result.ok) {
        setStatus("closed");
        setRoom(null);
        socket.disconnect();
        return;
      }

      setClosing(false);
      setError(result.error);
    });
  }

  if (status === "error") {
    return (
      <div className={`${cardClass} mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-14 text-center`}>
        <span className="text-4xl">🚫</span>
        <h1 className="text-xl font-bold text-slate-50">เปิดห้องนี้ไม่ได้</h1>
        <p className="text-sm text-slate-400">
          {error ?? "ห้องนี้อาจถูกปิดหรือหมดอายุแล้ว"}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() => window.location.reload()}
          >
            ลองใหม่
          </button>
          <Link href="/dashboard" className={primaryButtonClass}>
            กลับไปคลังควิซ
          </Link>
        </div>
      </div>
    );
  }

  if (status === "closed") {
    return (
      <div className={`${cardClass} mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-14 text-center`}>
        <span className="text-4xl">✅</span>
        <h1 className="text-xl font-bold text-slate-50">ปิดห้องแล้ว</h1>
        <p className="text-sm text-slate-400">
          ผู้เล่นทุกคนออกจากห้องนี้แล้ว เปิดห้องใหม่ได้ทุกเมื่อจากคลังควิซ
        </p>
        <Link href="/dashboard" className={`${primaryButtonClass} mt-2`}>
          กลับไปคลังควิซ
        </Link>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-400">
        <Spinner className="size-5 text-violet-400" />
        กำลังเปิดห้อง…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard" className="transition hover:text-slate-100">
            คลังควิซ
          </Link>
          <span aria-hidden>›</span>
          <span className="text-slate-200">{room.quizTitle}</span>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
            connected
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-amber-500/10 text-amber-300"
          }`}
        >
          <span
            className={`size-2 rounded-full ${
              connected ? "animate-pulse bg-emerald-400" : "bg-amber-400"
            }`}
          />
          {connected ? "เชื่อมต่อแล้ว" : "กำลังเชื่อมต่อใหม่…"}
        </span>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className={`${cardClass} flex flex-col p-6 sm:p-8`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            Live lobby
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">
            {room.quizTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {room.questionCount} คำถาม · โฮสต์ {room.hostName}
          </p>

          <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-5 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-300">
              โค้ดห้อง
            </p>
            <p className="mt-1 font-mono text-5xl font-black tracking-[0.25em] text-slate-50">
              {room.code}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              ให้ผู้เล่นเปิดหน้า /join แล้วกรอกโค้ดนี้
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                className={`${primaryButtonClass} px-3 py-1.5 text-xs`}
                onClick={() => copy("code")}
              >
                {copied === "code" ? "คัดลอกแล้ว ✓" : "คัดลอกโค้ด"}
              </button>
              <button
                type="button"
                className={`${secondaryButtonClass} px-3 py-1.5 text-xs`}
                onClick={() => copy("link")}
              >
                {copied === "link" ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์เชิญ"}
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              className={dangerButtonClass}
              onClick={handleClose}
              disabled={closing}
            >
              {closing ? <Spinner className="size-4" /> : null}
              ปิดห้อง
            </button>
            <p className="text-center text-xs text-slate-500">
              เกมจริงและระบบคะแนนจะมาใน Phase 3
            </p>
          </div>
        </section>

        <section className={`${cardClass} flex flex-col p-5 sm:p-6`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              ผู้เล่นในห้อง
            </h2>
            <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
              {room.players.length} คน
            </span>
          </div>

          {room.players.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
              <span className="text-3xl">👋</span>
              <p className="text-sm text-slate-400">
                ยังไม่มีผู้เล่น — แชร์โค้ดห้องให้เพื่อนได้เลย
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid content-start gap-2 sm:grid-cols-2">
              {room.players.map((player, index) => (
                <li
                  key={player.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-xs font-bold text-violet-300">
                    {index + 1}
                  </span>
                  <span className="truncate text-sm text-slate-200">
                    {player.nickname}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
