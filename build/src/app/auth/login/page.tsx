import { LoginForm } from "./login-form";

/**
 * `searchParams` is a Promise in Next.js 16 (async request APIs).
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const { redirect, error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <LoginForm redirectTo={redirect} initialError={error} />
    </div>
  );
}
