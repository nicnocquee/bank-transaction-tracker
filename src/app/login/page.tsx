import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 mb-8 text-ink-muted">
        Track expenses from bank receipt emails in one place.
      </p>
      <LoginForm />
    </main>
  );
}
