import { Suspense } from "react";
import { Spinner } from "@/components/spinner";
import QuizEditor from "./quiz-editor";

export default function QuizEditorPage() {
  // `useParams()` is runtime URL data, so the editor lives behind Suspense.
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-400">
          <Spinner className="size-5 text-violet-400" />
          กำลังโหลดควิซ…
        </div>
      }
    >
      <QuizEditor />
    </Suspense>
  );
}
