import { Suspense } from "react";
import { Spinner } from "@/components/spinner";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10 text-slate-400">
          <Spinner className="size-6 text-violet-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
