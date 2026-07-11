import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
      <p className="mt-2 mb-8 text-ink-muted">
        Import bank receipt emails and track spending across accounts.
      </p>
      <RegisterForm />
    </main>
  );
}
