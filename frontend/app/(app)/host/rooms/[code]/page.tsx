import { Suspense } from "react";
import { Spinner } from "@/components/spinner";
import HostRoom from "./host-room";

export default function HostRoomPage() {
  // `useParams()` is runtime URL data, so the lobby lives behind Suspense.
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-400">
          <Spinner className="size-5 text-violet-400" />
          กำลังเปิดห้อง…
        </div>
      }
    >
      <HostRoom />
    </Suspense>
  );
}
