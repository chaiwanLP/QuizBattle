import { Suspense } from "react";
import { Spinner } from "@/components/spinner";
import JoinScreen from "./join-screen";

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-24 text-slate-400">
          <Spinner className="size-6 text-violet-400" />
        </div>
      }
    >
      <JoinScreen />
    </Suspense>
  );
}
