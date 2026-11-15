"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Spinner } from "@/components/spinner";
import {
  createRoomSocket,
  type GameSocket,
  type RoomAck,
} from "@/lib/socket";
import type { RoomState } from "@/lib/types";
import {
  cardClass,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/lib/ui";

type Phase = "form" | "connecting" | "lobby";

interface Identity {
  code: string;
  nickname: string;
  playerId: string;
}

const STORAGE_KEY = "qb_player";

/** Lets a reload rejoin the same seat instead of creating a duplicate player. */
function readStoredIdentity(): Identity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (
      typeof parsed.code === "string" &&
      /^\d{6}$/.test(parsed.code) &&
      typeof parsed.playerId === "string" &&
      typeof parsed.nickname === "string"
    ) {
      return {
        code: parsed.code,
        nickname: parsed.nickname,
        playerId: parsed.playerId,
      };
    }
  } catch {
    // Corrupt or blocked storage: fall back to the join form.
  }

  return null;
}

function saveIdentity(identity: Identity): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Private mode or quota: rejoining after a reload just won't work.
  }
}

function clearIdentity(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

export default function JoinScreen() {
  const searchParams = useSearchParams();
  const initialCode = (searchParams.get("code") ?? "")
    .replace(/\D/g, "")
    .slice(0, 6);

  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [connected, setConnected] = useState(true);

  const socketRef = useRef<GameSocket | null>(null);
  const identityRef = useRef<Identity | null>(null);

  const applyJoinResult = useCallback(
    (result: RoomAck, fallback: { code: string; nickname: string }) => {
      if (!result.ok) {
        identityRef.current = null;
        clearIdentity();
        setPhase("form");
        setError(result.error);
        return;
      }

      const me = result.room.players.find(
        (player) => player.id === result.playerId,
      );
      const identity: Identity = {
        code: fallback.code,
        nickname: me?.nickname ?? fallback.nickname,
        playerId: result.playerId,
      };

      identityRef.current = identity;
      saveIdentity(identity);
      setNickname(identity.nickname);
      setRoom(result.room);
      setError(null);
      setPhase("lobby");
    },
    [],
  );

  /**
   * One socket per attempt. Passing a `playerId` rejoins an existing seat
   * (after a reload); otherwise the server creates a new player.
   */
  const connect = useCallback(
    (identity: Identity | { code: string; nickname: string }) => {
      socketRef.current?.disconnect();
      const socket = createRoomSocket();
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);

        if ("playerId" in identity) {
          socket.emit(
            "room:rejoin",
            { code: identity.code, playerId: identity.playerId },
            (result) => {
              // The old seat is gone (reload, or the room expired): take a
              // fresh one with the same nickname instead of failing.
              if (!result.ok && result.code === "player-not-found") {
                socket.emit(
                  "room:join",
                  { code: identity.code, nickname: identity.nickname },
                  (retry) => applyJoinResult(retry, identity),
                );
                return;
              }

              applyJoinResult(result, identity);
            },
          );
          return;
        }

        socket.emit(
          "room:join",
          { code: identity.code, nickname: identity.nickname },
          (result) => applyJoinResult(result, identity),
        );
      });

      socket.on("disconnect", () => setConnected(false));

      socket.on("room:state", (next) => setRoom(next));

      socket.on("room:closed", () => {
        identityRef.current = null;
        clearIdentity();
        setRoom(null);
        setPhase("form");
        setError("ห้องนี้ถูกปิดแล้ว");
        socket.disconnect();
        socketRef.current = null;
      });

      socket.on("connect_error", () => {
        setConnected(false);
        // A saved seat keeps retrying in the background; the form stays busy.
        if (identityRef.current) {
          setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังลองใหม่…");
          return;
        }
        setPhase("form");
        setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
      });
    },
    [applyJoinResult],
  );

  useEffect(() => {
    const stored = readStoredIdentity();

    // An explicit invite link for another room wins over a saved seat.
    if (!stored || (initialCode && initialCode !== stored.code)) {
      return () => {
        socketRef.current?.disconnect();
        socketRef.current = null;
      };
    }

    // localStorage is client-only, so the saved seat is restored after mount.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      identityRef.current = stored;
      setCode(stored.code);
      setNickname(stored.nickname);
      setPhase("connecting");
      connect(stored);
    });

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect, initialCode]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanCode = code.replace(/\D/g, "");
    const cleanNickname = nickname.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setError("กรุณากรอกโค้ดห้องให้ครบ 6 หลัก");
      return;
    }
    if (!cleanNickname) {
      setError("กรุณากรอกชื่อเล่น");
      return;
    }

    identityRef.current = null;
    setPhase("connecting");
    setError(null);
    connect({ code: cleanCode, nickname: cleanNickname });
  }

  function leaveRoom() {
    const socket = socketRef.current;
    identityRef.current = null;
    clearIdentity();

    if (socket) {
      // The disconnect handler is the safety net if the ack never arrives.
      const fallback = window.setTimeout(() => socket.disconnect(), 1500);
      socket.emit("room:leave", () => {
        window.clearTimeout(fallback);
        socket.disconnect();
      });
      socketRef.current = null;
    }

    setRoom(null);
    setError(null);
    setPhase("form");
  }

  const joining = phase === "connecting";

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black text-white">
            Q
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-50">
            QuizBattle
          </span>
        </Link>
        <Link
          href="/login"
          className="text-sm text-slate-400 transition hover:text-slate-100"
        >
          เป็นโฮสต์? เข้าสู่ระบบ
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 pb-16 sm:px-6">
        {phase === "lobby" && room ? (
          <Lobby
            room={room}
            nickname={nickname}
            connected={connected}
            onLeave={leaveRoom}
          />
        ) : (
          <form
            onSubmit={handleSubmit}
            className={`${cardClass} mx-auto w-full max-w-md p-6 sm:p-8`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
              Player
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-50">
              เข้าร่วมเกม
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              กรอกโค้ดห้องจากจอของโฮสต์ แล้วตั้งชื่อเล่นของคุณ
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label
                  className="text-sm font-medium text-slate-300"
                  htmlFor="room-code"
                >
                  โค้ดห้อง
                </label>
                <input
                  id="room-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`${inputClass} text-center text-2xl font-bold tracking-[0.4em]`}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  maxLength={6}
                  autoFocus={initialCode.length !== 6}
                  disabled={joining}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  className="text-sm font-medium text-slate-300"
                  htmlFor="nickname"
                >
                  ชื่อเล่น
                </label>
                <input
                  id="nickname"
                  className={inputClass}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="เช่น น้องเจน"
                  maxLength={20}
                  autoFocus={initialCode.length === 6}
                  disabled={joining}
                />
              </div>

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className={`${primaryButtonClass} h-11`}
                disabled={joining}
              >
                {joining ? <Spinner className="size-4" /> : null}
                เข้าร่วมห้อง
              </button>
            </div>

            <p className="mt-5 text-center text-xs text-slate-500">
              ไม่ต้องสมัครสมาชิก — ใส่ชื่อแล้วเล่นได้เลย
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

function Lobby({
  room,
  nickname,
  connected,
  onLeave,
}: {
  room: RoomState;
  nickname: string;
  connected: boolean;
  onLeave: () => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className={`${cardClass} p-6 text-center sm:p-8`}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
          Lobby
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          {room.quizTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          โฮสต์: {room.hostName} · {room.questionCount} คำถาม
        </p>

        <div className="mx-auto mt-6 flex max-w-xs flex-col items-center gap-1 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-6 py-4">
          <span className="text-xs uppercase tracking-[0.2em] text-violet-300">
            โค้ดห้อง
          </span>
          <span className="font-mono text-4xl font-black tracking-[0.3em] text-slate-50">
            {room.code}
          </span>
        </div>

        <p className="mt-5 flex items-center justify-center gap-2 text-sm text-emerald-300">
          <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
          เข้าร่วมแล้วในชื่อ {nickname}
        </p>

        {!connected ? (
          <p className="mt-2 text-xs text-amber-300">
            การเชื่อมต่อขาดหาย กำลังเชื่อมต่อใหม่…
          </p>
        ) : null}
      </div>

      <div className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">
            ผู้เล่นในห้อง
          </h2>
          <span className="rounded-full bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300">
            {room.players.length} คน
          </span>
        </div>

        {room.players.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">ยังไม่มีผู้เล่น</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
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
                {player.nickname === nickname ? (
                  <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                    คุณ
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-slate-400">
          รอโฮสต์เริ่มเกม… เกมจริงจะมาใน Phase 3
        </p>
        <button type="button" className={secondaryButtonClass} onClick={onLeave}>
          ออกจากห้อง
        </button>
      </div>
    </section>
  );
}
